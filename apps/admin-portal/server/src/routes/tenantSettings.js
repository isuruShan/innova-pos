const express = require('express');
const TenantSettings = require('../models/TenantSettings');
const Tenant = require('../models/Tenant');
const { authenticateJWT, authorize, tenantScope, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { presignObjectKey } = require('../utils/s3Runtime');
const { proxyUploadToService } = require('../lib/uploadProxy');
const { getPreset, listPresets } = require('@innovapos/pos-theme-presets');
const { validateEmail } = require('@innovapos/form-validation');

function validateBrandingPayload(body) {
  if (!String(body.businessName || '').trim()) return 'Business name is required';
  if (!String(body.address || '').trim()) return 'Address is required';
  if (!String(body.phone || '').trim()) return 'Phone is required';
  const email = String(body.email || '').trim();
  if (email && !validateEmail(email)) return 'Enter a valid email address';
  return null;
}

async function bootstrapFromApplication(tenantId, settingsDoc) {
  const needsFill =
    !String(settingsDoc.phone || '').trim()
    || !String(settingsDoc.email || '').trim()
    || !String(settingsDoc.address || '').trim();
  if (!needsFill) return settingsDoc;

  const MerchantApplication = require('../models/MerchantApplication');
  const { formatStoreAddressFromApplication } = require('../lib/storeProvisioning');
  const app = await MerchantApplication.findOne({ tenantId, status: 'approved' })
    .sort({ reviewedAt: -1 })
    .lean();
  if (!app) return settingsDoc;

  let changed = false;
  if (!String(settingsDoc.phone || '').trim() && app.personal?.mobile) {
    settingsDoc.phone = String(app.personal.mobile).trim();
    changed = true;
  }
  if (!String(settingsDoc.email || '').trim() && app.personal?.email) {
    settingsDoc.email = String(app.personal.email).trim().toLowerCase();
    changed = true;
  }
  if (!String(settingsDoc.address || '').trim() && app.business) {
    settingsDoc.address = formatStoreAddressFromApplication(app.business);
    changed = true;
  }
  if (!String(settingsDoc.businessName || '').trim() && app.business?.name) {
    settingsDoc.businessName = String(app.business.name).trim();
    changed = true;
  }
  if (changed) {
    await settingsDoc.save();
  }
  return settingsDoc;
}

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const LOGO_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    LOGO_IMAGE_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Logo must be JPEG, PNG, or WebP'));
  },
});

function defaultCurrencyForTenant(tenant) {
  const iso = String(tenant?.countryIso || 'LK').toUpperCase();
  if (iso === 'LK') return { currency: 'LKR', currencySymbol: 'Rs.' };
  return { currency: 'USD', currencySymbol: '$' };
}

const getOrCreate = async (tenantId) => {
  let s = await TenantSettings.findOne({ tenantId });
  if (!s) {
    const tenant = await Tenant.findById(tenantId);
    const dc = defaultCurrencyForTenant(tenant);
    const themePreset = getPreset('default');
    s = await TenantSettings.create({
      tenantId,
      businessName: tenant?.businessName || '',
      ...themePreset,
      currency: dc.currency,
      currencySymbol: dc.currencySymbol,
      receiptPrintAtByOrderType: {
        'dine-in': 'completed',
        takeaway: 'placement',
        'uber-eats': 'placement',
        pickme: 'placement',
      },
    });
  }
  return s;
};

async function attachFreshLogoUrl(settingsDoc, req) {
  const plain = settingsDoc.toObject ? settingsDoc.toObject() : { ...settingsDoc };
  if (!plain.logoKey) return plain;
  const url = await presignObjectKey(plain.logoKey, 86400);
  if (url) plain.logoUrl = url;
  return plain;
}

// GET /tenant-settings — get current tenant's settings
router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || req.tenantId) : req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    let s = await getOrCreate(tenantId);
    s = await bootstrapFromApplication(tenantId, s);
    const tenant = await Tenant.findById(tenantId).select('countryIso').lean();
    const plain = await attachFreshLogoUrl(s, req);
    plain.countryIso = (tenant?.countryIso || 'LK').toUpperCase();
    res.json(plain);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT /tenant-settings — update branding, colors, payment methods etc.
