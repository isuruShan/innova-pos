const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const PlatformPaymentSettings = require('../models/PlatformPaymentSettings');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');
const { presignObjectKey } = require('../utils/s3Runtime');

const router = express.Router();

const DEFAULT_IMAGES = {
  stripe: '/payment-icons/stripe.png',
  paypal: '/payment-icons/paypal.png',
  bank_transfer: '/payment-icons/bank.png',
};

const LOGO_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const uploadIcon = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    LOGO_IMAGE_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Logo must be JPEG, PNG, or WebP'));
  },
});

async function getOrCreateSettings() {
  let doc = await PlatformPaymentSettings.findOne({ singletonKey: 'default' });
  if (!doc) {
    doc = await PlatformPaymentSettings.create({ singletonKey: 'default' });
  }
  return doc;
}

async function resolveImage(imageUrl, imageKey, type) {
  const key = String(imageKey || '').trim();
  if (key) {
    const presigned = await presignObjectKey(key, 86400);
    if (presigned) return presigned;
  }
  const url = String(imageUrl || '').trim();
  if (url) return url;
  return DEFAULT_IMAGES[type] || '';
}

function applyImageFields(target, body) {
  if (body.imageKey != null) {
    const key = String(body.imageKey).trim();
    target.imageKey = key;
    if (key) {
      target.imageUrl = '';
      return;
    }
  }
  if (body.imageUrl != null) {
    target.imageUrl = String(body.imageUrl).trim();
    if (!target.imageKey) target.imageKey = '';
  }
  if (body.imageKey === '') target.imageKey = '';
}

function stripeRaw(o) {
  return {
    enabled: o.stripe?.enabled || false,
    publishableKey: o.stripe?.publishableKey || '',
    secretKeySet: o.stripe?.secretKeySet || false,
    webhookSecretSet: o.stripe?.webhookSecretSet || false,
    imageUrl: o.stripe?.imageUrl || '',
    imageKey: o.stripe?.imageKey || '',
  };
}

function paypalRaw(o) {
  return {
    enabled: o.paypal?.enabled || false,
    clientId: o.paypal?.clientId || '',
    clientSecretSet: o.paypal?.clientSecretSet || false,
    mode: o.paypal?.mode || 'sandbox',
    imageUrl: o.paypal?.imageUrl || '',
    imageKey: o.paypal?.imageKey || '',
  };
}

async function stripeDetails(o) {
  const raw = stripeRaw(o);
  return {
    ...raw,
    imageUrl: await resolveImage(raw.imageUrl, raw.imageKey, 'stripe'),
  };
}

async function paypalDetails(o) {
  const raw = paypalRaw(o);
  return {
    ...raw,
    imageUrl: await resolveImage(raw.imageUrl, raw.imageKey, 'paypal'),
  };
}

async function bankDetails(bank) {
  if (!bank) return null;
  const plain = bank.toObject ? bank.toObject() : bank;
  return {
    ...plain,
    imageUrl: await resolveImage(plain.imageUrl, plain.imageKey, 'bank_transfer'),
  };
}

async function sanitizeForMerchant(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const bank = (o.bankAccounts || []).find((b) => b.isActive !== false) || o.bankAccounts?.[0];
  const bankOut = bank ? await bankDetails(bank) : null;
  return {
    bankAccounts: bankOut
      ? [{
        _id: bankOut._id,
        label: bankOut.label,
        bankName: bankOut.bankName,
        accountName: bankOut.accountName,
        accountNumber: bankOut.accountNumber,
        branch: bankOut.branch,
        swiftCode: bankOut.swiftCode,
        instructions: bankOut.instructions,
        imageUrl: bankOut.imageUrl,
      }]
      : [],
    stripe: {
      enabled: Boolean(o.stripe?.enabled && o.stripe?.publishableKey),
      publishableKey: o.stripe?.enabled ? o.stripe.publishableKey : '',
      imageUrl: await resolveImage(o.stripe?.imageUrl, o.stripe?.imageKey, 'stripe'),
    },
    paypal: {
      enabled: Boolean(o.paypal?.enabled && o.paypal?.clientId),
      clientId: o.paypal?.enabled ? o.paypal.clientId : '',
      mode: o.paypal?.mode || 'sandbox',
      imageUrl: await resolveImage(o.paypal?.imageUrl, o.paypal?.imageKey, 'paypal'),
    },
  };
}

async function sanitizeForSuperadmin(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const bank = await bankDetails(o.bankAccounts?.[0]);
  return {
    bankAccount: bank,
    stripe: await stripeDetails(o),
    paypal: await paypalDetails(o),
    hasBank: Boolean(o.bankAccounts?.[0]),
    paidAddonsEnabled: o.paidAddonsEnabled !== false,
  };
}

async function buildMethodsList(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const methods = [];
  const bank = o.bankAccounts?.[0];
  if (bank) {
    const b = await bankDetails(bank);
    methods.push({
      id: String(b._id),
      type: 'bank_transfer',
      name: b.label || b.bankName || 'Bank transfer',
      enabled: b.isActive !== false,
      configured: true,
      imageUrl: b.imageUrl,
      details: b,
    });
  }
  const stripe = await stripeDetails(o);
  methods.push({
    id: 'stripe',
    type: 'stripe',
    name: 'Stripe (card)',
    enabled: Boolean(o.stripe?.enabled),
    configured: Boolean(o.stripe?.publishableKey || o.stripe?.secretKeySet),
    imageUrl: stripe.imageUrl,
    details: stripe,
  });
  const paypal = await paypalDetails(o);
  methods.push({
    id: 'paypal',
    type: 'paypal',
    name: 'PayPal',
    enabled: Boolean(o.paypal?.enabled),
    configured: Boolean(o.paypal?.clientId || o.paypal?.clientSecretSet),
    imageUrl: paypal.imageUrl,
    details: paypal,
  });
  return methods;
}

