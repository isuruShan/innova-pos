const express = require('express');
const axios = require('axios');
const Tenant = require('../models/Tenant');
const TenantSettings = require('../models/TenantSettings');
const Customer = require('../models/Customer');
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
    if (!tenant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const { isDualScreenEffective } = require('@innovapos/paid-addons');
    if (!isDualScreenEffective(tenant.paidAddons)) {
      return res.status(402).json({
        message: 'The Dual Screen Customer Terminal add-on is not active for this business. Subscribe in the admin portal under Add-ons.',
        code: 'dual_screen_addon_required'
      });
    }

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

    // Direct check-in (no OTP)
    // Find or create customer
    const emailNorm = String(email || '').trim().toLowerCase();
    let customer = null;
    if (emailNorm) {
      customer = await Customer.findOne({ tenantId, email: emailNorm });
    }
    if (!customer && mobile) {
      customer = await Customer.findOne({ tenantId, mobile });
    }
    if (!customer && mobile) {
      const md = String(mobile).replace(/\D/g, '');
      if (md.length >= 8) {
        customer = await Customer.findOne({ tenantId, mobileDigits: md });
      }
    }

    if (!customer) {
      customer = await Customer.create({
        tenantId,
        storeId,
        name: name || 'Customer',
        mobile,
        email: emailNorm,
        birthday: birthday ? new Date(birthday) : null,
        lastLoyaltyActivityAt: new Date(),
      });
      console.log(`[customer-checkin initiate] Created new customer: ${customer._id}`);
    } else {
      let changed = false;
      if (name && !customer.name) {
        customer.name = name;
        changed = true;
      }
      if (birthday && !customer.birthday) {
        customer.birthday = new Date(birthday);
        changed = true;
      }
      if (emailNorm && !customer.email) {
        customer.email = emailNorm;
        changed = true;
      }
      if (changed) {
        await customer.save();
        console.log(`[customer-checkin initiate] Updated customer: ${customer._id}`);
      }
    }

    // Mark checkin as processed so change stream or trigger doesn't re-process
    checkin.processed = true;
    await checkin.save();

    // Trigger POS server
    const posUrl = process.env.POS_SERVER_URL || 'http://localhost:5000';
    await axios.post(`${posUrl}/api/customers/session-checkin-trigger/${sessionId}`, {});

    res.json({ otpRequired: false, checkedIn: true, status: 'completed', customer });
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

    const tenant = await Tenant.findById(checkin.tenantId);
    const { isDualScreenEffective } = require('@innovapos/paid-addons');
    if (!tenant || !isDualScreenEffective(tenant.paidAddons)) {
      return res.status(402).json({
        message: 'The Dual Screen Customer Terminal add-on is not active for this business. Subscribe in the admin portal under Add-ons.',
        code: 'dual_screen_addon_required'
      });
    }

    if (checkin.status === 'placed') {
      return res.status(400).json({ message: 'This order session has already been completed.' });
    }

    if (checkin.status === 'completed') {
      // Find customer
      const emailNorm = String(checkin.email || '').trim().toLowerCase();
      let customer = null;
      if (emailNorm) {
        customer = await Customer.findOne({ tenantId: checkin.tenantId, email: emailNorm });
      }
      if (!customer && checkin.mobile) {
        customer = await Customer.findOne({ tenantId: checkin.tenantId, mobile: checkin.mobile });
      }
      if (!customer && checkin.mobile) {
        const md = String(checkin.mobile).replace(/\D/g, '');
        if (md.length >= 8) {
          customer = await Customer.findOne({ tenantId: checkin.tenantId, mobileDigits: md });
        }
      }
      return res.json({ success: true, checkedIn: true, customer });
    }

    if (!checkin.otp || checkin.otp !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    if (checkin.otpExpiresAt && new Date() > checkin.otpExpiresAt) {
      return res.status(400).json({ message: 'OTP code has expired' });
    }

    // Find or create customer
    const emailNorm = String(checkin.email || '').trim().toLowerCase();
    let customer = null;
    if (emailNorm) {
      customer = await Customer.findOne({ tenantId: checkin.tenantId, email: emailNorm });
    }
    if (!customer && checkin.mobile) {
      customer = await Customer.findOne({ tenantId: checkin.tenantId, mobile: checkin.mobile });
    }
    if (!customer && checkin.mobile) {
      const md = String(checkin.mobile).replace(/\D/g, '');
      if (md.length >= 8) {
        customer = await Customer.findOne({ tenantId: checkin.tenantId, mobileDigits: md });
      }
    }

    if (!customer) {
      customer = await Customer.create({
        tenantId: checkin.tenantId,
        storeId: checkin.storeId,
        name: checkin.name || 'Customer',
        mobile: checkin.mobile,
        email: emailNorm,
        birthday: checkin.birthday || null,
        lastLoyaltyActivityAt: new Date(),
      });
      console.log(`[customer-checkin verify] Created new customer: ${customer._id}`);
    } else {
      let changed = false;
      if (checkin.name && !customer.name) {
        customer.name = checkin.name;
        changed = true;
      }
      if (checkin.birthday && !customer.birthday) {
        customer.birthday = checkin.birthday;
        changed = true;
      }
      if (emailNorm && !customer.email) {
        customer.email = emailNorm;
        changed = true;
      }
      if (changed) {
        await customer.save();
        console.log(`[customer-checkin verify] Updated customer: ${customer._id}`);
      }
    }

    // Set checkin status to completed and processed
    checkin.status = 'completed';
    checkin.processed = true;
    await checkin.save();

    // Trigger POS server
    const posUrl = process.env.POS_SERVER_URL || 'http://localhost:5000';
    await axios.post(`${posUrl}/api/customers/session-checkin-trigger/${sessionId}`, {});

    res.json({ success: true, checkedIn: true, customer });
  } catch (err) {
    console.error('[customer-checkin verify]', err.message);
    res.status(400).json({ message: err.message });
  }
});

