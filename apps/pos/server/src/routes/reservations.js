'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const ReservationSettings = require('../models/ReservationSettings');
const CafeTable = require('../models/CafeTable');
const Customer = require('../models/Customer');
const TableSession = require('../models/TableSession');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('table_management');

router.use(protect, tenantScope, requireTableMgmt);

async function getEligibleTables(tenantId, storeId, reservationTime, partySize, duration, excludeReservationId = null) {
  const CafeTable = require('../models/CafeTable');
  const Reservation = require('../models/Reservation');
  const ReservationSettings = require('../models/ReservationSettings');
  const TableSession = require('../models/TableSession');

  // 1. Get settings
  const settings = await ReservationSettings.findOne({ tenantId, storeId }).lean();
  const defDuration = settings?.defaultDurationMinutes || 90;
  const buffer = settings?.bufferMinutes || 15;
  const avgTurnTime = settings?.avgTurnTimeMinutes || 60;

  const resTime = new Date(reservationTime);
  const resDuration = duration || defDuration;
  const slotStart = resTime;
  const slotEnd = new Date(resTime.getTime() + resDuration * 60000);

  // 2. Fetch all active tables with capacity >= partySize
  const tables = await CafeTable.find({
    tenantId,
    storeId,
    active: true,
    capacity: { $gte: Number(partySize) },
  }).lean();

  if (tables.length === 0) return [];

  // 3. Fetch overlapping reservations
  const query = {
    tenantId,
    storeId,
    status: { $nin: ['cancelled', 'no_show', 'completed'] },
    $or: [
      {
        reservationTime: { $lt: slotEnd },
        $expr: {
          $gt: [
            { $add: ['$reservationTime', { $multiply: [{ $ifNull: ['$duration', defDuration] }, 60000] }] },
            slotStart,
          ],
        },
      },
    ],
  };
  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }
  const overlappingReservations = await Reservation.find(query).lean();

  // 4. Fetch active table sessions
  const activeSessions = await TableSession.find({
    tenantId,
    storeId,
    status: 'active',
  }).lean();

  // 5. Filter tables
  const eligibleTables = [];
  for (const table of tables) {
    const tableIdStr = String(table._id);

    // Condition A: No overlapping reservations
    const hasReservationConflict = overlappingReservations.some(
      (r) => String(r.tableId) === tableIdStr
    );
    if (hasReservationConflict) continue;

    // Condition B: Not currently occupied with overlapping timing
    const activeSession = activeSessions.find((s) => String(s.tableId) === tableIdStr);
    if (activeSession) {
      const now = new Date();
      const expectedReleaseTime = new Date(
        new Date(activeSession.seatedAt).getTime() + avgTurnTime * 60000
      );
      const earliestReservableTime = new Date(Math.max(
        now.getTime() + 60 * 60000, // 1 hour buffer from now
        expectedReleaseTime.getTime() + buffer * 60000 // expected completion time + buffer
      ));
      
      // If requested reservation time starts before the expected release / buffer, it's not eligible
      if (slotStart < earliestReservableTime) {
        continue;
      }
    }

    eligibleTables.push(table);
  }

  // Sort tables: capacity closest to partySize first, then capacity ascending
  eligibleTables.sort((a, b) => a.capacity - b.capacity || a.label.localeCompare(b.label));

  return eligibleTables;
}

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
  authorize('cashier', 'manager', 'merchant_admin', 'steward'),
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

      if (assignedTableId) {
        const table = await CafeTable.findOne({
          _id: assignedTableId,
          tenantId: req.tenantId,
          storeId,
          active: true,
        }).lean();
        if (!table) {
          return res.status(400).json({ message: 'Invalid table' });
        }
        if (table.capacity < partySize) {
          return res.status(400).json({ message: `Selected table capacity (${table.capacity}) is too small for party size (${partySize})` });
        }
        assignedTableLabel = table.label;

        // Check for conflicts if table is explicitly assigned
        const buffer = settings?.bufferMinutes || 15;
        const avgTurnTime = settings?.avgTurnTimeMinutes || 60;
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

        // Check active session conflicts
        const activeSession = await TableSession.findOne({
          tenantId: req.tenantId,
          storeId,
          tableId: assignedTableId,
          status: 'active',
        }).lean();
        if (activeSession) {
          const now = new Date();
          const expectedReleaseTime = new Date(
            new Date(activeSession.seatedAt).getTime() + avgTurnTime * 60000
          );
          const earliestReservableTime = new Date(Math.max(
            now.getTime() + 60 * 60000, // 1 hour buffer from now
            expectedReleaseTime.getTime() + buffer * 60000
          ));
          if (slotStart < earliestReservableTime) {
            return res.status(409).json({
              message: 'Selected table is currently occupied by a customer and is not expected to be free in time.',
            });
          }
        }
      } else {
        // Auto-assign table
        const eligible = await getEligibleTables(
          req.tenantId,
          storeId,
          resTime,
          Number(partySize),
          resDuration
        );
        if (eligible.length > 0) {
          assignedTableId = eligible[0]._id;
          assignedTableLabel = eligible[0].label;
        } else {
          return res.status(400).json({ message: 'No eligible tables are available for the requested party size and time slot.' });
        }
      }

      // Link to customer if provided, or find/create
      let linkedCustomerId = null;
      if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
        const customer = await Customer.findOne({
          _id: customerId,
          tenantId: req.tenantId,
        });
        if (customer) linkedCustomerId = customer._id;
      }

      if (!linkedCustomerId) {
        const cleanPhoneDigits = guestPhone.trim().replace(/\D/g, '');
        let customer = null;
        if (cleanPhoneDigits.length >= 6) {
          customer = await Customer.findOne({
            tenantId: req.tenantId,
            mobileDigits: cleanPhoneDigits,
          });
        }
        if (!customer && guestEmail?.trim()) {
          customer = await Customer.findOne({
            tenantId: req.tenantId,
            email: guestEmail.trim().toLowerCase(),
          });
        }

        if (!customer) {
          customer = await Customer.create({
            tenantId: req.tenantId,
            storeId,
            name: guestName.trim(),
            mobile: guestPhone.trim(),
            email: guestEmail?.trim().toLowerCase() || '',
            createdBy: req.user.id,
            lastLoyaltyActivityAt: new Date(),
          });
        }
        linkedCustomerId = customer._id;
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
 * GET /reservations/eligible-tables - Get list of eligible tables for a time slot
 */
router.get('/eligible-tables', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) return res.status(400).json({ message: 'Store required' });

    const { reservationTime, partySize, duration, excludeReservationId } = req.query;
    if (!reservationTime) {
      return res.status(400).json({ message: 'reservationTime is required' });
    }
    if (!partySize) {
      return res.status(400).json({ message: 'partySize is required' });
    }

    const eligibleTables = await getEligibleTables(
      req.tenantId,
      storeId,
      reservationTime,
      Number(partySize),
      duration ? Number(duration) : undefined,
      excludeReservationId
    );

    res.json(eligibleTables);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

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
  authorize('cashier', 'manager', 'merchant_admin', 'steward'),
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

      const resTime = req.body.reservationTime ? new Date(req.body.reservationTime) : reservation.reservationTime;
      const partySize = req.body.partySize ? Number(req.body.partySize) : reservation.partySize;
      const resDuration = req.body.duration ? Number(req.body.duration) : reservation.duration;
      let assignedTableId = req.body.tableId !== undefined ? req.body.tableId : reservation.tableId;
      let assignedTableLabel = reservation.tableLabel;

      if (assignedTableId) {
        const table = await CafeTable.findOne({
          _id: assignedTableId,
          tenantId: req.tenantId,
          storeId: reservation.storeId,
          active: true,
        }).lean();
        if (!table) {
          return res.status(400).json({ message: 'Invalid table' });
        }
        if (table.capacity < partySize) {
          return res.status(400).json({ message: `Selected table capacity (${table.capacity}) is too small for party size (${partySize})` });
        }
        assignedTableLabel = table.label;

        // Check for conflicts
        const settings = await ReservationSettings.findOne({
          tenantId: req.tenantId,
          storeId: reservation.storeId,
        }).lean();
        const buffer = settings?.bufferMinutes || 15;
        const avgTurnTime = settings?.avgTurnTimeMinutes || 60;
        const slotStart = resTime;
        const slotEnd = new Date(resTime.getTime() + resDuration * 60000);

        const conflict = await Reservation.findOne({
          _id: { $ne: reservation._id },
          tenantId: req.tenantId,
          storeId: reservation.storeId,
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
            message: 'Selected table is already reserved for this time slot',
            conflictingReservation: conflict._id,
          });
        }

        // Check active session conflict
        const activeSession = await TableSession.findOne({
          tenantId: req.tenantId,
          storeId: reservation.storeId,
          tableId: assignedTableId,
          status: 'active',
        }).lean();
        if (activeSession) {
          const now = new Date();
          const expectedReleaseTime = new Date(
            new Date(activeSession.seatedAt).getTime() + avgTurnTime * 60000
          );
          const earliestReservableTime = new Date(Math.max(
            now.getTime() + 60 * 60000, // 1 hour buffer from now
            expectedReleaseTime.getTime() + buffer * 60000
          ));
          if (slotStart < earliestReservableTime) {
            return res.status(409).json({
              message: 'Selected table is currently occupied by a customer and is not expected to be free in time.',
            });
          }
        }
      } else {
        // Auto-assign table
        const eligible = await getEligibleTables(
          req.tenantId,
          reservation.storeId,
          resTime,
          partySize,
          resDuration,
          reservation._id
        );
        if (eligible.length > 0) {
          assignedTableId = eligible[0]._id;
          assignedTableLabel = eligible[0].label;
        } else {
          return res.status(400).json({ message: 'No eligible tables are available for the requested party size and time slot.' });
        }
      }

      reservation.guestName = req.body.guestName !== undefined ? req.body.guestName.trim() : reservation.guestName;
      reservation.guestPhone = req.body.guestPhone !== undefined ? req.body.guestPhone.trim() : reservation.guestPhone;
      reservation.guestEmail = req.body.guestEmail !== undefined ? req.body.guestEmail.trim() : reservation.guestEmail;
      reservation.reservationTime = resTime;
      reservation.partySize = partySize;
      reservation.duration = resDuration;
      reservation.tableId = assignedTableId || null;
      reservation.tableLabel = assignedTableLabel;
      reservation.zonePreference = req.body.zonePreference !== undefined ? req.body.zonePreference : reservation.zonePreference;
      reservation.specialRequests = req.body.specialRequests !== undefined ? req.body.specialRequests : reservation.specialRequests;
      reservation.internalNotes = req.body.internalNotes !== undefined ? req.body.internalNotes : reservation.internalNotes;

      // Sync customer details or create new if changed
      let linkedCustomerId = reservation.customerId;
      const phoneChanged = req.body.guestPhone !== undefined && req.body.guestPhone.trim() !== reservation.guestPhone;
      const emailChanged = req.body.guestEmail !== undefined && req.body.guestEmail.trim().toLowerCase() !== reservation.guestEmail;
      
      if (phoneChanged || emailChanged || !linkedCustomerId) {
        const phoneToUse = req.body.guestPhone !== undefined ? req.body.guestPhone : reservation.guestPhone;
        const emailToUse = req.body.guestEmail !== undefined ? req.body.guestEmail : reservation.guestEmail;
        const nameToUse = req.body.guestName !== undefined ? req.body.guestName : reservation.guestName;
        
        const cleanPhoneDigits = phoneToUse.trim().replace(/\D/g, '');
        let customer = null;
        if (cleanPhoneDigits.length >= 6) {
          customer = await Customer.findOne({
            tenantId: req.tenantId,
            mobileDigits: cleanPhoneDigits,
          });
        }
        if (!customer && emailToUse?.trim()) {
          customer = await Customer.findOne({
            tenantId: req.tenantId,
            email: emailToUse.trim().toLowerCase(),
          });
        }

        if (!customer) {
          customer = await Customer.create({
            tenantId: req.tenantId,
            storeId: reservation.storeId,
            name: nameToUse.trim(),
            mobile: phoneToUse.trim(),
            email: emailToUse?.trim().toLowerCase() || '',
            createdBy: req.user.id,
            lastLoyaltyActivityAt: new Date(),
          });
        }
        linkedCustomerId = customer._id;
      }
      reservation.customerId = linkedCustomerId;

      reservation.updatedBy = req.user.id;
      await reservation.save();

      res.json(reservation);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * PUT & PATCH /reservations/:id/status - Update reservation status
 */
const updateStatus = async (req, res) => {
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
      if (reservation.status !== 'seated' && reservation.tableId) {
        const activeSession = await TableSession.findOne({
          tenantId: req.tenantId,
          storeId: reservation.storeId,
          tableId: reservation.tableId,
          status: 'active',
        }).lean();
        if (activeSession) {
          return res.status(400).json({
            message: 'Selected table is currently occupied by another customer. Please clear the table before seating this reservation.',
          });
        }

        await TableSession.create({
          tenantId: reservation.tenantId,
          storeId: reservation.storeId,
          tableId: reservation.tableId,
          partySize: reservation.partySize,
          seatedAt: now,
          reservationId: reservation._id,
          status: 'active',
        });
      }
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
};

router.put('/:id/status', authorize('cashier', 'manager', 'merchant_admin', 'steward'), updateStatus);
router.patch('/:id/status', authorize('cashier', 'manager', 'merchant_admin', 'steward'), updateStatus);

/**
 * PUT /reservations/:id/assign-table - Assign or reassign table
 */
router.put(
  '/:id/assign-table',
  authorize('cashier', 'manager', 'merchant_admin', 'steward'),
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
