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

const getOrCreate = async (tenantId) => {
  let s = await TenantSettings.findOne({ tenantId });
  if (!s) {
    const tenant = await Tenant.findById(tenantId);
    s = await TenantSettings.create({
      tenantId,
      businessName: tenant?.businessName || '',
    });
  }
  return s;
};

// GET /tenant-settings — get current tenant's settings
router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || req.tenantId) : req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    res.json(await getOrCreate(tenantId));
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
      'primaryColor', 'accentColor', 'sidebarColor', 'textColor',
      'address', 'phone', 'email', 'website',
      'paymentMethods', 'currency', 'currencySymbol', 'timezone',
      'receiptHeader', 'receiptFooter', 'printReceiptByDefault',
    ];

    allowed.forEach(k => { if (req.body[k] !== undefined) s[k] = req.body[k]; });
    s.updatedBy = req.user.id;
    await s.save();

    // Sync businessName + branding to Tenant document
    if (req.body.businessName || req.body.logoUrl) {
      const update = {};
      if (req.body.businessName) update.businessName = req.body.businessName;
      if (req.body.logoUrl) { update['settings.logoUrl'] = req.body.logoUrl; update['settings.logoKey'] = req.body.logoKey || ''; }
      if (req.body.primaryColor) update['settings.primaryColor'] = req.body.primaryColor;
      if (req.body.accentColor) update['settings.accentColor'] = req.body.accentColor;
      if (req.body.paymentMethods) update['settings.paymentMethods'] = req.body.paymentMethods;
      await Tenant.findByIdAndUpdate(tenantId, update);
    }

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
