const express = require('express');
const axios = require('axios');
const Tenant = require('../../../../pos/server/src/models/Tenant');
const TenantSettings = require('../../../../pos/server/src/models/TenantSettings');
const Customer = require('../../../../pos/server/src/models/Customer');
const CustomerSessionCheckin = require('../models/CustomerSessionCheckin');
const { sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

// GET /api/customer-checkin/tenant-info — Fetch brand details and settings
router.get('/tenant-info', async (req, res) => {
  try {
    const { tenantId, storeId, sessionId } = req.query;

    let resolvedTenantId = tenantId;
    let resolvedStoreId = storeId;

    if (sessionId) {
      const checkin = await CustomerSessionCheckin.findOne({ sessionId }).lean();
      if (checkin) {
        if (checkin.status === 'placed') {
          return res.status(400).json({ message: 'This order session has already been completed.' });
        }
        if (!resolvedTenantId) resolvedTenantId = checkin.tenantId;
        if (!resolvedStoreId) resolvedStoreId = checkin.storeId;
      }
    }

    if (!resolvedTenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }

    const [tenant, settings] = await Promise.all([
      Tenant.findById(resolvedTenantId).lean(),
      TenantSettings.findOne({ tenantId: resolvedTenantId }).lean()
    ]);

    if (!tenant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    // OTP verification removed - always return false
    res.json({
      businessName: tenant.businessName,
      logoUrl: settings?.logoUrl || '',
      themePresetId: settings?.themePresetId || 'default',
      primaryColor: settings?.primaryColor || '#0B1220',
      accentColor: settings?.accentColor || '#e94560',
      bodyColor: settings?.bodyColor || '#0B1220',
      textColor: settings?.textColor || '#E2E8F0',
      buttonColor: settings?.buttonColor || '#E94560',
      buttonTextColor: settings?.buttonTextColor || '#F8FAFC',
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /api/customer-checkin/initiate — Start check-in process (no OTP, direct registration)
router.post('/initiate', async (req, res) => {
  try {
    const { tenantId, storeId, sessionId, mobile, name, email, birthday } = req.body;
    if (!tenantId || !storeId || !sessionId || !mobile) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const checkinExists = await CustomerSessionCheckin.findOne({ sessionId }).lean();
    if (checkinExists && checkinExists.status === 'placed') {
      return res.status(400).json({ message: 'This order session has already been completed.' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    // Create/update the checkin session as completed (no OTP verification)
    const checkin = await CustomerSessionCheckin.findOneAndUpdate(
      { sessionId },
      {
        tenantId,
        storeId,
        mobile,
        name: name || '',
        email: email || '',
        birthday: birthday ? new Date(birthday) : null,
        status: 'completed',
      },
      { upsert: true, new: true }
    );

    // Trigger POS server immediately
    const posUrl = process.env.POS_URL || 'http://localhost:5000';
    try {
      console.log(`[customer-checkin] Triggering POS at ${posUrl}/api/customers/session-checkin-trigger/${sessionId}`);
      await axios.post(`${posUrl}/api/customers/session-checkin-trigger/${sessionId}`, {}, { timeout: 5000 });
      console.log(`[customer-checkin] POS trigger successful for session ${sessionId}`);
    } catch (triggerErr) {
      console.error(`[customer-checkin] Failed to trigger POS:`, triggerErr.message);
      // Don't fail the request - customer is already registered
    }

    res.json({ otpRequired: false, checkedIn: true, status: 'completed' });
  } catch (err) {
    console.error('[customer-checkin initiate]', err.message);
    res.status(400).json({ message: err.message });
  }
});

// POST /api/customer-checkin/verify — Legacy endpoint (OTP removed, now just returns success)
router.post('/verify', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const checkin = await CustomerSessionCheckin.findOne({ sessionId });
    if (!checkin) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    if (checkin.status === 'placed') {
      return res.status(400).json({ message: 'This order session has already been completed.' });
    }

    // Session exists and is completed (no OTP verification needed)
    res.json({ success: true, checkedIn: true });
  } catch (err) {
    console.error('[customer-checkin verify]', err.message);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
