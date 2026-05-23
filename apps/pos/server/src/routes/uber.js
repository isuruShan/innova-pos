'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const PlatformUberSettings = require('../models/PlatformUberSettings');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');
const { acceptOrder, denyOrder, markReady, cancelOrder } = require('../services/uberEatsService');
const { syncMenuToUber } = require('../services/uberMenuSyncService');
const { exchangeCodeForStoreToken } = require('../services/uberAuthService');

const router = express.Router();
const requireUberAddon = requirePaidAddon('uber_eats');

/**
 * Initiate Uber Eats OAuth connection flow
 * GET /api/uber/auth/initiate?storeId=...
 */
router.get('/auth/initiate', protect, tenantScope, async (req, res) => {
  try {
    const storeId = req.query.storeId;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: 'Valid storeId is required.' });
    }

    const platformSettings = await PlatformUberSettings.findOne({ singletonKey: 'default' }).lean();
    if (!platformSettings || !platformSettings.clientId || !platformSettings.redirectUri) {
      return res.status(500).json({ message: 'Platform developer application is not configured.' });
    }

    // State encodes tenantId and storeId to map tokens back on callback redirect
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

/**
 * Public OAuth Callback (invoked by Uber redirect)
 * GET /api/uber/auth/callback?code=...&state=...
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[Uber OAuth Callback Error]:', error);
    return res.status(400).send(`OAuth Error: ${error}`);
  }

  if (!code || !state) {
    return res.status(400).send('OAuth Error: Missing code or state');
  }

  try {
    const [tenantId, storeId] = decodeURIComponent(state).split(':');

    if (!tenantId || !storeId || !mongoose.Types.ObjectId.isValid(tenantId) || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).send('OAuth Error: Invalid state payload');
    }

    // Exchange and store tokens
    await exchangeCodeForStoreToken(tenantId, storeId, code);

    // Redirect merchant back to settings panel
    const host = process.env.VITE_ADMIN_URL || 'http://localhost:5173'; // Fallback to dev server
    res.redirect(`${host}/manager/settings?uber_connected=true`);
  } catch (err) {
    console.error('[Uber OAuth Callback failed]:', err.message);
    res.status(500).send(`OAuth Callback exchange failed: ${err.message}`);
  }
});

/**
 * Fetch active Uber Eats orders for a store
 * GET /api/uber/orders/active?storeId=...
 */
router.get('/orders/active', protect, tenantScope, requireUberAddon, async (req, res) => {
  try {
    const storeId = req.query.storeId;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: 'Valid storeId is required.' });
    }

    const orders = await Order.find({
      tenantId: req.tenantId,
      storeId: storeId,
      orderType: 'uber-eats',
      status: { $in: ['pending', 'preparing', 'ready'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(orders);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * Accept incoming Uber order
 * PUT /api/orders/:id/uber-accept
 */
router.put('/orders/:id/uber-accept', protect, tenantScope, requireUberAddon, async (req, res) => {
  try {
    const orderId = req.params.id;
    const prepTime = parseInt(req.body.prepTime, 10) || 15;

    const order = await Order.findOne({ _id: orderId, tenantId: req.tenantId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await acceptOrder(order, prepTime);
    res.json({ success: true, status: order.status });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * Deny incoming Uber order
 * PUT /api/orders/:id/uber-deny
 */
router.put('/orders/:id/uber-deny', protect, tenantScope, requireUberAddon, async (req, res) => {
  try {
    const orderId = req.params.id;
    const reason = String(req.body.reason || 'OUT_OF_ITEMS').trim();

    const order = await Order.findOne({ _id: orderId, tenantId: req.tenantId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await denyOrder(order, reason);
    res.json({ success: true, status: order.status });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * Mark Uber order ready for pickup manually
 * PUT /api/orders/:id/uber-ready
 */
router.put('/orders/:id/uber-ready', protect, tenantScope, requireUberAddon, async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, tenantId: req.tenantId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await markReady(order);
    res.json({ success: true, status: order.status });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * Push Menu to Uber Eats manually
 * POST /api/uber/menu/sync
 */
router.post('/menu/sync', protect, tenantScope, requireUberAddon, async (req, res) => {
  try {
    const storeId = req.body.storeId;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: 'Valid storeId is required.' });
    }

    const result = await syncMenuToUber(req.tenantId, storeId);
    res.json({ success: true, data: result });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
