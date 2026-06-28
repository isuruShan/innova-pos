const express = require('express');
const InventoryCountSession = require('../../../../../apps/admin-portal/server/src/models/InventoryCountSession');
const Inventory = require('../../../../../apps/admin-portal/server/src/models/Inventory');
const { protect, tenantScope } = require('../middleware/auth');

const router = express.Router();

// Get list of all closed audits (count sessions) at the Central Kitchen with variance summaries
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const ckId = req.headers['x-store-id'];
    if (!ckId) {
      return res.status(400).json({ message: 'Central Kitchen ID context is required' });
    }

    const sessions = await InventoryCountSession.find({
      tenantId: req.tenantId,
      storeId: ckId,
      status: 'closed',
    })
      .populate('userId', 'name')
      .populate('countSheetId', 'name')
      .sort({ endedAt: -1 })
      .lean();

    const formattedSessions = sessions.map(session => {
      let totalItems = 0;
      let totalVarianceQty = 0;
      let totalVarianceCost = 0;
      let totalPositiveVarianceCost = 0;
      let totalNegativeVarianceCost = 0;

      (session.items || []).forEach(item => {
        if (item.countedQty !== null) {
          totalItems++;
          const variance = item.countedQty - item.theoreticalQty;
          totalVarianceQty += variance;
          const cost = variance * (item.costPrice || 0);
          totalVarianceCost += cost;
          if (cost > 0) {
            totalPositiveVarianceCost += cost;
          } else {
            totalNegativeVarianceCost += Math.abs(cost);
          }
        }
      });

      return {
        _id: session._id,
        countSheetName: session.countSheetId?.name || 'Quick Audit',
        user: session.userId?.name || 'System',
        notes: session.notes || '',
        createdAt: session.createdAt,
        endedAt: session.endedAt,
        metrics: {
          totalItems,
          totalVarianceQty,
          totalVarianceCost,
          positiveVarianceCost: totalPositiveVarianceCost,
          negativeVarianceCost: totalNegativeVarianceCost,
        }
      };
    });

    res.json(formattedSessions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve variance analytics list', error: err.message });
  }
});

// Get detailed item-by-item variance analysis for a single closed count session
router.get('/:sessionId', protect, tenantScope, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await InventoryCountSession.findOne({
      _id: sessionId,
      tenantId: req.tenantId,
      status: 'closed',
    })
      .populate('userId', 'name')
      .populate('countSheetId', 'name')
      .lean();

    if (!session) {
      return res.status(404).json({ message: 'Audit session not found or not closed yet' });
    }

    // Populate item names and details from Inventory
    const itemIds = session.items.map(i => i.inventoryItemId);
    const dbItems = await Inventory.find({ _id: { $in: itemIds } }).select('_id itemName unit').lean();
    const itemMap = new Map(dbItems.map(i => [String(i._id), i]));

    const itemsWithVariance = session.items.map(item => {
      const dbItem = itemMap.get(String(item.inventoryItemId));
      const variance = (item.countedQty !== null) ? (item.countedQty - item.theoreticalQty) : 0;
      const varianceCost = variance * (item.costPrice || 0);

      return {
        inventoryItemId: item.inventoryItemId,
        itemName: dbItem?.itemName || 'Unknown Item',
        unit: dbItem?.unit || 'pcs',
        theoreticalQty: item.theoreticalQty,
        countedQty: item.countedQty,
        costPrice: item.costPrice || 0,
        variance,
        varianceCost,
        percentageDiscrepancy: item.theoreticalQty > 0 
          ? Number(((variance / item.theoreticalQty) * 100).toFixed(2))
          : variance > 0 ? 100 : 0
      };
    });

    res.json({
      _id: session._id,
      countSheetName: session.countSheetId?.name || 'Quick Audit',
      user: session.userId?.name || 'System',
      notes: session.notes || '',
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      items: itemsWithVariance
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve detailed variance report', error: err.message });
  }
});

module.exports = router;
