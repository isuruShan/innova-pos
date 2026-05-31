const express = require('express');
const axios = require('axios');
const Tenant = require('../../../../pos/server/src/models/Tenant');
const TenantSettings = require('../../../../pos/server/src/models/TenantSettings');
const Customer = require('../../../../pos/server/src/models/Customer');
const CustomerSessionCheckin = require('../models/CustomerSessionCheckin');
const { sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

// Helper function to mock sending SMS
function mockSendSms(mobile, message) {
  console.log(`\n==================================================`);
  console.log(`[SMS GATEWAY] Sending to: ${mobile}`);
  console.log(`[SMS GATEWAY] Message: ${message}`);
  console.log(`==================================================\n`);
}

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

    // Determine if OTP SMS verification is required
    const otpRequired = Boolean(tenant.smsGatewayAllowed && settings?.customerOtpVerificationEnabled);

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
      otpRequired
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /api/customer-checkin/initiate — Start check-in process (send OTP if required)
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
    const settings = await TenantSettings.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const otpRequired = Boolean(tenant.smsGatewayAllowed && settings?.customerOtpVerificationEnabled);
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    const checkin = await CustomerSessionCheckin.findOneAndUpdate(
      { sessionId },
      {
        tenantId,
        storeId,
        mobile,
        name: name || '',
        email: email || '',
        birthday: birthday ? new Date(birthday) : null,
        status: otpRequired ? 'pending_otp' : 'completed',
        otp: otpRequired ? otp : '',
        otpExpiresAt: otpRequired ? otpExpiresAt : null,
      },
      { upsert: true, new: true }
    );

    if (otpRequired) {
      mockSendSms(mobile, `Your Cafinity check-in verification code is: ${otp}. Valid for 5 minutes.`);
      return res.json({ otpRequired: true, status: 'pending_otp' });
    }

    // Direct trigger to POS if no OTP is required
    const posUrl = process.env.POS_URL || 'http://localhost:5000';
    await axios.post(`${posUrl}/api/customers/session-checkin-trigger/${sessionId}`, {});

    res.json({ otpRequired: false, checkedIn: true, status: 'completed' });
  } catch (err) {
    console.error('[customer-checkin initiate]', err.message);
    res.status(400).json({ message: err.message });
  }
});

// POST /api/customer-checkin/verify — Validate OTP and trigger cashier sync
router.post('/verify', async (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) {
      return res.status(400).json({ message: 'Session ID and OTP are required' });
    }

    const checkin = await CustomerSessionCheckin.findOne({ sessionId });
    if (!checkin) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    if (checkin.status === 'placed') {
      return res.status(400).json({ message: 'This order session has already been completed.' });
    }

    if (checkin.status === 'completed') {
      return res.json({ success: true, checkedIn: true });
    }

    if (!checkin.otp || checkin.otp !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    if (checkin.otpExpiresAt && new Date() > checkin.otpExpiresAt) {
      return res.status(400).json({ message: 'OTP code has expired' });
    }

    // Set checkin status to completed
    checkin.status = 'completed';
    await checkin.save();

    // Trigger POS server
    const posUrl = process.env.POS_URL || 'http://localhost:5000';
    await axios.post(`${posUrl}/api/customers/session-checkin-trigger/${sessionId}`, {});

    res.json({ success: true, checkedIn: true });
  } catch (err) {
    console.error('[customer-checkin verify]', err.message);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
