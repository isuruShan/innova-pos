const express = require('express');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

/**
 * POST /api/inventory/audit
 * Submit a stock audit physical count. Adjusts inventory levels and logs variances.
 */
router.post('/audit', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Missing or invalid items array' });
  }

  try {
    const storeId = await resolveWriteStoreId(req);
    const results = [];

    for (const auditItem of items) {
      const { inventoryItemId, physicalCount } = auditItem;

      if (!inventoryItemId || physicalCount === undefined || isNaN(physicalCount)) {
        continue;
      }

      // Fetch current inventory item
      const item = await Inventory.findOne({
        _id: inventoryItemId,
        tenantId: req.tenantId,
        storeId,
      });

      if (!item) {
        continue;
      }

      const previousQty = item.quantity;
      const parsedPhysicalCount = parseFloat(physicalCount);
      const variance = parsedPhysicalCount - previousQty;

      if (variance === 0) {
        // No variance, skip logging adjustment but add to results
        results.push({ inventoryItemId, previousQty, newQty: previousQty, variance: 0 });
        continue;
      }

      // Update inventory quantity
      item.quantity = parsedPhysicalCount;
      item.lastUpdated = Date.now();
      item.updatedBy = req.user.id;
      await item.save();

      // Log the Stock Movement adjustment
      await StockMovement.create({
        tenantId: req.tenantId,
        storeId,
        inventoryItemId,
        type: 'adjustment',
        quantity: Math.round(variance * 100) / 100,
        previousQty,
        newQty: parsedPhysicalCount,
        reason: 'count_correction',
        notes: `Stock audit count correction adjustment. Previous: ${previousQty}, Actual Physical: ${parsedPhysicalCount}`,
        createdBy: req.user.id,
      });

      results.push({
        inventoryItemId,
        itemName: item.itemName,
        previousQty,
        newQty: parsedPhysicalCount,
        variance,
      });
    }

    res.json({
      message: 'Stock audit completed successfully',
      results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
