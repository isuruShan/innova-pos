const express = require('express');
const FoodmarketPartner = require('../models/FoodmarketPartner');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const multer = require('multer');
const { proxyUploadToService } = require('../lib/uploadProxy');

const router = express.Router();

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Logo must be JPEG, PNG, or WebP'));
  },
});

// Helper to seed default partners
async function seedDefaultPartners(tenantId) {
  const defaults = [
    { name: 'Uber Eats', commissionType: 'percentage', commissionPercentage: 30, commissionFlat: 0, isActive: true },
    { name: 'PickMe', commissionType: 'percentage', commissionPercentage: 20, commissionFlat: 0, isActive: true }
  ];
  for (const d of defaults) {
    const exists = await FoodmarketPartner.findOne({ tenantId, name: { $regex: new RegExp(`^${d.name}$`, 'i') } });
    if (!exists) {
      await FoodmarketPartner.create({ ...d, tenantId });
    }
  }
}

// GET all foodmarket partners (seeds if none exist)
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    await seedDefaultPartners(req.tenantId);
    const partners = await FoodmarketPartner.find({ tenantId: req.tenantId }).sort({ name: 1 });
    res.json(partners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a partner
router.post('/', protect, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, commissionType, commissionFlat, commissionPercentage, isActive, logoUrl, logoKey, icon, color } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    
    const dup = await FoodmarketPartner.findOne({ tenantId: req.tenantId, name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (dup) return res.status(400).json({ message: 'A partner with this name already exists' });

    const partner = await FoodmarketPartner.create({
      tenantId: req.tenantId,
      name: name.trim(),
      commissionType: commissionType || 'percentage',
      commissionFlat: commissionFlat || 0,
      commissionPercentage: commissionPercentage || 0,
      isActive: isActive !== false,
      logoUrl: logoUrl || '',
      logoKey: logoKey || '',
      icon: icon || '🛵',
      color: color || '#10b981',
    });
    res.status(201).json(partner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update a partner
router.put('/:id', protect, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, commissionType, commissionFlat, commissionPercentage, isActive, logoUrl, logoKey, icon, color } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (commissionType) update.commissionType = commissionType;
    if (commissionFlat !== undefined) update.commissionFlat = commissionFlat;
    if (commissionPercentage !== undefined) update.commissionPercentage = commissionPercentage;
    if (isActive !== undefined) update.isActive = isActive;
    if (logoUrl !== undefined) update.logoUrl = logoUrl;
    if (logoKey !== undefined) update.logoKey = logoKey;
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;

    const partner = await FoodmarketPartner.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!partner) return res.status(404).json({ message: 'Partner not found' });
    res.json(partner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a partner
router.delete('/:id', protect, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const partner = await FoodmarketPartner.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!partner) return res.status(404).json({ message: 'Partner not found' });
    res.json({ message: 'Partner deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /foodmarket-partners/logo — upload partner logo
router.post('/logo', protect, authorize('merchant_admin', 'superadmin'), tenantScope,
  uploadLogo.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
      const uploaded = await proxyUploadToService({
        buffer: req.file.buffer,
        filename: req.file.originalname || 'partner-logo.webp',
        mimetype: req.file.mimetype,
        type: 'partner-logo',
        authorization: req.headers.authorization,
      });
      
      res.json({ url: uploaded.url, key: uploaded.key });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      res.status(500).json({ message: err.message || 'Upload failed' });
    }
  }
);

module.exports = router;
