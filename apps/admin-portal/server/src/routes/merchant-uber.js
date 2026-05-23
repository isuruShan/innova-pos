'use strict';

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Tenant = require('../models/Tenant');
const Store = require('../models/Store');
const PlatformUberSettings = require('../models/PlatformUberSettings');
const { authenticateJWT, authorize, tenantScope, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

// GET merchant's Uber Eats settings
router.get('/config', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const stores = await Store.find({ tenantId: req.tenantId, isActive: true }).lean();

    const uberEats = tenant.paidAddons?.uberEats || {};
    const mappedStores = stores.map(store => {
      const conn = uberEats.stores?.find(s => String(s.storeId) === String(store._id));
      return {
        storeId: store._id,
        storeName: store.name,
        uberStoreId: conn?.uberStoreId || '',
        isConnected: conn?.isConnected || false,
        connectedAt: conn?.connectedAt || null,
      };
    });

    res.json({
      autoAccept: uberEats.autoAccept || false,
      defaultPrepTime: uberEats.defaultPrepTime || 15,
      webhookSecret: uberEats.webhookSecret || '',
      stores: mappedStores,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT merchant's Uber Eats settings
router.put('/config', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { autoAccept, defaultPrepTime, webhookSecret, stores: inputStores } = req.body;

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    tenant.paidAddons = tenant.paidAddons || {};
    tenant.paidAddons.uberEats = tenant.paidAddons.uberEats || {};

    if (autoAccept !== undefined) tenant.paidAddons.uberEats.autoAccept = Boolean(autoAccept);
    if (defaultPrepTime !== undefined) tenant.paidAddons.uberEats.defaultPrepTime = Math.max(1, parseInt(defaultPrepTime, 10) || 15);
    if (webhookSecret !== undefined) tenant.paidAddons.uberEats.webhookSecret = String(webhookSecret).trim();

    if (Array.isArray(inputStores)) {
      const currentStores = tenant.paidAddons.uberEats.stores || [];
      const updatedStores = [];

      for (const item of inputStores) {
        if (!item.storeId) continue;
        const existing = currentStores.find(s => String(s.storeId) === String(item.storeId));
        updatedStores.push({
          storeId: item.storeId,
          uberStoreId: String(item.uberStoreId || '').trim(),
          accessToken: existing?.accessToken || '',
          refreshToken: existing?.refreshToken || '',
          tokenExpiresAt: existing?.tokenExpiresAt || null,
          isConnected: existing?.isConnected || false,
          connectedAt: existing?.connectedAt || null,
        });
      }

      tenant.paidAddons.uberEats.stores = updatedStores;
    }

    tenant.updatedBy = req.user.id;
    await tenant.save();

    res.json({ success: true });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET platform auth initiation URL for merchant settings UI
router.get('/auth/initiate', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const storeId = req.query.storeId;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: 'Valid storeId is required.' });
    }

    const platformSettings = await PlatformUberSettings.findOne({ singletonKey: 'default' }).lean();
    if (!platformSettings || !platformSettings.clientId || !platformSettings.redirectUri) {
      return res.status(500).json({ message: 'Platform developer application is not configured.' });
    }

    const state = `${req.tenantId}:${storeId}`;
    const authUrl = `https://login.uber.com/oauth/v2/authorize?client_id=${encodeURIComponent(
      platformSettings.clientId
    )}&response_type=code&redirect_uri=${encodeURIComponent(
      platformSettings.redirectUri
    )}&state=${encodeURIComponent(state)}&scope=eats.store%20eats.order%20eats.report`;

    res.json({ url: authUrl });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST trigger menu sync on POS server
router.post('/menu/sync', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: 'Valid storeId is required.' });
    }

    const posUrl = process.env.POS_SERVER_URL || 'http://localhost:5000';
    
    // Call the POS server to run the sync
    const response = await axios.post(`${posUrl}/api/uber/menu/sync`, { storeId }, {
      headers: {
        Authorization: req.headers.authorization,
      }
    });

    res.json(response.data);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
