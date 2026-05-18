const express = require('express');
const PlatformPaymentSettings = require('../models/PlatformPaymentSettings');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

async function getOrCreateSettings() {
  let doc = await PlatformPaymentSettings.findOne({ singletonKey: 'default' });
  if (!doc) {
    doc = await PlatformPaymentSettings.create({ singletonKey: 'default' });
  }
  return doc;
}

function sanitizeForMerchant(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    bankAccounts: (o.bankAccounts || []).filter((b) => b.isActive !== false).map((b) => ({
      _id: b._id,
      label: b.label,
      bankName: b.bankName,
      accountName: b.accountName,
      accountNumber: b.accountNumber,
      branch: b.branch,
      swiftCode: b.swiftCode,
      instructions: b.instructions,
    })),
    stripe: {
      enabled: Boolean(o.stripe?.enabled && o.stripe?.publishableKey),
      publishableKey: o.stripe?.enabled ? o.stripe.publishableKey : '',
    },
    paypal: {
      enabled: Boolean(o.paypal?.enabled && o.paypal?.clientId),
      clientId: o.paypal?.enabled ? o.paypal.clientId : '',
      mode: o.paypal?.mode || 'sandbox',
    },
  };
}

function sanitizeForSuperadmin(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ...o,
    stripe: {
      enabled: o.stripe?.enabled || false,
      publishableKey: o.stripe?.publishableKey || '',
      secretKeySet: o.stripe?.secretKeySet || false,
      webhookSecretSet: o.stripe?.webhookSecretSet || false,
    },
    paypal: {
      enabled: o.paypal?.enabled || false,
      clientId: o.paypal?.clientId || '',
      clientSecretSet: o.paypal?.clientSecretSet || false,
      mode: o.paypal?.mode || 'sandbox',
    },
  };
}

router.get('/merchant-options', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json(sanitizeForMerchant(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/settings', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json(sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/settings', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const { bankAccounts, stripe, paypal } = req.body || {};

    if (Array.isArray(bankAccounts)) {
      doc.bankAccounts = bankAccounts.map((b) => ({
        label: String(b.label || '').trim(),
        bankName: String(b.bankName || '').trim(),
        accountName: String(b.accountName || '').trim(),
        accountNumber: String(b.accountNumber || '').trim(),
        branch: String(b.branch || '').trim(),
        swiftCode: String(b.swiftCode || '').trim(),
        instructions: String(b.instructions || '').trim(),
        isActive: b.isActive !== false,
        _id: b._id || undefined,
      })).filter((b) => b.label && b.bankName && b.accountName && b.accountNumber);
    }

    if (stripe && typeof stripe === 'object') {
      doc.stripe.enabled = Boolean(stripe.enabled);
      if (stripe.publishableKey != null) doc.stripe.publishableKey = String(stripe.publishableKey).trim();
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

    if (paypal && typeof paypal === 'object') {
      doc.paypal.enabled = Boolean(paypal.enabled);
      if (paypal.clientId != null) doc.paypal.clientId = String(paypal.clientId).trim();
      if (paypal.clientSecret) {
        doc.paypal.clientSecret = String(paypal.clientSecret).trim();
        doc.paypal.clientSecretSet = true;
        process.env.PAYPAL_CLIENT_SECRET = doc.paypal.clientSecret;
      }
      if (paypal.mode) doc.paypal.mode = paypal.mode === 'live' ? 'live' : 'sandbox';
    }

    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(sanitizeForSuperadmin(doc));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
