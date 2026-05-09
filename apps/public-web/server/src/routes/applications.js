const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const MerchantApplication = require('../models/MerchantApplication');
const PlatformUserLookup = require('../models/PlatformUser');
const { sendApplicationReceivedEmail } = require('../utils/mailer');
const { childLogger } = require('@innovapos/logger');
const { buildMobileE164 } = require('../utils/phone');

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email' });
      }
      const [appDup, userDup] = await Promise.all([
        MerchantApplication.findOne({ 'personal.email': email }).select('status'),
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
      const appMob = await MerchantApplication.findOne({ 'personal.mobileE164': mobileE164 }).select('status');
      if (appMob) {
        out.mobileAvailable = false;
        out.reasons.push({ field: 'mobile', code: 'application', status: appMob.status });
      }
    }

    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
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

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!mobileE164 || mobileE164.length < 10) {
      return res.status(400).json({ message: 'Invalid mobile number' });
    }

    const requiredBiz = { businessName, ownerName, street1, zipCode, city, state, businessCountry };
    const missingB = Object.entries(requiredBiz).filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
    if (missingB.length) {
      return res.status(400).json({ message: `Missing required business fields: ${missingB.join(', ')}` });
    }

    const reg = isRegistered === 'true' || isRegistered === true;
    if (reg && !String(registrationNumber || '').trim()) {
      return res.status(400).json({ message: 'Registration number is required for registered businesses' });
    }
    if (reg && !req.file) {
      return res.status(400).json({ message: 'BR certificate file is required for registered businesses' });
    }

    const emailLower = email.toLowerCase().trim();

    const existingEmail = await MerchantApplication.findOne({ 'personal.email': emailLower });
    if (existingEmail) {
      return res.status(409).json({
        message: 'An application with this email already exists.',
        status: existingEmail.status,
      });
    }

    const existingMobile = await MerchantApplication.findOne({ 'personal.mobileE164': mobileE164 });
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
            timeout: 30000,
          }
        );
        brDocumentUrl = uploadRes.data.url;
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
        brDocumentUrl,
        brDocumentKey,
        brDocumentMimeType,
      },
    });

    logger.info('Merchant application submitted', { applicationId: application._id, email: emailLower });

    sendApplicationReceivedEmail({
      to: email,
      name: `${firstName} ${lastName}`,
    }).catch(() => {});

    sendApplicationReceivedEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_FROM,
      name: `New application from ${firstName} ${lastName} (${businessName})`,
    }).catch(() => {});

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
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
