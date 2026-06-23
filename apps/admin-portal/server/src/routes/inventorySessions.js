const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

// Import models
const InventorySession = require('../models/InventorySession');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const { recalculateInventoryCosts } = require('../utils/costCalculation');
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');

/**
 * GET /api/inventory-sessions
 * List all inventory adjustment sessions (merchant admin only)
 */
router.get('/', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const { storeId, status, userId, from, to, search, paginate } = req.query;

    const filter = { tenantId };
    if (storeId) filter.storeId = storeId;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to) filter.startedAt.$lte = new Date(to);
    }

    if (search) {
      const matchingUsers = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);
      
      filter.$or = [
        { notes: { $regex: search, $options: 'i' } },
        { userId: { $in: userIds } }
      ];
    }

    const sort = parseSortQuery(req, {
      createdAt: 'createdAt',
      startedAt: 'startedAt',
      endedAt: 'endedAt',
      closedAt: 'closedAt',
      adjustmentCount: 'adjustmentCount',
      totalQty: 'totalQuantityChanged',
      status: 'status',
    }, { startedAt: -1 });

    if (paginate === 'true') {
      const { page, limit, skip } = parsePageQuery(req);
      const total = await InventorySession.countDocuments(filter);
      const sessions = await InventorySession.find(filter)
        .populate('storeId', 'name')
        .populate('userId', 'name email')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      res.json(paginated(sessions, total, page, limit));
    } else {
      const sessions = await InventorySession.find(filter)
        .populate('storeId', 'name')
        .populate('userId', 'name email')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .limit(200);

      res.json(sessions);
    }
  } catch (error) {
    console.error('Error fetching inventory sessions:', error);
    res.status(500).json({ error: 'Failed to fetch inventory sessions' });
  }
});

/**
 * GET /api/inventory-sessions/active
 * Return the currently open (active) session for the requesting store/user.
 */
router.get('/active', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const { storeId } = req.query;

    const filter = { tenantId, status: 'active' };
    if (storeId) filter.storeId = storeId;

    const session = await InventorySession.findOne(filter)
      .populate('storeId', 'name')
      .populate('userId', 'name email')
      .sort({ startedAt: -1 });

    res.json(session || null);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

/**
 * GET /api/inventory-sessions/stats/summary
 * Get summary statistics for inventory sessions
 */
router.get('/stats/summary', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const { storeId, from, to } = req.query;

    const filter = { tenantId, status: 'closed' };
    if (storeId) filter.storeId = storeId;
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to) filter.startedAt.$lte = new Date(to);
    }

    const sessions = await InventorySession.find(filter);

    const stats = {
      totalSessions: sessions.length,
      reviewedSessions: sessions.filter(s => s.reviewedBy).length,
      pendingReview: sessions.filter(s => !s.reviewedBy).length,
      totalAdjustments: sessions.reduce((sum, s) => sum + (s.adjustmentCount || 0), 0),
      totalQuantityChanged: sessions.reduce((sum, s) => sum + Math.abs(s.totalQuantityChanged || 0), 0),
      sessionsByUser: {},
    };

    for (const session of sessions) {
      const userId = String(session.userId);
      if (!stats.sessionsByUser[userId]) {
        stats.sessionsByUser[userId] = { userId, count: 0, adjustments: 0, quantityChanged: 0 };
      }
      stats.sessionsByUser[userId].count++;
      stats.sessionsByUser[userId].adjustments += session.adjustmentCount || 0;
      stats.sessionsByUser[userId].quantityChanged += Math.abs(session.totalQuantityChanged || 0);
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});

/**
 * POST /api/inventory-sessions/start
 * Open a new inventory adjustment session
 */
router.post('/start', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId, user } = req;
    const { storeId, notes } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: 'storeId is required' });
    }

    // Prevent multiple concurrent active sessions per store
    const existing = await InventorySession.findOne({ tenantId, storeId, status: 'active' });
    if (existing) {
      return res.status(409).json({ error: 'An active session already exists for this store', sessionId: existing._id });
    }

    const session = await InventorySession.create({
      tenantId,
      storeId,
      userId: user.id,
      status: 'active',
      startedAt: new Date(),
      notes: notes || '',
      adjustmentCount: 0,
      totalQuantityChanged: 0,
      adjustments: [],
    });

    await session.populate('storeId', 'name');
    await session.populate('userId', 'name email');

    res.status(201).json(session);
  } catch (error) {
    console.error('Error starting inventory session:', error);
    res.status(500).json({ error: 'Failed to start inventory session' });
  }
});

/**
 * GET /api/inventory-sessions/:id
 * Get single session with all movements
 */
router.get('/:id', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;

    const session = await InventorySession.findOne({
      _id: req.params.id,
      tenantId,
    })
      .populate('storeId', 'name')
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const movements = await StockMovement.find({
      sessionId: session._id,
      tenantId,
    })
      .populate('inventoryItemId', 'itemName unit')
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 });

    res.json({ session, movements });
  } catch (error) {
    console.error('Error fetching inventory session:', error);
    res.status(500).json({ error: 'Failed to fetch inventory session' });
  }
});

/**
 * POST /api/inventory-sessions/:id/review
 * Mark session as reviewed
 */
