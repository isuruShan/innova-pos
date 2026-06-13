const express = require('express');
const WastageReport = require('../models/WastageReport');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

// GET all wastage reports
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const reports = await WastageReport.find(filter)
      .populate('items.inventoryItemId', 'itemName unit')
      .populate({
        path: 'items.menuItemId',
        select: 'name variants'
      })
      .populate('createdBy', 'name')
      .sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST log a wastage report
router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for wastage logging' });

    const { date = new Date(), type = 'spill_expiry_damage', notes = '', items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one wastage item is required' });
    }

    // Validate items exist and quantities are valid
    for (const item of items) {
      if (item.itemType === 'menu') {
        const MenuItem = require('../models/MenuItem');
        const menu = await MenuItem.findOne({ _id: item.menuItemId, tenantId: req.tenantId });
        if (!menu) {
          return res.status(400).json({ message: `Menu item ${item.menuItemId} not found` });
        }
        if (item.quantity <= 0) {
          return res.status(400).json({ message: 'Wastage quantity must be greater than 0' });
        }
      } else {
        const inv = await Inventory.findOne({ _id: item.inventoryItemId, tenantId: req.tenantId, storeId });
        if (!inv) {
          return res.status(400).json({ message: `Inventory item ${item.inventoryItemId} not found` });
        }
        if (item.quantity <= 0) {
          return res.status(400).json({ message: 'Wastage quantity must be greater than 0' });
        }
      }
    }

    const report = await WastageReport.create({
      tenantId: req.tenantId,
      storeId,
      date,
      type,
      notes,
      items,
      createdBy: req.user.id
    });

    // Reduce inventory stock levels and create StockMovement records
    for (const item of items) {
      if (item.itemType === 'menu') {
        const IngredientLink = require('../models/IngredientLink');
        let links = await IngredientLink.find({
          tenantId: req.tenantId,
          menuItemId: item.menuItemId,
          variantId: item.variantId || null
        }).lean();

        if (links.length === 0 && item.variantId) {
          links = await IngredientLink.find({
            tenantId: req.tenantId,
            menuItemId: item.menuItemId,
            variantId: null
          }).lean();
        }

        for (const link of links) {
          const inventoryItemId = link.inventoryItemId;

          const baseQty = link.quantity * item.quantity;
          const wasteQty = baseQty * ((link.wastagePercentage || 0) / 100);
          const totalQty = baseQty + wasteQty;

          if (totalQty <= 0) continue;

          const invItem = await Inventory.findOne({ _id: inventoryItemId, tenantId: req.tenantId, storeId });
          if (!invItem) continue;

          const previousQty = invItem.quantity;
          invItem.quantity = Math.max(0, previousQty - totalQty);
          await invItem.save();

          await StockMovement.create({
            tenantId: req.tenantId,
            storeId,
            inventoryItemId,
            type: 'waste',
            quantity: -totalQty,
            previousQty,
            newQty: invItem.quantity,
            reason: item.reason,
            notes: `Wastage Report logged for menu item. Notes: ${notes}`,
            createdBy: req.user.id
          });
        }
      } else {
        const inv = await Inventory.findOne({ _id: item.inventoryItemId, tenantId: req.tenantId, storeId });
        const previousQty = inv.quantity;
        
        inv.quantity = Math.max(0, previousQty - item.quantity);
        await inv.save();

        await StockMovement.create({
          tenantId: req.tenantId,
          storeId,
          inventoryItemId: item.inventoryItemId,
          type: 'waste',
          quantity: -item.quantity,
          previousQty,
          newQty: inv.quantity,
          reason: item.reason,
          notes: `Wastage Report logged. Notes: ${notes}`,
          createdBy: req.user.id
        });
      }
    }

    const populated = await WastageReport.findById(report._id)
      .populate('items.inventoryItemId', 'itemName unit')
      .populate({
        path: 'items.menuItemId',
        select: 'name variants'
      })
      .populate('createdBy', 'name');

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
