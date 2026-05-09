const express = require('express');
const Promotion = require('../models/Promotion');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.active === 'true') {
      const now = new Date();
      filter.active = true;
      filter.startDate = { $lte: now };
      filter.endDate = { $gte: now };
    }
    const promotions = await Promotion.find(filter).sort({ createdAt: -1 });
    res.json(promotions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, tenantScope, async (req, res) => {
  try {
    const p = await Promotion.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!p) return res.status(404).json({ message: 'Promotion not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const promo = await Promotion.create({ ...req.body, tenantId: req.tenantId, createdBy: req.user.id });
    res.status(201).json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const promo = await Promotion.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