router.post('/:id/review', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId, user } = req;

    const session = await InventorySession.findOne({ _id: req.params.id, tenantId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'closed') {
      return res.status(400).json({ error: 'Only closed sessions can be reviewed' });
    }

    session.reviewedBy = user.id;
    session.reviewedAt = new Date();

    await session.save();
    await session.populate('storeId', 'name');
    await session.populate('userId', 'name email');
    await session.populate('reviewedBy', 'name email');

    res.json(session);
  } catch (error) {
    console.error('Error reviewing session:', error);
    res.status(500).json({ error: 'Failed to review session' });
  }
});

/**
 * POST /api/inventory-sessions/:id/close
 * Complete an active inventory session, commit draft changes, and save final logs
 */
router.post('/:id/close', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId, user } = req;
    const { notes } = req.body;

    const session = await InventorySession.findOne({ _id: req.params.id, tenantId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Only active sessions can be closed' });
    }

    // Commit all draft adjustments to Inventory and StockMovements
    for (const adj of session.adjustments) {
      const inventoryItem = await Inventory.findOne({ _id: adj.inventoryItemId, tenantId });
      if (!inventoryItem) continue;

      const previousQty = inventoryItem.quantity || 0;
      const newQty = Math.max(0, previousQty + adj.quantity);

      // Create committed stock movement log
      await StockMovement.create({
        tenantId,
        sessionId: session._id,
        inventoryItemId: adj.inventoryItemId,
        storeId: session.storeId,
        quantity: adj.quantity,
        previousQty,
        newQty,
        reason: adj.reason || 'manual_adjustment',
        notes: adj.notes || '',
        createdBy: user.id,
        createdAt: new Date(),
      });

      // Update inventory quantity
      inventoryItem.quantity = newQty;
      await inventoryItem.save();

      // Recalculate costing in the background
      recalculateInventoryCosts(tenantId, session.storeId, adj.inventoryItemId).catch((err) => {
        console.error(`[admin inventorySession close] Failed to recalculate costs for ${adj.inventoryItemId}:`, err);
      });
    }

    session.status = 'closed';
    session.closedAt = new Date();
    session.endedAt = new Date();
    if (notes) session.notes = notes;

    await session.save();
    await session.populate('storeId', 'name');
    await session.populate('userId', 'name email');

    res.json(session);
  } catch (error) {
    console.error('Error closing session:', error);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

/**
 * POST /api/inventory-sessions/:id/cancel
 * Ignore/discard an active session without applying changes
 */
router.post('/:id/cancel', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const session = await InventorySession.findOne({ _id: req.params.id, tenantId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Only active sessions can be cancelled' });
    }

    session.status = 'cancelled';
    session.endedAt = new Date();
    await session.save();

    res.json(session);
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

/**
 * POST /api/inventory-sessions/:id/adjust/:inventoryId
 * Record/edit a stock adjustment in draft within a session
 */
router.post('/:id/adjust/:inventoryId', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId, user } = req;
    const { id: sessionId, inventoryId } = req.params;
    const { quantity, quantityChange, reason, notes } = req.body;

    const qty = quantity !== undefined ? Number(quantity) : Number(quantityChange);
    if (qty === undefined || qty === null || isNaN(qty) || qty === 0) {
      return res.status(400).json({ error: 'quantity/quantityChange must be a non-zero number' });
    }

    const session = await InventorySession.findOne({ _id: sessionId, tenantId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Adjustments can only be made in an active session' });
    }

    const inventoryItem = await Inventory.findOne({ _id: inventoryId, tenantId });
    if (!inventoryItem) return res.status(404).json({ error: 'Inventory item not found' });

    // Add or edit draft adjustment inside session adjustments array
    const existingIndex = session.adjustments.findIndex(
      (adj) => String(adj.inventoryItemId) === String(inventoryItem._id)
    );

    const adjustmentData = {
      inventoryItemId: inventoryItem._id,
      quantity: qty,
      reason: reason || 'manual_adjustment',
      notes: notes || '',
    };

    if (existingIndex >= 0) {
      session.adjustments[existingIndex] = adjustmentData;
    } else {
      session.adjustments.push(adjustmentData);
    }

    // Update session counters
    session.adjustmentCount = session.adjustments.length;
    session.totalQuantityChanged = session.adjustments.reduce(
      (sum, adj) => sum + Math.abs(adj.quantity),
      0
    );

    await session.save();
    res.status(201).json({ updatedSession: session });
  } catch (error) {
    console.error('Error recording adjustment:', error);
    res.status(500).json({ error: 'Failed to record stock adjustment' });
  }
});

/**
 * DELETE /api/inventory-sessions/:id/adjust/:inventoryId
 * Remove a draft adjustment from an active session
 */
router.delete('/:id/adjust/:inventoryId', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const { id: sessionId, inventoryId } = req.params;

    const session = await InventorySession.findOne({ _id: sessionId, tenantId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Adjustments can only be modified in active sessions' });
    }

    session.adjustments = session.adjustments.filter(
      (adj) => String(adj.inventoryItemId) !== String(inventoryId)
    );

    session.adjustmentCount = session.adjustments.length;
    session.totalQuantityChanged = session.adjustments.reduce(
      (sum, adj) => sum + Math.abs(adj.quantity),
      0
    );

    await session.save();
    res.json(session);
  } catch (error) {
    console.error('Error removing adjustment:', error);
    res.status(500).json({ error: 'Failed to remove stock adjustment' });
  }
});

module.exports = router;
