const express = require('express');
const TenantSettings = require('../models/TenantSettings');
const Tenant = require('../models/Tenant');
const { authenticateJWT, authorize, tenantScope, emitAudit } = require('@innovapos/shared-middleware');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

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
    s = await TenantSettings.create({
      tenantId,
      businessName: tenant?.businessName || '',
      currency: dc.currency,
      currencySymbol: dc.currencySymbol,
    });
  }
  return s;
};

async function attachFreshLogoUrl(settingsDoc, req) {
  const plain = settingsDoc.toObject ? settingsDoc.toObject() : { ...settingsDoc };
  if (!plain.logoKey) return plain;
  try {
    const uploadUrl = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002';
    const { data } = await axios.post(
      `${uploadUrl}/upload/presign`,
      { key: plain.logoKey, expiresIn: 86400 },
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    if (data?.url) plain.logoUrl = data.url;
  } catch {
    // keep stored logoUrl (may be expired presigned URL)
  }
  return plain;
}

// GET /tenant-settings — get current tenant's settings
router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || req.tenantId) : req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    const s = await getOrCreate(tenantId);
    res.json(await attachFreshLogoUrl(s, req));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /tenant-settings — update branding, colors, payment methods etc.
router.put('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
    const s = await getOrCreate(tenantId);
    const before = s.toObject();

    const allowed = [
      'businessName', 'tagline', 'logoUrl', 'logoKey', 'faviconUrl',
      'primaryColor', 'accentColor', 'sidebarColor', 'textColor', 'selectionTextColor',
      'address', 'phone', 'email', 'website',
      'paymentMethods', 'currency', 'currencySymbol', 'timezone',
      'receiptHeader', 'receiptFooter', 'printReceiptByDefault', 'receiptPrintAtStatus',
    ];

    allowed.forEach(k => { if (req.body[k] !== undefined) s[k] = req.body[k]; });
    s.updatedBy = req.user.id;
    await s.save();

    // Sync branding fields to Tenant document for downstream consumers
    const tenantBrandingUpdate = {};
    if (req.body.businessName !== undefined) tenantBrandingUpdate.businessName = req.body.businessName;
    if (req.body.logoUrl !== undefined) {
      tenantBrandingUpdate['settings.logoUrl'] = req.body.logoUrl;
      tenantBrandingUpdate['settings.logoKey'] = req.body.logoKey || '';
    }
    if (req.body.primaryColor !== undefined) tenantBrandingUpdate['settings.primaryColor'] = req.body.primaryColor;
    if (req.body.accentColor !== undefined) tenantBrandingUpdate['settings.accentColor'] = req.body.accentColor;
    if (req.body.sidebarColor !== undefined) tenantBrandingUpdate['settings.sidebarColor'] = req.body.sidebarColor;
    if (req.body.textColor !== undefined) tenantBrandingUpdate['settings.textColor'] = req.body.textColor;
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
    res.status(500).json({ message: err.message });
  }
});

// POST /tenant-settings/logo — upload logo
router.post('/logo', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope,
  uploadLogo.single('logo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: req.file.originalname || 'logo.webp',
        contentType: req.file.mimetype,
      });
      form.append('type', 'logo');
      const token = req.headers.authorization;
      const uploadRes = await axios.post(
        `${process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002'}/upload`,
        form,
        { headers: { ...form.getHeaders(), Authorization: token }, timeout: 30000 }
      );
      const { key, url } = uploadRes.data;

      const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
      const s = await getOrCreate(tenantId);
      s.logoUrl = url;
      s.logoKey = key;
      s.updatedBy = req.user.id;
      await s.save();
      await Tenant.findByIdAndUpdate(tenantId, { 'settings.logoUrl': url, 'settings.logoKey': key });

      res.json({ url, key });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
