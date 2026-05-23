'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Waitlist = require('../models/Waitlist');
const ReservationSettings = require('../models/ReservationSettings');
const CafeTable = require('../models/CafeTable');
const TableSession = require('../models/TableSession');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('table_management');

router.use(protect, tenantScope, requireTableMgmt);

/**
 * Calculate estimated wait time based on queue and table turnover
 */
async function calculateEstimatedWait(tenantId, storeId, partySize, position) {
  // Get settings
  const settings = await ReservationSettings.findOne({ tenantId, storeId }).lean();
  const avgTurnTime = settings?.avgTurnTimeMinutes || 60;

  // Get tables that can accommodate this party
  const suitableTables = await CafeTable.countDocuments({
    tenantId,
    storeId,
    active: true,
    capacity: { $gte: partySize },
  });

  if (suitableTables === 0) return null;

  // Simple estimation: (position / tables) * avg turn time
  const cycles = Math.ceil(position / suitableTables);
  return Math.round(cycles * avgTurnTime);
}

/**
 * GET /waitlist - Get current waitlist
 */
router.get('/', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) return res.status(400).json({ message: 'Store required' });

    const { status = 'waiting,notified,ready' } = req.query;
    const statusFilter = status.split(',');

    const items = await Waitlist.find({
      tenantId: req.tenantId,
      storeId,
      status: { $in: statusFilter },
    })
      .sort({ position: 1 })
      .populate('tableId', 'label capacity')
      .populate('customerId', 'name phone')
      .lean();

    // Calculate current wait estimates for each
    const now = new Date();
    const enriched = items.map((item) => {
      const waitingMinutes = Math.round((now - new Date(item.joinedAt)) / 60000);
      return {
        ...item,
        waitingMinutes,
        waitingSince: item.joinedAt,
      };
    });

    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /waitlist - Add to waitlist
 */
