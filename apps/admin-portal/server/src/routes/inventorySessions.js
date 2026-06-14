const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

// Import models from admin-portal (same collections as POS)
const InventorySession = require('../models/InventorySession');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');

/**
 * GET /api/inventory-sessions
 * List all inventory adjustment sessions (merchant admin only)
 */
router.get('/', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const { storeId, status, userId, from, to } = req.query;

    const filter = { tenantId };
    if (storeId) filter.storeId = storeId;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to) filter.startedAt.$lte = new Date(to);
    }

    const sessions = await InventorySession.find(filter)
      .populate('storeId', 'name')
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ startedAt: -1 })
      .limit(200);

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching inventory sessions:', error);
    res.status(500).json({ error: 'Failed to fetch inventory sessions' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Static sub-routes MUST be registered BEFORE /:id to avoid Express
// treating string literals (e.g. "active", "stats") as ObjectId parameters.
// ─────────────────────────────────────────────────────────────────────────────

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
    });

    await session.populate('storeId', 'name');
    await session.populate('userId', 'name email');

    res.status(201).json(session);
  } catch (error) {
    console.error('Error starting inventory session:', error);
    res.status(500).json({ error: 'Failed to start inventory session' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Parameterised routes — must come AFTER all static sub-paths
// ─────────────────────────────────────────────────────────────────────────────

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
 * Close an active inventory session
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

    session.status = 'closed';
    session.closedAt = new Date();
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
 * POST /api/inventory-sessions/:id/adjust/:inventoryId
 * Record a stock adjustment within a session
 */
router.post('/:id/adjust/:inventoryId', protect, authorize('merchant_admin'), async (req, res) => {
  try {
    const { tenantId, user } = req;
    const { id: sessionId, inventoryId } = req.params;
    const { quantityChange, reason, notes } = req.body;

    if (quantityChange === undefined || quantityChange === null) {
      return res.status(400).json({ error: 'quantityChange is required' });
    }

    const session = await InventorySession.findOne({ _id: sessionId, tenantId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Adjustments can only be made in an active session' });
    }

    const inventoryItem = await Inventory.findOne({ _id: inventoryId, tenantId });
    if (!inventoryItem) return res.status(404).json({ error: 'Inventory item not found' });

    // Record the stock movement
    const movement = await StockMovement.create({
      tenantId,
      sessionId,
      inventoryItemId: inventoryId,
      storeId: session.storeId,
      quantityChange: Number(quantityChange),
      quantityBefore: inventoryItem.quantity || 0,
      quantityAfter: (inventoryItem.quantity || 0) + Number(quantityChange),
      reason: reason || 'manual_adjustment',
      notes: notes || '',
      createdBy: user.id,
      createdAt: new Date(),
    });

    // Update inventory quantity
    inventoryItem.quantity = (inventoryItem.quantity || 0) + Number(quantityChange);
    await inventoryItem.save();

    // Update session counters
    session.adjustmentCount = (session.adjustmentCount || 0) + 1;
    session.totalQuantityChanged = (session.totalQuantityChanged || 0) + Math.abs(Number(quantityChange));
    await session.save();

    await movement.populate('inventoryItemId', 'itemName unit');
    await movement.populate('createdBy', 'name email');

    res.status(201).json({ movement, updatedInventory: inventoryItem });
  } catch (error) {
    console.error('Error recording adjustment:', error);
    res.status(500).json({ error: 'Failed to record stock adjustment' });
  }
});

module.exports = router;
