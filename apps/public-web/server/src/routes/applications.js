const express = require('express');
const { sendRouteError } = require('@innovapos/shared-middleware');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const MerchantApplication = require('../models/MerchantApplication');
const PlatformUserLookup = require('../models/PlatformUser');
const { sendApplicationReceivedEmail, sendNewApplicationAdminEmail } = require('../utils/mailer');
const Notification = require('../../../../admin-portal/server/src/models/Notification');
const { childLogger } = require('@innovapos/logger');
const { buildMobileE164 } = require('../utils/phone');
const AdminPortalUser = require('../../../../admin-portal/server/src/models/User');
const {
  validateEmail,
  validateSignupPersonal,
  validateSignupBusiness,
} = require('@innovapos/form-validation');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPEG, PNG, or WebP images are allowed for the BR certificate'));
  },
});

function firstValidationError(errors) {
  const key = Object.keys(errors)[0];
  return key ? errors[key] : null;
}

/** Rejected applications stay in DB for audit but do not block email/mobile reuse. */
const HOLDING_APPLICATION_STATUSES = ['pending', 'under_review', 'approved'];

function holdingApplicationQuery(filter) {
  return { ...filter, status: { $in: HOLDING_APPLICATION_STATUSES } };
}

/**
 * GET /applications/availability?email=&mobileE164=
 * Returns whether email / mobile are free (no application + no user account for email).
 */
