'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantSettings = require('../models/TenantSettings');
const TenantGoogleBusiness = require('../models/TenantGoogleBusiness');
const { encrypt, decrypt } = require('../utils/encryption');
const googleBusinessApi = require('../lib/googleBusinessApi');
const { authenticateJWT, authorize, tenantScope, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

// GET status of Google Business Profile connection
router.get('/status', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const conn = await TenantGoogleBusiness.findOne({ tenantId: req.tenantId }).lean();
    if (!conn) {
      return res.json({ status: 'disconnected' });
    }
    res.json({
      status: conn.gbpStatus,
      gbpAccountName: conn.gbpAccountName,
      gbpLocationName: conn.gbpLocationName,
      gbpPlaceId: conn.gbpPlaceId,
      lastSyncedAt: conn.lastSyncedAt,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET OAuth URL to start Google Auth flow
router.get('/oauth/start', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const state = encodeURIComponent(req.tenantId.toString());
    const url = googleBusinessApi.getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET OAuth callback redirect (Public route called by Google)
router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[Google OAuth Callback Error]:', error);
    return res.status(400).send(`OAuth Error: ${error}`);
  }

  if (!code || !state) {
    return res.status(400).send('OAuth Error: Missing code or state');
  }

  try {
    const tenantId = decodeURIComponent(state);
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).send('OAuth Error: Invalid state parameter');
    }

    // Exchange code for tokens
    const tokens = await googleBusinessApi.getTokensFromCode(code);

    // Encrypt tokens
    const encAccess = encrypt(tokens.access_token);
    const encRefresh = encrypt(tokens.refresh_token);
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // Save tokens to DB
    await TenantGoogleBusiness.findOneAndUpdate(
      { tenantId },
      {
        accessToken: encAccess,
        refreshToken: encRefresh,
        tokenExpiresAt: expiresAt,
        gbpStatus: 'connected',
      },
      { upsert: true, new: true }
    );

    const host = process.env.VITE_ADMIN_URL || 'http://localhost:5173';
    res.redirect(`${host}/branding?google_connected=true`);
  } catch (err) {
    console.error('[Google OAuth Callback Exception]:', err.message);
    res.status(500).send(`Google OAuth Callback exchange failed: ${err.message}`);
  }
});

// POST Create profile on Google My Business
router.post('/create-profile', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const conn = await TenantGoogleBusiness.findOne({ tenantId: req.tenantId });
    if (!conn || !conn.accessToken) {
      return res.status(400).json({ message: 'Google account not connected.' });
    }

    const settings = await TenantSettings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      return res.status(404).json({ message: 'Tenant settings not found.' });
    }

    if (!settings.businessName || !settings.address || !settings.phone) {
      return res.status(400).json({ message: 'Business name, address, and phone are required to create a profile.' });
    }

    // Decrypt tokens
    const decryptedAccess = decrypt(conn.accessToken);
    const decryptedRefresh = decrypt(conn.refreshToken);

    const authClient = googleBusinessApi.getClientWithTokens({
      access_token: decryptedAccess,
      refresh_token: decryptedRefresh,
      expiry_date: conn.tokenExpiresAt ? conn.tokenExpiresAt.getTime() : undefined,
    });

    // 1. Get Accounts
    const accounts = await googleBusinessApi.getGbpAccounts(authClient);
    if (!accounts || accounts.length === 0) {
      return res.status(400).json({ message: 'No Google Business Profile accounts found for this user.' });
    }

    // Pick first account
    const accountName = accounts[0].name;

    // 2. Create Location
    const location = await googleBusinessApi.createLocation(authClient, accountName, {
      businessName: settings.businessName,
      phone: settings.phone,
      website: settings.website,
      address: settings.address,
      countryIso: settings.countryIso || 'LK',
      category: settings.category,
    });

    // 3. Save location details
    conn.gbpAccountName = accountName;
    conn.gbpLocationName = location.name;
    conn.gbpPlaceId = location.metadata?.placeId || '';
    conn.gbpStatus = 'pending_verification';
    conn.lastSyncedAt = new Date();
    await conn.save();

    // Also update Tenant model
    const tenant = await Tenant.findById(req.tenantId);
    if (tenant) {
      tenant.googleBusinessProfileId = location.name;
      await tenant.save();
    }

    res.json({
      status: 'pending_verification',
      gbpLocationName: location.name,
      gbpPlaceId: location.metadata?.placeId || '',
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT Sync updated details to Google Business Profile
router.put('/sync', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const conn = await TenantGoogleBusiness.findOne({ tenantId: req.tenantId });
    if (!conn || !conn.gbpLocationName) {
      return res.status(400).json({ message: 'No connected Google Business location found.' });
    }

    const settings = await TenantSettings.findOne({ tenantId: req.tenantId });
    if (!settings) {
      return res.status(404).json({ message: 'Tenant settings not found.' });
    }

    // Decrypt tokens
    const decryptedAccess = decrypt(conn.accessToken);
    const decryptedRefresh = decrypt(conn.refreshToken);

    const authClient = googleBusinessApi.getClientWithTokens({
      access_token: decryptedAccess,
      refresh_token: decryptedRefresh,
      expiry_date: conn.tokenExpiresAt ? conn.tokenExpiresAt.getTime() : undefined,
    });

    // Sync details
    await googleBusinessApi.syncLocation(authClient, conn.gbpLocationName, {
      businessName: settings.businessName,
      phone: settings.phone,
      website: settings.website,
      address: settings.address,
      countryIso: settings.countryIso || 'LK',
    });

    conn.lastSyncedAt = new Date();
    await conn.save();

    res.json({ success: true, lastSyncedAt: conn.lastSyncedAt });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// DELETE Disconnect Google account and clear listing link
router.delete('/disconnect', authenticateJWT, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    await TenantGoogleBusiness.deleteOne({ tenantId: req.tenantId });

    const tenant = await Tenant.findById(req.tenantId);
    if (tenant) {
      tenant.googleBusinessProfileId = '';
      await tenant.save();
    }

    res.json({ success: true });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
