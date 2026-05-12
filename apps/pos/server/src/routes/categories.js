const express = require('express');
const Category = require('../models/Category');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { all } = req.query;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    if (all !== 'true') filter.active = true;
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
    res.json(categories);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for category creation' });
    const category = await Category.create({
      name: name.trim(),
      sortOrder: sortOrder || 0,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
    });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, active, sortOrder } = req.body;
    const update = { updatedBy: req.user.id };
    if (name !== undefined) update.name = name.trim();
    if (active !== undefined) update.active = active;
    if (sortOrder !== undefined) update.sortOrder = sortOrder;

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
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

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