router.put('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
    const validationMsg = validateBrandingPayload(req.body);
    if (validationMsg) return res.status(400).json({ message: validationMsg });

    const s = await getOrCreate(tenantId);
    const before = s.toObject();

    const allowed = [
      'businessName', 'logoKey', 'faviconUrl',
      'themePresetId', 'themePresetName', 'themeBaseColor',
      'bodyColor', 'headerBarColor', 'buttonColor', 'selectionHighlightColor', 'hoverColor',
      'buttonTextColor', 'headerBarTextColor', 'bodyTextColor',
      'primaryColor', 'accentColor', 'sidebarColor', 'textColor', 'selectionTextColor',
      'address', 'phone', 'email', 'website',
      'paymentMethods', 'currency', 'currencySymbol', 'timezone',
      'receiptHeader', 'receiptFooter', 'printReceiptByDefault', 'receiptPrintAtStatus', 'receiptPrintAtByOrderType',
      'returnsEnabled', 'returnsRequireManagerApproval',
    ];

    allowed.forEach(k => { if (req.body[k] !== undefined) s[k] = req.body[k]; });
    s.updatedBy = req.user.id;
    await s.save();

    // Sync branding fields to Tenant document for downstream consumers
    const tenantBrandingUpdate = {};
    if (req.body.businessName !== undefined) tenantBrandingUpdate.businessName = req.body.businessName;
    if (req.body.logoKey !== undefined) {
      tenantBrandingUpdate['settings.logoUrl'] = '';
      tenantBrandingUpdate['settings.logoKey'] = req.body.logoKey || '';
    }
    const themeKeys = [
      'bodyColor', 'headerBarColor', 'buttonColor', 'selectionHighlightColor', 'hoverColor',
      'buttonTextColor', 'headerBarTextColor', 'bodyTextColor', 'selectionTextColor',
      'primaryColor', 'accentColor', 'sidebarColor', 'textColor', 'themePresetId', 'themeBaseColor',
    ];
    for (const k of themeKeys) {
      if (req.body[k] !== undefined) tenantBrandingUpdate[`settings.${k}`] = req.body[k];
    }
    if (req.body.paymentMethods !== undefined) tenantBrandingUpdate['settings.paymentMethods'] = req.body.paymentMethods;
    if (Object.keys(tenantBrandingUpdate).length) await Tenant.findByIdAndUpdate(tenantId, tenantBrandingUpdate);

    await emitAudit({
      req,
      action: 'TENANT_SETTINGS_UPDATED',
      resource: 'TenantSettings',
      resourceId: s._id,
      changes: { before: before, after: s.toObject() },
    });

    res.json(s);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/theme-presets', authenticateJWT, authorize('merchant_admin', 'superadmin'), (_req, res) => {
  res.json(listPresets());
});

router.post('/apply-theme-preset', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const presetId = String(req.body.presetId || 'default').trim();
    const preset = getPreset(presetId);
    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
    const s = await getOrCreate(tenantId);
    Object.assign(s, preset);
    s.updatedBy = req.user.id;
    await s.save();

    const tenantBrandingUpdate = { businessName: s.businessName };
    for (const k of [
      'bodyColor', 'headerBarColor', 'buttonColor', 'selectionHighlightColor', 'hoverColor',
      'buttonTextColor', 'headerBarTextColor', 'bodyTextColor', 'selectionTextColor',
      'primaryColor', 'accentColor', 'sidebarColor', 'textColor', 'themePresetId', 'themeBaseColor',
    ]) {
      tenantBrandingUpdate[`settings.${k}`] = s[k];
    }
    await Tenant.findByIdAndUpdate(tenantId, tenantBrandingUpdate);

    const plain = await attachFreshLogoUrl(s, req);
    res.json(plain);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /tenant-settings/logo — upload logo
router.post('/logo', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope,
  uploadLogo.single('logo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
      const uploaded = await proxyUploadToService({
        buffer: req.file.buffer,
        filename: req.file.originalname || 'logo.webp',
        mimetype: req.file.mimetype,
        type: 'logo',
        authorization: req.headers.authorization,
      });
      const { key } = uploaded;

      const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
      const s = await getOrCreate(tenantId);
      s.logoUrl = '';
      s.logoKey = key;
      s.updatedBy = req.user.id;
      await s.save();
      await Tenant.findByIdAndUpdate(tenantId, { 'settings.logoUrl': '', 'settings.logoKey': key });

      const freshUrl = await presignObjectKey(key, 86400);
      res.json({ url: freshUrl, key });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      sendRouteError(res, err, { req });
    }
  }
);

// DELETE /tenant-settings/logo — remove logo
router.delete('/logo', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
    const s = await getOrCreate(tenantId);
    s.logoUrl = '';
    s.logoKey = '';
    s.updatedBy = req.user.id;
    await s.save();
    await Tenant.findByIdAndUpdate(tenantId, { 'settings.logoUrl': '', 'settings.logoKey': '' });
    
    logger.info('Logo removed successfully', { tenantId });
    res.json({ message: 'Logo removed successfully' });
  } catch (err) {
    logger.error('Logo removal failed', { error: err.message });
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
