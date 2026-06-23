const express = require('express');
const InventorySession = require('../models/InventorySession');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const { recalculateInventoryCosts } = require('../utils/costCalculation');
const { notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

/**
 * GET /inventory-sessions
 * List inventory adjustment sessions (for managers and admins)
 */
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { paginate, search, status, userId } = req.query;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    
    if (status) {
      filter.status = status;
    }
    if (userId) {
      filter.userId = userId;
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
      endedAt: 'endedAt',
      adjustmentCount: 'adjustmentCount',
      totalQty: 'totalQuantityChanged',
      status: 'status',
    }, { createdAt: -1 });

    if (paginate === 'true') {
      const { page, limit, skip } = parsePageQuery(req);
      const total = await InventorySession.countDocuments(filter);
      const sessions = await InventorySession.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .populate('reviewedBy', 'name email');
      
      res.json(paginated(sessions, total, page, limit));
    } else {
      const sessions = await InventorySession.find(filter)
        .populate('userId', 'name email')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .limit(100);
      
      res.json(sessions);
    }
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
      status: 'active',
      adjustments: [],
    });

    const populated = await InventorySession.findById(session._id).populate('userId', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /inventory-sessions/:id/close
 * Complete an adjustment session, commit draft changes to database, and notify admins
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

    // Commit draft adjustments to Inventory and StockMovements
    const movements = [];
    for (const adj of session.adjustments) {
      const invItem = await Inventory.findOne({
        _id: adj.inventoryItemId,
        tenantId: req.tenantId,
      });
      if (!invItem) continue;

      const previousQty = invItem.quantity || 0;
      const newQty = Math.max(0, previousQty + adj.quantity);

      // Update actual inventory stock quantity
      invItem.quantity = newQty;
      invItem.lastUpdated = Date.now();
      invItem.updatedBy = req.user.id;
      await invItem.save();

      // Recalculate costing in the background
      recalculateInventoryCosts(req.tenantId, session.storeId, invItem._id).catch((err) => {
        console.error(`[inventorySession close] Failed to recalculate costs for ${invItem._id}:`, err);
      });

      // Create committed stock movement audit log
      const movement = await StockMovement.create({
        tenantId: req.tenantId,
        storeId: session.storeId,
        inventoryItemId: invItem._id,
        sessionId: session._id,
        type: 'adjustment',
        quantity: adj.quantity,
        previousQty,
        newQty,
        reason: adj.reason,
        notes: adj.notes || '',
        createdBy: req.user.id,
      });
      movements.push(movement);
    }

    // Update session status to completed (closed)
    session.status = 'closed';
    session.endedAt = new Date();
    session.notes = notes || '';
    await session.save();

    // Notify merchant admins if there were adjustments
    if (session.adjustmentCount > 0 && movements.length > 0) {
      try {
        const summary = movements.slice(0, 5).map(m => {
          if (!m.inventoryItemId) return null;
          const sign = m.quantity >= 0 ? '+' : '';
          return `${m.inventoryItemId.itemName}: ${sign}${m.quantity} ${m.inventoryItemId.unit}`;
        }).filter(Boolean).join(', ');

        const moreSummary = movements.length > 5 ? ` and ${movements.length - 5} more` : '';

        if (summary) {
          await notifyMerchantAdmins(req.tenantId, {
            type: 'inventory_session_closed',
            title: 'Inventory Adjustment Session Completed',
            body: `${req.user.name} completed an adjustment session with ${session.adjustmentCount} changes: ${summary}${moreSummary}`,
            meta: {
              resourceType: 'inventory_session',
              resourceId: String(session._id),
            },
          }, { excludeUserId: req.user.role === 'merchant_admin' ? req.user.id : null });

          session.notificationSent = true;
          await session.save();
        }
      } catch (notifyErr) {
        console.error('[inventory close] notification failed:', notifyErr.message);
      }
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
 * POST /inventory-sessions/:id/cancel
 * Ignore/discard an active adjustment session without applying draft changes
 */
router.post('/:id/cancel', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const session = await InventorySession.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      status: 'active',
    });

    if (!session) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    session.status = 'cancelled';
    session.endedAt = new Date();
    await session.save();

    res.json(session);
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
 * Record/edit a draft adjustment within an active session (without modifying inventory yet)
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

    // Add or edit draft adjustment inside session adjustments array
    const existingIndex = session.adjustments.findIndex(
      (adj) => String(adj.inventoryItemId) === String(invItem._id)
    );

    const adjustmentData = {
      inventoryItemId: invItem._id,
      quantity,
      reason,
      notes: notes || '',
    };

    if (existingIndex >= 0) {
      session.adjustments[existingIndex] = adjustmentData;
    } else {
      session.adjustments.push(adjustmentData);
    }

    // Update session stats
    session.adjustmentCount = session.adjustments.length;
    session.totalQuantityChanged = session.adjustments.reduce(
      (sum, adj) => sum + Math.abs(adj.quantity),
      0
    );

    await session.save();
    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * DELETE /inventory-sessions/:id/adjust/:inventoryId
 * Remove a draft adjustment from an active session
 */
router.delete('/:id/adjust/:inventoryId', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
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

    // Remove from adjustments array
    session.adjustments = session.adjustments.filter(
      (adj) => String(adj.inventoryItemId) !== String(req.params.inventoryId)
    );

    // Update session stats
    session.adjustmentCount = session.adjustments.length;
    session.totalQuantityChanged = session.adjustments.reduce(
      (sum, adj) => sum + Math.abs(adj.quantity),
      0
    );

    await session.save();
    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
