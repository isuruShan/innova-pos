const express = require('express');
const InventoryCategory = require('../models/InventoryCategory');
const Inventory = require('../models/Inventory');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

// GET /api/inventory-categories
router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const categories = await InventoryCategory.find(filter).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /api/inventory-categories
router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const storeId = await resolveWriteStoreId(req);
    if (!storeId) {
      return res.status(400).json({ error: 'No store available for category creation' });
    }

    const category = await InventoryCategory.create({
      tenantId: req.tenantId,
      storeId,
      name: name.trim(),
      description: description || '',
      createdBy: req.user.id,
    });

    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/inventory-categories/:id
router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, description } = req.body;
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };

    const category = await InventoryCategory.findOne(filter);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      category.name = name.trim();
    }
    if (description !== undefined) {
      category.description = description;
    }
    category.updatedBy = req.user.id;

    await category.save();
    res.json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/inventory-categories/:id
router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };
    const category = await InventoryCategory.findOne(filter);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Set category reference to null on all associated inventory items
    await Inventory.updateMany(
      { tenantId: req.tenantId, category: category._id },
      { $set: { category: null } }
    );

    await InventoryCategory.findOneAndDelete({ _id: category._id });

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
