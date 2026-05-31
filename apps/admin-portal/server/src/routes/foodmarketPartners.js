const express = require('express');
const FoodmarketPartner = require('../models/FoodmarketPartner');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

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
    const { name, commissionType, commissionFlat, commissionPercentage, isActive } = req.body;
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
    });
    res.status(201).json(partner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update a partner
router.put('/:id', protect, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, commissionType, commissionFlat, commissionPercentage, isActive } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (commissionType) update.commissionType = commissionType;
    if (commissionFlat !== undefined) update.commissionFlat = commissionFlat;
    if (commissionPercentage !== undefined) update.commissionPercentage = commissionPercentage;
    if (isActive !== undefined) update.isActive = isActive;

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

module.exports = router;
