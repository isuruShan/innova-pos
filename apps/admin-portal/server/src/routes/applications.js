const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const MerchantApplication = require('../models/MerchantApplication');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { authenticateJWT, authorize, emitAudit } = require('@innovapos/shared-middleware');
const { sendWelcomeEmail, sendRejectionEmail } = require('../utils/mailer');
const { childLogger } = require('@innovapos/logger');

const router = express.Router();

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// GET /applications — list all with pagination and filter
router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { 'personal.email': { $regex: search, $options: 'i' } },
        { 'personal.firstName': { $regex: search, $options: 'i' } },
        { 'personal.lastName': { $regex: search, $options: 'i' } },
        { 'business.name': { $regex: search, $options: 'i' } },
        { 'business.ownerName': { $regex: search, $options: 'i' } },
        { 'business.ownerNames': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [applications, total] = await Promise.all([
      MerchantApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        .populate('reviewedBy', 'name').lean(),
      MerchantApplication.countDocuments(filter),
    ]);

    res.json({ applications, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// GET /applications/:id — single application detail
router.get('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const app = await MerchantApplication.findById(req.params.id).populate('reviewedBy', 'name');
    if (!app) return res.status(404).json({ message: 'Application not found' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ message: err.message });
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

      // Create tenant
      const tenant = await Tenant.create({
        slug,
        businessName: application.business.name,
        status: 'active',
        subscriptionStatus: 'trial',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        adminCount: 1,
        createdBy: req.user.id,
      });

      // Create merchant_admin user
      const tempPassword = generateTempPassword();
      const adminUser = await User.create({
        name: `${application.personal.firstName} ${application.personal.lastName}`,
        email: application.personal.email,
        password: tempPassword,
        role: 'merchant_admin',
        tenantId: tenant._id,
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
        changes: { after: { tenantId: tenant._id, adminUserId: adminUser._id } },
      });

      logger.info('Application approved', { applicationId: application._id, tenantId: tenant._id });

      return res.json({
        message: welcomeEmailSent
          ? 'Application approved. Tenant created and welcome email sent.'
          : 'Application approved and tenant created. Welcome email could not be sent — check server logs and EMAIL_FROM / EMAIL_APP_PASSWORD (dev) or SES (production).',
        welcomeEmailSent,
        application,
        tenant: { id: tenant._id, slug: tenant.slug, businessName: tenant.businessName },
        adminUser: { id: adminUser._id, email: adminUser.email },
      });
    }
  } catch (err) {
    req.app.locals.logger.error('Application status update error', { error: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