router.post(
  '/logo',
  authenticateJWT,
  authorize('superadmin'),
  uploadIcon.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const type = String(req.body?.type || '').trim();
    if (!['stripe', 'paypal', 'bank_transfer'].includes(type)) {
      return res.status(400).json({ message: 'type must be stripe, paypal, or bank_transfer' });
    }
    try {
      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: req.file.originalname || 'payment-icon.webp',
        contentType: req.file.mimetype,
      });
      form.append('type', 'payment-icon');
      const token = req.headers.authorization;
      const uploadRes = await axios.post(
        `${process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002'}/upload`,
        form,
        {
          headers: { ...form.getHeaders(), Authorization: token },
          timeout: require('@innovapos/shared-middleware').resolveUploadProxyTimeoutMs(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );
      const { key } = uploadRes.data;
      const url = await presignObjectKey(key, 86400);
      res.json({ key, url });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

router.get('/merchant-options', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const Tenant = require('../models/Tenant');
    const { filterPaymentOptionsForMerchant } = require('../utils/merchantRegion');
    const doc = await getOrCreateSettings();
    const raw = await sanitizeForMerchant(doc);
    const tenant = await Tenant.findById(req.tenantId).select('countryIso').lean();
    res.json(filterPaymentOptionsForMerchant(raw, tenant?.countryIso));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/settings', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json(await sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/methods', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json(await buildMethodsList(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/stripe', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const { stripe } = req.body || {};
    if (stripe && typeof stripe === 'object') {
      doc.stripe.enabled = Boolean(stripe.enabled);
      if (stripe.publishableKey != null) doc.stripe.publishableKey = String(stripe.publishableKey).trim();
      applyImageFields(doc.stripe, stripe);
      if (stripe.secretKey) {
        doc.stripe.secretKey = String(stripe.secretKey).trim();
        doc.stripe.secretKeySet = true;
        process.env.STRIPE_SECRET_KEY = doc.stripe.secretKey;
      }
      if (stripe.webhookSecret) {
        doc.stripe.webhookSecret = String(stripe.webhookSecret).trim();
        doc.stripe.webhookSecretSet = true;
        process.env.STRIPE_WEBHOOK_SECRET = doc.stripe.webhookSecret;
      }
    }
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(await sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/paypal', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const { paypal } = req.body || {};
    if (paypal && typeof paypal === 'object') {
      doc.paypal.enabled = Boolean(paypal.enabled);
      if (paypal.clientId != null) doc.paypal.clientId = String(paypal.clientId).trim();
      applyImageFields(doc.paypal, paypal);
      if (paypal.clientSecret) {
        doc.paypal.clientSecret = String(paypal.clientSecret).trim();
        doc.paypal.clientSecretSet = true;
        process.env.PAYPAL_CLIENT_SECRET = doc.paypal.clientSecret;
      }
      if (paypal.mode) doc.paypal.mode = paypal.mode === 'live' ? 'live' : 'sandbox';
    }
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(await sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/bank-accounts', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    if (doc.bankAccounts?.length) {
      return res.status(400).json({ message: 'A bank transfer option already exists. Edit the existing one.' });
    }
    const b = req.body || {};
    doc.bankAccounts.push({
      label: String(b.label || '').trim(),
      bankName: String(b.bankName || '').trim(),
      accountName: String(b.accountName || '').trim(),
      accountNumber: String(b.accountNumber || '').trim(),
      branch: String(b.branch || '').trim(),
      swiftCode: String(b.swiftCode || '').trim(),
      instructions: String(b.instructions || '').trim(),
      imageUrl: String(b.imageUrl || '').trim(),
      imageKey: String(b.imageKey || '').trim(),
      isActive: b.isActive !== false,
    });
    if (doc.bankAccounts[doc.bankAccounts.length - 1].imageKey) {
      doc.bankAccounts[doc.bankAccounts.length - 1].imageUrl = '';
    }
    doc.updatedBy = req.user.id;
    await doc.save();
    res.status(201).json(await sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/bank-accounts/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const row = doc.bankAccounts.id(req.params.id);
    if (!row) return res.status(404).json({ message: 'Bank account not found' });
    const b = req.body || {};
    if (b.label != null) row.label = String(b.label).trim();
    if (b.bankName != null) row.bankName = String(b.bankName).trim();
    if (b.accountName != null) row.accountName = String(b.accountName).trim();
    if (b.accountNumber != null) row.accountNumber = String(b.accountNumber).trim();
    if (b.branch != null) row.branch = String(b.branch).trim();
    if (b.swiftCode != null) row.swiftCode = String(b.swiftCode).trim();
    if (b.instructions != null) row.instructions = String(b.instructions).trim();
    applyImageFields(row, b);
    if (b.isActive != null) row.isActive = Boolean(b.isActive);
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(await sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.delete('/bank-accounts/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const row = doc.bankAccounts.id(req.params.id);
    if (!row) return res.status(404).json({ message: 'Bank account not found' });
    row.deleteOne();
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(await sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// Toggle paid add-ons visibility to merchants
router.put('/paid-addons-enabled', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const { enabled } = req.body || {};
    doc.paidAddonsEnabled = enabled !== false;
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json({ paidAddonsEnabled: doc.paidAddonsEnabled });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