router.get('/availability', async (req, res) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    const mobileE164 = (req.query.mobileE164 || '').trim();

    if (!email && !mobileE164) {
      return res.status(400).json({ message: 'email or mobileE164 required' });
    }

    const out = { emailAvailable: true, mobileAvailable: true, reasons: [] };

    if (email) {
      const emailCheck = validateEmail(email);
      if (!emailCheck.ok) {
        return res.status(400).json({ message: emailCheck.error });
      }
      const [appDup, userDup] = await Promise.all([
        MerchantApplication.findOne(holdingApplicationQuery({ 'personal.email': email })).select('status'),
        PlatformUserLookup.findOne({ email }).select('_id'),
      ]);
      if (appDup) {
        out.emailAvailable = false;
        out.reasons.push({ field: 'email', code: 'application', status: appDup.status });
      }
      if (userDup) {
        out.emailAvailable = false;
        out.reasons.push({ field: 'email', code: 'account_exists' });
      }
    }

    if (mobileE164) {
      if (!mobileE164.startsWith('+') || mobileE164.length < 10) {
        return res.status(400).json({ message: 'Invalid mobileE164' });
      }
      const appMob = await MerchantApplication.findOne(
        holdingApplicationQuery({ 'personal.mobileE164': mobileE164 }),
      ).select('status');
      if (appMob) {
        out.mobileAvailable = false;
        out.reasons.push({ field: 'mobile', code: 'application', status: appMob.status });
      }
    }

    res.json(out);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /applications — Submit merchant application (multipart).
 */
router.post('/', upload.single('brFile'), async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);

  try {
    const body = req.body;
    const {
      firstName, lastName, email,
      countryDialCode, mobileNational, mobileDisplay,
      businessName, ownerName,
      street1, street2, zipCode, city, state, businessCountry,
      isRegistered, registrationNumber,
    } = body;

    const mobileE164 = buildMobileE164(countryDialCode, mobileNational);

    const requiredPersonal = { firstName, lastName, email, countryDialCode, mobileNational };
    const missingP = Object.entries(requiredPersonal).filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
    if (missingP.length) {
      return res.status(400).json({ message: `Missing required fields: ${missingP.join(', ')}` });
    }

    const personalErrors = validateSignupPersonal({ firstName, lastName, email });
    const personalMsg = firstValidationError(personalErrors);
    if (personalMsg) {
      return res.status(400).json({ message: personalMsg, errors: personalErrors });
    }

    if (!mobileE164 || mobileE164.length < 10 || mobileE164.length > 20) {
      return res.status(400).json({ message: 'Invalid mobile number' });
    }

    const reg = isRegistered === 'true' || isRegistered === true;
    const businessErrors = validateSignupBusiness(
      {
        businessName,
        ownerName,
        street1,
        street2,
        zipCode,
        city,
        state,
        businessCountry,
        registrationNumber,
      },
      { isRegistered: reg },
    );
    const businessMsg = firstValidationError(businessErrors);
    if (businessMsg) {
      return res.status(400).json({ message: businessMsg, errors: businessErrors });
    }

    if (reg && !req.file) {
      return res.status(400).json({ message: 'BR certificate file is required for registered businesses' });
    }

    const emailLower = email.toLowerCase().trim();

    const existingEmail = await MerchantApplication.findOne(
      holdingApplicationQuery({ 'personal.email': emailLower }),
    );
    if (existingEmail) {
      return res.status(409).json({
        message: 'An application with this email already exists.',
        status: existingEmail.status,
      });
    }

    const existingMobile = await MerchantApplication.findOne(
      holdingApplicationQuery({ 'personal.mobileE164': mobileE164 }),
    );
    if (existingMobile) {
      return res.status(409).json({
        message: 'An application with this mobile number already exists.',
        status: existingMobile.status,
      });
    }

    const existingUser = await PlatformUserLookup.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    let brDocumentUrl = '';
    let brDocumentKey = '';
    let brDocumentMimeType = '';

    if (req.file) {
      try {
        const form = new FormData();
        form.append('file', req.file.buffer, {
          filename: req.file.originalname || 'br-certificate.webp',
          contentType: req.file.mimetype,
        });
        form.append('type', 'br-document');

        const uploadRes = await axios.post(
          `${process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002'}/upload`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              'x-service-key': String(process.env.INTERNAL_SERVICE_KEY ?? '').trim(),
            },
            timeout: require('@innovapos/shared-middleware').resolveUploadProxyTimeoutMs(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );
        brDocumentKey = uploadRes.data.key;
        brDocumentMimeType = uploadRes.data.mimeType || req.file.mimetype;
      } catch (uploadErr) {
        const status = uploadErr.response?.status;
        const body = uploadErr.response?.data;
        const detail =
          uploadErr.message ||
          body?.message ||
          uploadErr.code ||
          (uploadErr.response ? `HTTP ${uploadErr.response.status}` : '') ||
          String(uploadErr);
        logger.error('BR document upload failed', {
          error: detail,
          axiosCode: uploadErr.code,
          uploadStatus: status,
          uploadBody: body,
          uploadUrl: `${process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002'}/upload`,
          ...(status === 401 && {
            hint: 'Set INTERNAL_SERVICE_KEY to the same non-empty value in public-web-server and upload-service .env, then restart both.',
          }),
          ...(uploadErr.code === 'ECONNREFUSED' && {
            hint: 'Upload service not reachable — start it: pnpm upload (or ensure UPLOAD_SERVICE_URL is correct).',
          }),
        });
        return res.status(502).json({
          message: 'Could not upload BR document. Please try again or contact support.',
        });
      }
    }

    const mobile =
      (mobileDisplay && String(mobileDisplay).trim()) ||
      `${mobileE164}`;

    const application = await MerchantApplication.create({
      personal: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: emailLower,
        countryDialCode: String(countryDialCode).replace(/\D/g, ''),
        mobileNational: String(mobileNational).replace(/\D/g, ''),
        mobile,
        mobileE164,
      },
      business: {
        name: businessName.trim(),
        ownerName: ownerName.trim(),
        street1: street1.trim(),
        street2: (street2 || '').trim(),
        zipCode: zipCode.trim(),
        city: city.trim(),
        state: state.trim(),
        country: businessCountry.trim(),
        isRegistered: reg,
        registrationNumber: (registrationNumber || '').trim(),
        brDocumentUrl: '',
        brDocumentKey,
        brDocumentMimeType,
      },
    });

    logger.info('Merchant application submitted', { applicationId: application._id, email: emailLower });

    sendApplicationReceivedEmail({
      to: email,
      name: `${firstName} ${lastName}`,
    }).catch(() => {});

    try {
      const adminBase = String(process.env.ADMIN_URL || 'http://localhost:5174').replace(/\/$/, '');
      const reviewUrl = `${adminBase}/applications/${application._id}`;
      const applicantName = `${firstName} ${lastName}`.trim();

      let supers = await AdminPortalUser.find({ role: 'superadmin', isActive: true })
        .select('_id email')
        .lean();
      if (!supers.length) {
        supers = await PlatformUserLookup.find({ role: 'superadmin', isActive: true })
          .select('_id email')
          .lean();
      }

      if (supers.length) {
        await Notification.insertMany(
          supers.map((u) => ({
            tenantId: null,
            userId: u._id,
            type: 'merchant_application_submitted',
            title: 'New merchant application',
            body: `${businessName} — ${applicantName}`,
            meta: { resourceType: 'application', resourceId: String(application._id) },
          })),
        ).catch((notifyErr) => {
          logger.warn('In-app notification for application failed', { error: notifyErr.message });
        });
      }

      const emailRecipients = new Set();
      for (const u of supers) {
        if (u.email) emailRecipients.add(String(u.email).trim().toLowerCase());
      }
      const fallback = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_FROM;
      if (fallback) emailRecipients.add(String(fallback).trim().toLowerCase());

      if (!emailRecipients.size) {
        logger.warn('No superadmin emails for new application — set ADMIN_NOTIFY_EMAIL or create a superadmin user');
      } else {
        await Promise.all(
          [...emailRecipients].map((to) =>
            sendNewApplicationAdminEmail({
              to,
              applicantName,
              businessName: businessName.trim(),
              email: emailLower,
              mobile,
              applicationId: String(application._id),
              reviewUrl,
            }).catch((mailErr) => {
              logger.error('Superadmin application email failed', { to, error: mailErr.message });
            }),
          ),
        );
      }
    } catch (adminAlertErr) {
      logger.error('Admin alerts for application failed', { error: adminAlertErr.message });
    }

    res.status(201).json({
      message: 'Application submitted successfully. We will review it and get back to you within 1–2 business days.',
      applicationId: application._id,
    });
  } catch (err) {
    logger.error('Application submission error', { error: err.message });
    res.status(500).json({ message: 'Failed to submit application. Please try again.' });
  }
});

router.get('/status/:email', async (req, res) => {
  try {
    const app = await MerchantApplication.findOne({
      'personal.email': req.params.email.toLowerCase(),
    }).select('status createdAt reviewedAt rejectionReason');

    if (!app) return res.status(404).json({ message: 'No application found for this email' });

    res.json({
      status: app.status,
      submittedAt: app.createdAt,
      reviewedAt: app.reviewedAt,
      rejectionReason: app.status === 'rejected' ? app.rejectionReason : undefined,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
