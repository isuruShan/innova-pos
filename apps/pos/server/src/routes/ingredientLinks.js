const express = require('express');
const IngredientLink = require('../models/IngredientLink');
const Inventory = require('../models/Inventory');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

/**
 * GET /ingredient-links?menuItemId=xxx
 * Get all ingredient links for a menu item (or all if no filter)
 */
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    if (req.query.menuItemId) {
      filter.menuItemId = req.query.menuItemId;
    }
    const links = await IngredientLink.find(filter)
      .populate('inventoryItemId', 'itemName unit quantity minThreshold lastCost wacCost fifoCost lifoCost')
      .sort({ createdAt: 1 });
    res.json(links);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /ingredient-links/by-menu-items
 * Bulk fetch ingredient links for multiple menu items
 * Query: ?ids=id1,id2,id3
 */
router.get('/by-menu-items', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (!ids.length) return res.json({});
    
    const links = await IngredientLink.find({
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
      menuItemId: { $in: ids },
    }).populate('inventoryItemId', 'itemName unit quantity minThreshold lastCost wacCost fifoCost lifoCost');
    
    // Group by menuItemId
    const grouped = {};
    for (const link of links) {
      const key = link.menuItemId.toString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(link);
    }
    res.json(grouped);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /ingredient-links
 * Create a new ingredient link
 */
router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) {
      return res.status(400).json({ message: 'No store available for ingredient link creation' });
    }

    const { menuItemId, inventoryItemId, quantity, unit, variantId, wastagePercentage } = req.body;
    
    if (!menuItemId || !inventoryItemId) {
      return res.status(400).json({ message: 'menuItemId and inventoryItemId are required' });
    }
    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ message: 'quantity must be a non-negative number' });
    }

    // Verify inventory item exists and belongs to tenant
    const invItem = await Inventory.findOne({
      _id: inventoryItemId,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    if (!invItem) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const link = await IngredientLink.create({
      tenantId: req.tenantId,
      storeId,
      menuItemId,
      variantId: variantId || null,
      inventoryItemId,
      quantity,
      wastagePercentage: typeof wastagePercentage === 'number' ? wastagePercentage : 0,
      unit: unit || invItem.unit,
      createdBy: req.user.id,
    });

    const populated = await IngredientLink.findById(link._id)
      .populate('inventoryItemId', 'itemName unit quantity minThreshold lastCost wacCost fifoCost lifoCost');

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'This ingredient is already linked to this menu item' });
    }
    sendRouteError(res, err, { req });
  }
});

/**
 * PUT /ingredient-links/:id
 * Update an ingredient link (mainly quantity/unit)
 */
router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { quantity, unit, wastagePercentage } = req.body;
    
    if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 0)) {
      return res.status(400).json({ message: 'quantity must be a non-negative number' });
    }

    const update = { updatedBy: req.user.id };
    if (quantity !== undefined) update.quantity = quantity;
    if (wastagePercentage !== undefined) update.wastagePercentage = wastagePercentage;
    if (unit !== undefined) update.unit = unit;

    const link = await IngredientLink.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      update,
      { new: true, runValidators: true }
    ).populate('inventoryItemId', 'itemName unit quantity minThreshold lastCost wacCost fifoCost lifoCost');

    if (!link) {
      return res.status(404).json({ message: 'Ingredient link not found' });
    }
    res.json(link);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * DELETE /ingredient-links/:id
 * Remove an ingredient link
 */
router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const link = await IngredientLink.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    if (!link) {
      return res.status(404).json({ message: 'Ingredient link not found' });
    }
    res.json({ message: 'Ingredient link removed' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * DELETE /ingredient-links/by-menu-item/:menuItemId
 * Remove all ingredient links for a menu item (useful when deleting menu item)
 */
router.delete('/by-menu-item/:menuItemId', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const result = await IngredientLink.deleteMany({
      menuItemId: req.params.menuItemId,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    res.json({ message: 'Ingredient links removed', deletedCount: result.deletedCount });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
