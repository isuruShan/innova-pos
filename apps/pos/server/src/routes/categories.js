const express = require('express');
const Category = require('../models/Category');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const { all } = req.query;
    const filter = { tenantId: req.tenantId };
    if (all !== 'true') filter.active = true;
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });
    const category = await Category.create({
      name: name.trim(),
      sortOrder: sortOrder || 0,
      tenantId: req.tenantId,
      createdBy: req.user.id,
    });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, active, sortOrder } = req.body;
    const update = { updatedBy: req.user.id };
    if (name !== undefined) update.name = name.trim();
    if (active !== undefined) update.active = active;
    if (sortOrder !== undefined) update.sortOrder = sortOrder;

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      update,
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category name already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
