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
    const { tenantId, user } = req;
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

    // Get all movements in this session
    const movements = await StockMovement.find({
      sessionId: session._id,
      tenantId,
    })
      .populate('inventoryItemId', 'name unit')
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 });

    res.json({
      session,
      movements,
    });
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

    const session = await InventorySession.findOne({
      _id: req.params.id,
      tenantId,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'closed') {
      return res.status(400).json({ error: 'Only closed sessions can be reviewed' });
    }

    session.reviewedBy = user._id;
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

    // Group by user
    for (const session of sessions) {
      const userId = String(session.userId);
      if (!stats.sessionsByUser[userId]) {
        stats.sessionsByUser[userId] = {
          userId,
          count: 0,
          adjustments: 0,
          quantityChanged: 0,
        };
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

module.exports = router;