router.post(
  '/',
  authorize('cashier', 'manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = await resolveWriteStoreId(req);
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const {
        guestName,
        guestPhone,
        customerId,
        partySize,
        zonePreference,
        notificationMethod = 'sms',
      } = req.body;

      if (!guestName?.trim()) {
        return res.status(400).json({ message: 'Guest name is required' });
      }
      if (!guestPhone?.trim()) {
        return res.status(400).json({ message: 'Guest phone is required' });
      }
      if (!partySize || partySize < 1) {
        return res.status(400).json({ message: 'Party size is required' });
      }

      // Check waitlist size limit
      const settings = await ReservationSettings.findOne({
        tenantId: req.tenantId,
        storeId,
      }).lean();

      const maxSize = settings?.waitlistMaxSize || 50;
      const currentCount = await Waitlist.countDocuments({
        tenantId: req.tenantId,
        storeId,
        status: 'waiting',
      });

      if (currentCount >= maxSize) {
        return res.status(400).json({ 
          message: 'Waitlist is full. Please try again later.',
          currentSize: currentCount,
          maxSize,
        });
      }

      // Get next position
      const lastEntry = await Waitlist.findOne({
        tenantId: req.tenantId,
        storeId,
        status: 'waiting',
      })
        .sort({ position: -1 })
        .select('position')
        .lean();

      const position = (lastEntry?.position || 0) + 1;

      // Calculate estimated wait
      const estimatedWaitMinutes = await calculateEstimatedWait(
        req.tenantId,
        storeId,
        partySize,
        position
      );

      const entry = await Waitlist.create({
        tenantId: req.tenantId,
        storeId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        customerId: customerId || null,
        partySize: Number(partySize),
        zonePreference: zonePreference || '',
        position,
        estimatedWaitMinutes,
        quotedWaitMinutes: estimatedWaitMinutes,
        notificationMethod,
        joinedAt: new Date(),
        createdBy: req.user.id,
      });

      res.status(201).json({
        ...entry.toObject(),
        message: `Added to waitlist. Estimated wait: ${estimatedWaitMinutes || 'unknown'} minutes`,
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /waitlist/estimate - Get wait estimate for party size
 */
router.get('/estimate', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) return res.status(400).json({ message: 'Store required' });

    const { partySize = 2 } = req.query;

    // Get current queue position
    const currentCount = await Waitlist.countDocuments({
      tenantId: req.tenantId,
      storeId,
      status: 'waiting',
    });

    const estimatedMinutes = await calculateEstimatedWait(
      req.tenantId,
      storeId,
      Number(partySize),
      currentCount + 1
    );

    res.json({
      position: currentCount + 1,
      estimatedMinutes,
      partiesAhead: currentCount,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * PUT /waitlist/:id/notify - Send "table ready" notification
 */
router.put(
  '/:id/notify',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const entry = await Waitlist.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!entry) {
        return res.status(404).json({ message: 'Waitlist entry not found' });
      }

      if (entry.status !== 'waiting') {
        return res.status(400).json({ message: 'Guest is not in waiting status' });
      }

      entry.status = 'notified';
      entry.notifiedAt = new Date();
      await entry.save();

      // TODO: Actually send SMS notification here
      // await sendSms(entry.guestPhone, `Hi ${entry.guestName}! Your table is ready...`);

      res.json({
        ...entry.toObject(),
        message: 'Guest notified (notification system pending)',
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * PUT /waitlist/:id/ready - Mark as ready (table assigned)
 */
router.put(
  '/:id/ready',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const { tableId } = req.body;

      const entry = await Waitlist.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!entry) {
        return res.status(404).json({ message: 'Waitlist entry not found' });
      }

      if (tableId) {
        const table = await CafeTable.findOne({
          _id: tableId,
          tenantId: req.tenantId,
          storeId: entry.storeId,
          active: true,
        });

        if (!table) {
          return res.status(400).json({ message: 'Invalid table' });
        }

        entry.tableId = table._id;
        entry.tableLabel = table.label;
      }

      entry.status = 'ready';
      await entry.save();

      res.json(entry);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * PUT /waitlist/:id/seat - Mark as seated
 */
router.put(
  '/:id/seat',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const { tableId } = req.body;

      const entry = await Waitlist.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!entry) {
        return res.status(404).json({ message: 'Waitlist entry not found' });
      }

      // Assign table if provided
      let tableLabel = entry.tableLabel;
      if (tableId) {
        const table = await CafeTable.findOne({
          _id: tableId,
          tenantId: req.tenantId,
          storeId: entry.storeId,
          active: true,
        });

        if (!table) {
          return res.status(400).json({ message: 'Invalid table' });
        }

        entry.tableId = table._id;
        tableLabel = table.label;
        entry.tableLabel = tableLabel;
      }

      entry.status = 'seated';
      entry.seatedAt = new Date();
      await entry.save();

      // Create table session for analytics
      if (entry.tableId) {
        try {
          await TableSession.create({
            tenantId: req.tenantId,
            storeId: entry.storeId,
            tableId: entry.tableId,
            tableLabel,
            seatedAt: entry.seatedAt,
            partySize: entry.partySize,
            source: 'waitlist',
            waitlistId: entry._id,
          });
        } catch (e) {
          // Don't fail the seat operation if session creation fails
          console.error('Failed to create table session:', e.message);
        }
      }

      // Recalculate positions for remaining entries
      await recalculatePositions(req.tenantId, entry.storeId);

      res.json({
        ...entry.toObject(),
        message: `Guest seated at ${tableLabel || 'table'}`,
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * PUT /waitlist/:id/remove - Remove from waitlist (left or no-show)
 */
router.put(
  '/:id/remove',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const { reason = 'left' } = req.body;

      const entry = await Waitlist.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!entry) {
        return res.status(404).json({ message: 'Waitlist entry not found' });
      }

      entry.status = reason === 'no_show' ? 'no_show' : 'left';
      entry.leftAt = new Date();
      await entry.save();

      // Recalculate positions
      await recalculatePositions(req.tenantId, entry.storeId);

      res.json({ message: 'Guest removed from waitlist' });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * DELETE /waitlist/:id - Delete waitlist entry
 */
router.delete(
  '/:id',
  authorize('manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const entry = await Waitlist.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!entry) {
        return res.status(404).json({ message: 'Waitlist entry not found' });
      }

      const storeId = entry.storeId;
      await entry.deleteOne();

      // Recalculate positions
      await recalculatePositions(req.tenantId, storeId);

      res.json({ message: 'Waitlist entry deleted' });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * Recalculate positions after someone leaves the queue
 */
async function recalculatePositions(tenantId, storeId) {
  const entries = await Waitlist.find({
    tenantId,
    storeId,
    status: 'waiting',
  }).sort({ position: 1 });

  for (let i = 0; i < entries.length; i++) {
    if (entries[i].position !== i + 1) {
      entries[i].position = i + 1;
      entries[i].estimatedWaitMinutes = await calculateEstimatedWait(
        tenantId,
        storeId,
        entries[i].partySize,
        i + 1
      );
      await entries[i].save();
    }
  }
}

module.exports = router;