// GET /api/customer-checkin/session-status/:sessionId — Fetch check-in status and customer details if completed
router.get('/session-status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const checkin = await CustomerSessionCheckin.findOne({ sessionId }).lean();
    if (!checkin) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (checkin.status === 'completed' || checkin.status === 'placed') {
      const Customer = require('../models/Customer');
      const emailNorm = String(checkin.email || '').trim().toLowerCase();
      
      let customer = null;
      if (emailNorm) {
        customer = await Customer.findOne({ tenantId: checkin.tenantId, email: emailNorm });
      }
      if (!customer && checkin.mobile) {
        customer = await Customer.findOne({ tenantId: checkin.tenantId, mobile: checkin.mobile });
      }
      if (!customer && checkin.mobile) {
        const md = String(checkin.mobile).replace(/\D/g, '');
        if (md.length >= 8) {
          customer = await Customer.findOne({ tenantId: checkin.tenantId, mobileDigits: md });
        }
      }

      if (customer) {
        return res.json({ status: checkin.status, customer });
      }
    }

    res.json({ status: checkin.status, customer: null });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /api/customer-checkin/register-session — Initialize check-in session from POS cashier/terminal
router.post('/register-session', async (req, res) => {
  try {
    const { sessionId, tenantId, storeId } = req.body;
    if (!sessionId || !tenantId || !storeId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const tenant = await Tenant.findById(tenantId);
    const { isDualScreenEffective } = require('@innovapos/paid-addons');
    if (!tenant || !isDualScreenEffective(tenant.paidAddons)) {
      return res.json({ success: true, skipped: true, message: 'Dual screen addon not active, skipping registration.' });
    }

    // Create or update the session check-in record as 'pending'
    const checkin = await CustomerSessionCheckin.findOneAndUpdate(
      { sessionId },
      {
        tenantId,
        storeId,
        status: 'pending',
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, checkin });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
