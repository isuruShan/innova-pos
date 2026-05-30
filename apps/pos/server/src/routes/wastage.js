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
      const inv = await Inventory.findOne({ _id: item.inventoryItemId, tenantId: req.tenantId, storeId });
      if (!inv) {
        return res.status(400).json({ message: `Inventory item ${item.inventoryItemId} not found` });
      }
      if (item.quantity <= 0) {
        return res.status(400).json({ message: 'Wastage quantity must be greater than 0' });
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

    const populated = await WastageReport.findById(report._id)
      .populate('items.inventoryItemId', 'itemName unit')
      .populate('createdBy', 'name');

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
