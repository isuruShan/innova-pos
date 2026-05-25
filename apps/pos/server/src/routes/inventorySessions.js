const express = require('express');
const InventorySession = require('../models/InventorySession');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

/**
 * GET /inventory-sessions
 * List inventory adjustment sessions (for managers and admins)
 */
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    const sessions = await InventorySession.find(filter)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(sessions);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /inventory-sessions/active
 * Get active session for current user
 */
router.get('/active', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) {
      return res.status(400).json({ message: 'No store selected' });
    }

    const session = await InventorySession.findOne({
      tenantId: req.tenantId,
      storeId,
      userId: req.user.id,
      status: 'active',
    }).populate('userId', 'name email');

    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /inventory-sessions/start
 * Start a new adjustment session
 */
router.post('/start', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) {
      return res.status(400).json({ message: 'No store available to start session' });
    }

    // Check if user already has an active session
    const existing = await InventorySession.findOne({
      tenantId: req.tenantId,
      storeId,
      userId: req.user.id,
      status: 'active',
    });

    if (existing) {
      return res.status(400).json({ message: 'You already have an active adjustment session' });
    }

    const session = await InventorySession.create({
      tenantId: req.tenantId,
      storeId,
      userId: req.user.id,
    });

    const populated = await InventorySession.findById(session._id).populate('userId', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /inventory-sessions/:id/close
 * Close an adjustment session and notify admins
 */
router.post('/:id/close', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { notes } = req.body;

    const session = await InventorySession.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      status: 'active',
    });

    if (!session) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    // Update session
    session.status = 'closed';
    session.endedAt = new Date();
    session.notes = notes || '';
    await session.save();

    // Get movements for this session to build summary
    const movements = await StockMovement.find({ sessionId: session._id })
      .populate('inventoryItemId', 'itemName unit')
      .sort({ createdAt: 1 });

    // Create notification for merchant admins if there were adjustments
    if (session.adjustmentCount > 0) {
      const summary = movements.slice(0, 5).map(m => {
        if (!m.inventoryItemId) return null;
        const sign = m.quantity >= 0 ? '+' : '';
        return `${m.inventoryItemId.itemName}: ${sign}${m.quantity} ${m.inventoryItemId.unit}`;
      }).filter(Boolean).join(', ');

      const moreSummary = movements.length > 5 ? ` and ${movements.length - 5} more` : '';

      await Notification.create({
        tenantId: req.tenantId,
        type: 'inventory_session_closed',
        title: 'Inventory Adjustment Session Closed',
        message: `${req.user.name} closed an adjustment session with ${session.adjustmentCount} changes: ${summary}${moreSummary}`,
        targetRoles: ['merchant_admin'],
        data: {
          sessionId: session._id,
          userId: req.user.id,
          userName: req.user.name,
          adjustmentCount: session.adjustmentCount,
          totalQuantityChanged: session.totalQuantityChanged,
        },
      });

      session.notificationSent = true;
      await session.save();
    }

    const populated = await InventorySession.findById(session._id)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email');

    res.json(populated);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * PUT /inventory-sessions/:id/review
 * Mark session as reviewed (merchant admin only)
 */
router.put('/:id/review', protect, authorize('merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const session = await InventorySession.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      { reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    )
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name email');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /inventory-sessions/:id/adjust/:inventoryId
 * Make an adjustment within an active session
 */
router.post('/:id/adjust/:inventoryId', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { quantity, reason, notes } = req.body;

    if (typeof quantity !== 'number' || quantity === 0) {
      return res.status(400).json({ message: 'Quantity must be a non-zero number' });
    }

    if (!reason) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    // Verify session is active and belongs to user
    const session = await InventorySession.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      status: 'active',
    });

    if (!session) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    // Get inventory item
    const invItem = await Inventory.findOne({
      _id: req.params.inventoryId,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });

    if (!invItem) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const previousQty = invItem.quantity;
    const newQty = Math.max(0, previousQty + quantity); // Ensure non-negative

    // Update inventory
    invItem.quantity = newQty;
    invItem.lastUpdated = Date.now();
    invItem.updatedBy = req.user.id;
    await invItem.save();

    // Create stock movement
    const movement = await StockMovement.create({
      tenantId: req.tenantId,
      storeId: session.storeId,
      inventoryItemId: invItem._id,
      sessionId: session._id,
      type: 'adjustment',
      quantity,
      previousQty,
      newQty,
      reason,
      notes: notes || '',
      createdBy: req.user.id,
    });

    // Update session stats
    session.adjustmentCount += 1;
    session.totalQuantityChanged += Math.abs(quantity);
    await session.save();

    const populated = await StockMovement.findById(movement._id)
      .populate('inventoryItemId', 'itemName unit quantity minThreshold')
      .populate('createdBy', 'name email');

    res.json(populated);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
