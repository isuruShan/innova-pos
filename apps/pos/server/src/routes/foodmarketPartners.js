const express = require('express');
const FoodmarketPartner = require('../models/FoodmarketPartner');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

const { presignObjectKey } = require('../utils/s3Runtime');

// Helper to resolve partner logoKey to fresh presigned logoUrl
async function resolvePartnerLogo(partner) {
  if (!partner) return null;
  const doc = partner.toObject ? partner.toObject() : partner;
  if (doc.logoKey) {
    try {
      doc.logoUrl = await presignObjectKey(doc.logoKey, 86400); // 24-hour expiry
    } catch (err) {
      // ignore
    }
  }
  return doc;
}

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
    const enriched = await Promise.all(partners.map(p => resolvePartnerLogo(p)));
    res.json(enriched);
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
    const enriched = await resolvePartnerLogo(partner);
    res.status(201).json(enriched);
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
    const enriched = await resolvePartnerLogo(partner);
    res.json(enriched);
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

module.exports = router;
