const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const MerchantApplication = require('../models/MerchantApplication');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Store = require('../models/Store');
const TenantSettings = require('../models/TenantSettings');
const { getPreset } = require('@innovapos/pos-theme-presets');
const { authenticateJWT, authorize, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { sendWelcomeEmail, sendRejectionEmail } = require('../utils/mailer');
const { childLogger } = require('@innovapos/logger');
const { allocateStoreCode, formatStoreAddressFromApplication } = require('../lib/storeProvisioning');

const router = express.Router();

/** Maps approved applications to tenant.countryIso (LK vs international catalogue). */
function deriveCountryIsoFromApplication(application) {
  const fromPersonal = String(application.personal?.countryIso || '').trim().toUpperCase();
  if (fromPersonal.length === 2) return fromPersonal;
  const dial = String(application.personal?.countryDialCode || '').replace(/\D/g, '');
  if (dial === '94') return 'LK';
  const bc = String(application.business?.country || '').toLowerCase();
  if (bc.includes('sri lanka')) return 'LK';
  return 'US';
}

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Prevent invalid Mongo regex when search contains reserved characters */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /applications — list all with pagination and filter
router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search && String(search).trim()) {
      const q = escapeRegex(String(search).trim());
      filter.$or = [
        { 'personal.email': { $regex: q, $options: 'i' } },
        { 'personal.firstName': { $regex: q, $options: 'i' } },
        { 'personal.lastName': { $regex: q, $options: 'i' } },
        { 'business.name': { $regex: q, $options: 'i' } },
        { 'business.ownerName': { $regex: q, $options: 'i' } },
        { 'business.ownerNames': { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const appSort = (() => {
      const sortField = String(req.query.sort || req.query.sortBy || '').trim();
      const orderRaw = String(req.query.order || req.query.sortOrder || 'desc').toLowerCase();
      const dir = orderRaw === 'asc' ? 1 : -1;
      const allowed = { createdAt: 'createdAt', status: 'status', businessName: 'business.name' };
      if (sortField && allowed[sortField]) return { [allowed[sortField]]: dir };
      return { createdAt: -1 };
    })();
    const [applicationsRaw, total] = await Promise.all([
      MerchantApplication.find(filter).sort(appSort).skip(skip).limit(parseInt(limit))
        .populate('reviewedBy', 'name').lean(),
      MerchantApplication.countDocuments(filter),
    ]);
    const applications = applicationsRaw.map((a) => ({
      ...a,
      business: a.business ? { ...a.business, brDocumentUrl: '' } : a.business,
    }));

    res.json({ applications, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /applications/:id/br-preview — fresh pre-signed URL for BR document (superadmin)
router.get('/:id/br-preview', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const application = await MerchantApplication.findById(req.params.id)
      .select('business.brDocumentKey business.brDocumentMimeType')
      .lean();
    if (!application?.business?.brDocumentKey) {
      return res.status(404).json({ message: 'No BR document on file' });
    }
    const uploadUrl = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002';
    const { data } = await axios.post(
      `${uploadUrl}/upload/presign`,
      { key: application.business.brDocumentKey, expiresIn: 3600 },
      { headers: { Authorization: req.headers.authorization }, timeout: 15000 }
    );
    res.json({
      url: data.url,
      mimeType: application.business.brDocumentMimeType || '',
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /applications/verify-email — verify applicant email via token (public)
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send('<h1>Invalid Link</h1><p>Verification token is missing.</p>');
    }
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_key');
    const application = await MerchantApplication.findById(decoded.applicationId);
    if (!application) {
      return res.status(404).send('<h1>Not Found</h1><p>Application not found.</p>');
    }
    if (application.status === 'approved' || application.status === 'rejected') {
      return res.status(400).send('<h1>Link Expired</h1><p>This application has already been processed.</p>');
    }

    application.personal.emailVerified = true;
    await application.save();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0b1220; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background-color: #151f2e; border: 1px solid #1e293b; padding: 40px; border-radius: 16px; text-align: center; max-w: 400px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
          h1 { color: #10b981; font-size: 24px; margin-top: 0; }
          p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Email Verified Successfully! 🎉</h1>
          <p>Thank you for verifying your email address. Our team will review your application and process it shortly.</p>
          <p style="font-size:13px;color:#64748b;margin-top:20px;">You can safely close this browser window now.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send('<h1>Verification Failed</h1><p>The verification link is invalid or has expired.</p>');
  }
});

// POST /applications/:id/send-verification — Send verification email to applicant (superadmin only)
router.post('/:id/send-verification', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const application = await MerchantApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (application.status === 'approved' || application.status === 'rejected') {
      return res.status(400).json({ message: 'Cannot verify email for a completed application' });
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { applicationId: application._id },
      process.env.JWT_SECRET || 'jwt_secret_key',
      { expiresIn: '24h' }
    );

    const adminUrl = process.env.ADMIN_URL || 'http://localhost:5174';
    const verificationUrl = `${adminUrl}/api/applications/verify-email?token=${token}`;

    const { sendEmailVerificationEmail } = require('../utils/mailer');
    await sendEmailVerificationEmail({
      to: application.personal.email,
      name: `${application.personal.firstName} ${application.personal.lastName}`,
      verificationUrl,
    });

    res.json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT /applications/:id/email — update applicant's email address (superadmin only, request stage only)
router.put('/:id/email', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }

    const application = await MerchantApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the application is in request stage (pending or under_review)
    if (application.status === 'approved' || application.status === 'rejected') {
      return res.status(400).json({ message: 'Cannot update email for a completed application' });
    }

    const oldEmail = application.personal.email;
    application.personal.email = email.trim().toLowerCase();
    
    // Reset verification status if the email is changed
    if (oldEmail !== application.personal.email) {
      application.personal.emailVerified = false;
    }

    await application.save();

    await emitAudit({
      req,
      action: 'APPLICATION_EMAIL_UPDATED',
      resource: 'MerchantApplication',
      resourceId: application._id,
      changes: { before: { email: oldEmail }, after: { email: application.personal.email } },
    });

    res.json({ success: true, message: 'Email address updated successfully', email: application.personal.email });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /applications/:id — single application detail
router.get('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const app = await MerchantApplication.findById(req.params.id).populate('reviewedBy', 'name').lean();
    if (!app) return res.status(404).json({ message: 'Application not found' });

    let requestedPlan = null;
    if (app.requestedPlanId === 'custom') {
      requestedPlan = { name: 'Custom Plan', isCustom: true };
    } else if (app.requestedPlanId && mongoose.Types.ObjectId.isValid(app.requestedPlanId)) {
      const SubscriptionPlan = require('../models/SubscriptionPlan');
      const plan = await SubscriptionPlan.findById(app.requestedPlanId).lean();
      if (plan) {
        requestedPlan = {
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          currency: plan.currency,
        };
      }
    }

    res.json({
      ...app,
      requestedPlan,
      business: app.business ? { ...app.business, brDocumentUrl: '' } : app.business,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT /applications/:id/status — approve or reject
router.put('/:id/status', authenticateJWT, authorize('superadmin'), async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);

  try {
    const { action, rejectionReason, notes } = req.body;
    if (!['approve', 'reject', 'under_review'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve, reject, or under_review' });
    }

    const application = await MerchantApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    if (application.status === 'approved') {
      return res.status(400).json({ message: 'Application already approved' });
    }

    const prevStatus = application.status;

    if (action === 'under_review') {
      application.status = 'under_review';
      application.reviewedBy = req.user.id;
      if (notes) application.notes = notes;
      await application.save();
      return res.json({ message: 'Marked as under review', application });
    }

    if (action === 'reject') {
      if (!rejectionReason?.trim()) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }
      application.status = 'rejected';
      application.rejectionReason = rejectionReason.trim();
      application.reviewedBy = req.user.id;
      application.reviewedAt = new Date();
      await application.save();

      try {
        await sendRejectionEmail({
          to: application.personal.email,
          name: `${application.personal.firstName} ${application.personal.lastName}`,
          reason: rejectionReason,
        });
      } catch (emailErr) {
        logger.error('Rejection email failed', { error: emailErr.message, to: application.personal.email });
      }

      await emitAudit({
        req,
        action: 'APPLICATION_REJECTED',
        resource: 'MerchantApplication',
        resourceId: application._id,
        changes: { before: { status: prevStatus }, after: { status: 'rejected', rejectionReason } },
      });

      logger.info('Application rejected', { applicationId: application._id });
      return res.json({ message: 'Application rejected and email sent', application });
    }

    // APPROVE — create Tenant + User + Subscription
    if (action === 'approve') {
      let slug = slugify(application.business.name);
      const existing = await Tenant.findOne({ slug });
      if (existing) slug = `${slug}-${Date.now()}`;

      const SubscriptionPlan = require('../models/SubscriptionPlan');
      const countryIso = deriveCountryIsoFromApplication(application);
      const planAudience = countryIso === 'LK' ? 'local' : 'international';

      let subStatus = 'expired';
      let trialEndsAt = null;
      let assignedPlanId = null;
      let pendingPlanId = null;
      let pendingPlanEffectiveAt = null;
      let planLocked = false;

      if (application.requestedPlanId === 'custom') {
        const customPlanId = req.body.planId;
        if (!customPlanId) {
          return res.status(400).json({ message: 'Custom plan assignment is required for custom requests' });
        }
        const customPlan = await SubscriptionPlan.findOne({ _id: customPlanId, isActive: true });
        if (!customPlan) {
          return res.status(404).json({ message: 'Selected plan not found' });
        }
        subStatus = 'active';
        assignedPlanId = customPlan._id;
        planLocked = true;
      } else {
        const trialPlan = await SubscriptionPlan.findOne({
          isTrialPlan: true,
          planAudience,
          isActive: true,
        });

        if (trialPlan) {
          subStatus = 'trial';
          trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
          assignedPlanId = trialPlan._id;
        }

        if (application.requestedPlanId && mongoose.Types.ObjectId.isValid(application.requestedPlanId)) {
          pendingPlanId = application.requestedPlanId;
          pendingPlanEffectiveAt = trialEndsAt;
        }
      }

      const billingCycle = application.requestedBillingCycle === 'yearly' ? 'yearly' : 'monthly';

      // Create tenant
      const tenant = await Tenant.create({
        slug,
        businessName: application.business.name,
        countryIso,
        status: 'active',
        subscriptionStatus: subStatus,
        trialEndsAt,
        assignedPlanId,
        pendingPlanId,
        pendingPlanEffectiveAt,
        billingCycle,
        planLocked,
        adminCount: 1,
        createdBy: req.user.id,
      });

      const biz = application.business || {};
      const cityTrim = String(biz.city || '').trim();
      const bizName = String(biz.name || tenant.businessName || 'Location').trim();
      const storeName = cityTrim ? `${bizName} (${cityTrim})` : `${bizName} — Main`;
      const storeCode = await allocateStoreCode(tenant._id, cityTrim, slug);
      const storeAddress = formatStoreAddressFromApplication(biz);
      const storePhone = String(application.personal?.mobile || '').trim();

      const defaultStore = await Store.create({
        tenantId: tenant._id,
        name: storeName,
        code: storeCode,
        address: storeAddress,
        phone: storePhone,
        isDefault: true,
        isActive: true,
        createdBy: req.user.id,
      });

      const dc = tenant.countryIso === 'LK'
        ? { currency: 'LKR', currencySymbol: 'Rs.' }
        : { currency: 'USD', currencySymbol: '$' };
      const themePreset = getPreset('default');
      await TenantSettings.create({
        tenantId: tenant._id,
        businessName: application.business.name,
        address: storeAddress,
        phone: storePhone,
        email: String(application.personal.email || '').trim().toLowerCase(),
        ...themePreset,
        currency: dc.currency,
        currencySymbol: dc.currencySymbol,
        createdBy: req.user.id,
      });

      // Create merchant_admin user (scoped to default store for POS / admin store picker)
      const tempPassword = generateTempPassword();
      const adminUser = await User.create({
        name: `${application.personal.firstName} ${application.personal.lastName}`,
        email: application.personal.email,
        password: tempPassword,
        role: 'merchant_admin',
        tenantId: tenant._id,
        storeIds: [defaultStore._id],
        defaultStoreId: defaultStore._id,
        isTemporaryPassword: true,
        isActive: true,
        createdBy: req.user.id,
      });

      // Update application
      application.status = 'approved';
      application.tenantId = tenant._id;
      application.reviewedBy = req.user.id;
      application.reviewedAt = new Date();
      await application.save();

      // Send welcome email (temp password — failures are logged; tenant/user already created)
      const adminUrl = process.env.ADMIN_URL || 'http://localhost:5174';
      let welcomeEmailSent = false;
      try {
        await sendWelcomeEmail({
          to: adminUser.email,
          name: adminUser.name,
          tempPassword,
          loginUrl: adminUrl,
          role: 'merchant_admin',
        });
        welcomeEmailSent = true;
      } catch (emailErr) {
        logger.error('Welcome email failed after application approval', {
          error: emailErr.message,
          to: adminUser.email,
        });
      }

      await emitAudit({
        req,
        action: 'APPLICATION_APPROVED',
        resource: 'MerchantApplication',
        resourceId: application._id,
        changes: { after: { tenantId: tenant._id, adminUserId: adminUser._id, defaultStoreId: defaultStore._id } },
      });

      logger.info('Application approved', {
        applicationId: application._id,
        tenantId: tenant._id,
        defaultStoreId: defaultStore._id,
      });

      return res.json({
        message: welcomeEmailSent
          ? 'Application approved. Tenant created and welcome email sent.'
          : 'Application approved and tenant created. Welcome email could not be sent — check server logs and EMAIL_FROM / EMAIL_APP_PASSWORD (dev) or SES (production).',
        welcomeEmailSent,
        application,
        tenant: { id: tenant._id, slug: tenant.slug, businessName: tenant.businessName },
        adminUser: { id: adminUser._id, email: adminUser.email },
        defaultStore: { id: defaultStore._id, name: defaultStore.name, code: defaultStore.code },
      });
    }
  } catch (err) {
    req.app.locals.logger.error('Application status update error', { error: err.message });
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
