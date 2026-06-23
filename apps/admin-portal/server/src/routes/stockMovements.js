const express = require('express');
const mongoose = require('mongoose');
const StockMovement = require('../models/StockMovement');
const InventorySession = require('../models/InventorySession');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

/**
 * GET /stock-movements
 * Get stock movement audit log with filters
 */
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };

    // Filters
    if (req.query.inventoryItemId) {
      filter.inventoryItemId = req.query.inventoryItemId;
    }
    if (req.query.sessionId) {
      filter.sessionId = req.query.sessionId;
    }
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.createdBy) {
      filter.createdBy = req.query.createdBy;
    }

    // Date range filter
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        filter.createdAt.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        filter.createdAt.$lte = new Date(req.query.to);
      }
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const movements = await StockMovement.find(filter)
      .populate('inventoryItemId', 'itemName unit')
      .populate('createdBy', 'name email')
      .populate('sessionId', 'userId startedAt endedAt')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(movements);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /stock-movements/by-item/:inventoryId
 * Get movement history for a specific inventory item
 */
router.get('/by-item/:inventoryId', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const movements = await StockMovement.find({
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
      inventoryItemId: req.params.inventoryId,
    })
      .populate('createdBy', 'name email')
      .populate('sessionId', 'userId startedAt endedAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(movements);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /stock-movements/by-session/:sessionId
 * Get all movements for a specific session (handles mock movements during active draft sessions)
 */
router.get('/by-session/:sessionId', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const session = await InventorySession.findOne({
      _id: req.params.sessionId,
      tenantId: req.tenantId,
    }).populate('adjustments.inventoryItemId', 'itemName unit quantity minThreshold');

    if (session && session.status === 'active') {
      const mockMovements = session.adjustments.map(adj => ({
        _id: adj._id || new mongoose.Types.ObjectId(),
        inventoryItemId: adj.inventoryItemId,
        quantity: adj.quantity,
        previousQty: adj.inventoryItemId?.quantity || 0,
        newQty: Math.max(0, (adj.inventoryItemId?.quantity || 0) + adj.quantity),
        reason: adj.reason,
        notes: adj.notes || '',
        createdBy: session.userId,
      }));
      return res.json(mockMovements);
    }

    const movements = await StockMovement.find({
      tenantId: req.tenantId,
      sessionId: req.params.sessionId,
    })
      .populate('inventoryItemId', 'itemName unit quantity minThreshold')
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 });

    res.json(movements);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
