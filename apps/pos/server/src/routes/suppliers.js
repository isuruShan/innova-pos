const express = require('express');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ tenantId: req.tenantId }).sort({ name: 1 }).lean();
    const ids = suppliers.map(s => s._id);
    const items = await Inventory.find({ tenantId: req.tenantId, suppliers: { $in: ids } }, 'suppliers').lean();
    const countMap = {};
    items.forEach(item => {
      item.suppliers.forEach(sid => {
        const key = sid.toString();
        countMap[key] = (countMap[key] || 0) + 1;
      });
    });
    res.json(suppliers.map(s => ({ ...s, itemCount: countMap[s._id.toString()] || 0 })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    const items = await Inventory.find(
      { tenantId: req.tenantId, suppliers: req.params.id },
      'itemName unit quantity minThreshold'
    );
    res.json({ ...supplier.toObject(), items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const supplier = await Supplier.create({ ...req.body, tenantId: req.tenantId, createdBy: req.user.id });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    await Inventory.updateMany(
      { tenantId: req.tenantId, suppliers: req.params.id },
      { $pull: { suppliers: req.params.id } }
    );
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
