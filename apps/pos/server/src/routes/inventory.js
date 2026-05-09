const express = require('express');
const Inventory = require('../models/Inventory');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const items = await Inventory.find({ tenantId: req.tenantId })
      .sort({ itemName: 1 })
      .populate('suppliers', 'name phone email');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const item = await Inventory.create({ ...req.body, tenantId: req.tenantId, createdBy: req.user.id });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, lastUpdated: Date.now(), updatedBy: req.user.id },
      { new: true, runValidators: true }
    ).populate('suppliers', 'name phone email');
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const item = await Inventory.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
