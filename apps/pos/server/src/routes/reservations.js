'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const ReservationSettings = require('../models/ReservationSettings');
const CafeTable = require('../models/CafeTable');
const Customer = require('../models/Customer');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('table_management');

router.use(protect, tenantScope, requireTableMgmt);

/**
 * GET /reservations - List reservations for date range
 */
router.get('/', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) return res.status(400).json({ message: 'Store required' });

    const { date, startDate, endDate, status, page = 1, limit = 50 } = req.query;

    const filter = { tenantId: req.tenantId, storeId };

    // Date filtering
    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      filter.reservationTime = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      filter.reservationTime = {};
      if (startDate) filter.reservationTime.$gte = new Date(startDate);
      if (endDate) filter.reservationTime.$lte = new Date(endDate);
    }

    if (status) {
      filter.status = { $in: status.split(',') };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = parseSortQuery(req, {
      reservationTime: 'reservationTime',
      createdAt: 'createdAt',
      status: 'status',
      partySize: 'partySize',
    }, { reservationTime: 1 });
    const [items, total] = await Promise.all([
      Reservation.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('tableId', 'label capacity')
        .populate('customerId', 'name phone email')
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    res.json({
      items,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /reservations/availability - Check available time slots
 */
router.get('/availability', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) return res.status(400).json({ message: 'Store required' });

    const { date, partySize = 2 } = req.query;
    if (!date) return res.status(400).json({ message: 'Date required' });

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Get settings
    let settings = await ReservationSettings.findOne({
      tenantId: req.tenantId,
      storeId,
    }).lean();

    if (!settings) {
      // Return default slots if no settings
      settings = {
        enabled: true,
        maxPartySize: 12,
        defaultDurationMinutes: 90,
        bufferMinutes: 15,
        timeSlots: [
          { dayOfWeek, openTime: '11:00', closeTime: '22:00', slotDurationMinutes: 15 },
        ],
      };
    }

    if (!settings.enabled) {
      return res.json({ available: false, message: 'Reservations not enabled', slots: [] });
    }

    if (Number(partySize) > settings.maxPartySize) {
      return res.json({
        available: false,
        message: `Maximum party size is ${settings.maxPartySize}`,
        slots: [],
      });
    }

    // Get tables that can accommodate the party
    const tables = await CafeTable.find({
      tenantId: req.tenantId,
      storeId,
      active: true,
      capacity: { $gte: Number(partySize) },
    }).lean();

    if (tables.length === 0) {
      return res.json({
        available: false,
        message: 'No tables available for this party size',
        slots: [],
      });
    }

    // Get existing reservations for the day
    const dayStart = new Date(requestedDate.setHours(0, 0, 0, 0));
    const dayEnd = new Date(requestedDate.setHours(23, 59, 59, 999));

    const existingReservations = await Reservation.find({
      tenantId: req.tenantId,
      storeId,
      reservationTime: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ['cancelled', 'no_show'] },
    }).lean();

    // Find time slot config for this day
    const daySlot = settings.timeSlots?.find((s) => s.dayOfWeek === dayOfWeek);
    if (!daySlot) {
      return res.json({ available: false, message: 'Restaurant closed on this day', slots: [] });
    }

    // Generate available slots
    const slots = [];
    const [openHour, openMin] = daySlot.openTime.split(':').map(Number);
    const [closeHour, closeMin] = daySlot.closeTime.split(':').map(Number);
    const slotDuration = daySlot.slotDurationMinutes || 15;
    const duration = settings.defaultDurationMinutes || 90;
    const buffer = settings.bufferMinutes || 15;

    let current = new Date(date);
    current.setHours(openHour, openMin, 0, 0);
    const closeTime = new Date(date);
    closeTime.setHours(closeHour, closeMin, 0, 0);

    // Don't show past slots for today
    const now = new Date();
    if (current < now) {
      current = new Date(Math.ceil(now.getTime() / (slotDuration * 60000)) * slotDuration * 60000);
    }

    while (current < closeTime) {
      const slotEnd = new Date(current.getTime() + duration * 60000);
      
      // Check if any table is available for this slot
      const availableTables = tables.filter((table) => {
        const conflicts = existingReservations.filter((r) => {
          if (String(r.tableId) !== String(table._id)) return false;
          const rStart = new Date(r.reservationTime);
          const rEnd = new Date(rStart.getTime() + (r.duration || duration) * 60000 + buffer * 60000);
          return current < rEnd && slotEnd > rStart;
        });
        return conflicts.length === 0;
      });

      slots.push({
        time: current.toISOString(),
        displayTime: current.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        available: availableTables.length > 0,
        tablesAvailable: availableTables.length,
      });

      current = new Date(current.getTime() + slotDuration * 60000);
    }

    res.json({
      available: slots.some((s) => s.available),
      slots,
      settings: {
        maxPartySize: settings.maxPartySize,
        defaultDuration: settings.defaultDurationMinutes,
      },
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /reservations - Create a reservation
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
        guestEmail,
        customerId,
        reservationTime,
        partySize,
        duration,
        tableId,
        zonePreference,
        source = 'phone',
        specialRequests,
        internalNotes,
      } = req.body;

      // Validate required fields
      if (!guestName?.trim()) {
        return res.status(400).json({ message: 'Guest name is required' });
      }
      if (!guestPhone?.trim()) {
        return res.status(400).json({ message: 'Guest phone is required' });
      }
      if (!reservationTime) {
        return res.status(400).json({ message: 'Reservation time is required' });
      }
      if (!partySize || partySize < 1) {
        return res.status(400).json({ message: 'Party size is required' });
      }

      const resTime = new Date(reservationTime);
      if (resTime < new Date()) {
        return res.status(400).json({ message: 'Reservation time must be in the future' });
      }

      // Get settings
      const settings = await ReservationSettings.findOne({
        tenantId: req.tenantId,
        storeId,
      }).lean();

      const resDuration = duration || settings?.defaultDurationMinutes || 90;

      // Auto-assign table if not provided
      let assignedTableId = tableId;
      let assignedTableLabel = '';

      if (tableId) {
        const table = await CafeTable.findOne({
          _id: tableId,
          tenantId: req.tenantId,
          storeId,
          active: true,
        }).lean();
        if (!table) {
          return res.status(400).json({ message: 'Invalid table' });
        }
        assignedTableLabel = table.label;
      }

      // Check for conflicts if table is assigned
      if (assignedTableId) {
        const buffer = settings?.bufferMinutes || 15;
        const slotStart = resTime;
        const slotEnd = new Date(resTime.getTime() + resDuration * 60000);

        const conflict = await Reservation.findOne({
          tenantId: req.tenantId,
          storeId,
          tableId: assignedTableId,
          status: { $nin: ['cancelled', 'no_show', 'completed'] },
          $or: [
            {
              reservationTime: { $lt: slotEnd },
              $expr: {
                $gt: [
                  { $add: ['$reservationTime', { $multiply: [{ $ifNull: ['$duration', resDuration] }, 60000] }] },
                  slotStart,
                ],
              },
            },
          ],
        });

        if (conflict) {
          return res.status(409).json({
            message: 'Table is already reserved for this time slot',
            conflictingReservation: conflict._id,
          });
        }
      }

      // Link to customer if provided
      let linkedCustomerId = null;
      if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
        const customer = await Customer.findOne({
          _id: customerId,
          tenantId: req.tenantId,
        });
        if (customer) linkedCustomerId = customer._id;
      }

      const reservation = await Reservation.create({
        tenantId: req.tenantId,
        storeId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestEmail: guestEmail?.trim() || '',
        customerId: linkedCustomerId,
        reservationTime: resTime,
        partySize: Number(partySize),
        duration: resDuration,
        tableId: assignedTableId || null,
        tableLabel: assignedTableLabel,
        zonePreference: zonePreference || '',
        source,
        specialRequests: specialRequests || '',
        internalNotes: internalNotes || '',
        status: 'confirmed',
        createdBy: req.user.id,
      });

      res.status(201).json(reservation);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /reservations/:id - Get single reservation
 */
router.get('/:id', resolveSelectedStore, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid reservation ID' });
    }

    const reservation = await Reservation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate('tableId', 'label capacity')
      .populate('customerId', 'name phone email')
      .populate('createdBy', 'name')
      .lean();

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.json(reservation);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * PUT /reservations/:id - Update reservation
 */
router.put(
  '/:id',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid reservation ID' });
      }

      const reservation = await Reservation.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      const allowedFields = [
        'guestName', 'guestPhone', 'guestEmail', 'reservationTime',
        'partySize', 'duration', 'tableId', 'zonePreference',
        'specialRequests', 'internalNotes',
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          reservation[field] = req.body[field];
        }
      }

      // Update table label if table changed
      if (req.body.tableId) {
        const table = await CafeTable.findById(req.body.tableId).lean();
        reservation.tableLabel = table?.label || '';
      }

      reservation.updatedBy = req.user.id;
      await reservation.save();

      res.json(reservation);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * PUT /reservations/:id/status - Update reservation status
 */
router.put(
  '/:id/status',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const { status, cancelReason } = req.body;
      const validStatuses = ['pending', 'confirmed', 'reminded', 'arrived', 'seated', 'completed', 'no_show', 'cancelled'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const reservation = await Reservation.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      reservation.status = status;
      reservation.updatedBy = req.user.id;

      // Set timestamps based on status
      const now = new Date();
      if (status === 'arrived' && !reservation.arrivedAt) {
        reservation.arrivedAt = now;
      } else if (status === 'seated' && !reservation.seatedAt) {
        reservation.seatedAt = now;
        if (!reservation.arrivedAt) reservation.arrivedAt = now;
      } else if (status === 'completed' && !reservation.completedAt) {
        reservation.completedAt = now;
      } else if (status === 'cancelled') {
        reservation.cancelledAt = now;
        reservation.cancelReason = cancelReason || '';
      }

      await reservation.save();
      res.json(reservation);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * PUT /reservations/:id/assign-table - Assign or reassign table
 */
router.put(
  '/:id/assign-table',
  authorize('cashier', 'manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const { tableId } = req.body;

      const reservation = await Reservation.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      if (tableId) {
        const table = await CafeTable.findOne({
          _id: tableId,
          tenantId: req.tenantId,
          storeId: reservation.storeId,
          active: true,
        });

        if (!table) {
          return res.status(400).json({ message: 'Invalid table' });
        }

        reservation.tableId = table._id;
        reservation.tableLabel = table.label;
      } else {
        reservation.tableId = null;
        reservation.tableLabel = '';
      }

      reservation.updatedBy = req.user.id;
      await reservation.save();

      res.json(reservation);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * DELETE /reservations/:id - Cancel/delete reservation
 */
router.delete(
  '/:id',
  authorize('manager', 'merchant_admin'),
  async (req, res) => {
    try {
      const reservation = await Reservation.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      });

      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      // Soft delete by setting status to cancelled
      reservation.status = 'cancelled';
      reservation.cancelledAt = new Date();
      reservation.cancelReason = req.body.reason || 'Deleted by staff';
      reservation.updatedBy = req.user.id;
      await reservation.save();

      res.json({ message: 'Reservation cancelled' });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

// ─── Settings routes ───────────────────────────────────────────────────────────

/**
 * GET /reservations/settings/current - Get reservation settings
 */
router.get('/settings/current', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) return res.status(400).json({ message: 'Store required' });

    let settings = await ReservationSettings.findOne({
      tenantId: req.tenantId,
      storeId,
    }).lean();

    if (!settings) {
      // Return defaults
      settings = {
        tenantId: req.tenantId,
        storeId,
        enabled: true,
        maxPartySize: 12,
        minLeadTimeMinutes: 60,
        maxLeadTimeDays: 30,
        defaultDurationMinutes: 90,
        bufferMinutes: 15,
        timeSlots: [],
        requireConfirmation: true,
        autoConfirmOnline: false,
        sendReminder: true,
        reminderHoursBefore: 24,
        noShowGracePeriodMinutes: 15,
        waitlistEnabled: true,
        waitlistMaxSize: 50,
        avgTurnTimeMinutes: 60,
      };
    }

    res.json(settings);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * PUT /reservations/settings/current - Update reservation settings
 */
router.put(
  '/settings/current',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = await resolveWriteStoreId(req);
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const allowedFields = [
        'enabled', 'maxPartySize', 'minLeadTimeMinutes', 'maxLeadTimeDays',
        'defaultDurationMinutes', 'bufferMinutes', 'timeSlots',
        'requireConfirmation', 'autoConfirmOnline', 'confirmationMessage',
        'sendReminder', 'reminderHoursBefore', 'reminderMessage',
        'noShowGracePeriodMinutes', 'requireDeposit', 'depositAmount', 'depositCurrency',
        'waitlistEnabled', 'waitlistMaxSize', 'waitlistNotifyWhenReady', 'waitlistNotifyMessage',
        'avgTurnTimeMinutes',
      ];

      const updateData = { updatedBy: req.user.id };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const settings = await ReservationSettings.findOneAndUpdate(
        { tenantId: req.tenantId, storeId },
        { $set: updateData },
        { new: true, upsert: true, runValidators: true }
      );

      res.json(settings);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
