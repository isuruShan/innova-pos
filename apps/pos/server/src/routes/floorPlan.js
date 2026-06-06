'use strict';

const express = require('express');
const mongoose = require('mongoose');
const FloorPlan = require('../models/FloorPlan');
const CafeTable = require('../models/CafeTable');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('table_management');

// Apply auth middleware to all routes
router.use(protect, tenantScope, requireTableMgmt);

/**
 * GET /floor-plan - Get floor plan for current store
 */
router.get('/', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId || (await resolveWriteStoreId(req));
    if (!storeId) {
      return res.status(400).json({ message: 'Store required' });
    }

    let plan = await FloorPlan.findOne({ 
      tenantId: req.tenantId, 
      storeId 
    }).lean();

    if (!plan) {
      // Auto-create default floor plan with existing tables
      const tables = await CafeTable.find({ 
        tenantId: req.tenantId, 
        storeId,
        active: true,
      }).sort({ sortOrder: 1 }).lean();

      const tablePositions = tables.map((t, i) => ({
        tableId: t._id,
        x: (i % 5) * 3,
        y: Math.floor(i / 5) * 3,
        width: 2,
        height: 2,
        shape: 'rectangle',
        rotation: 0,
        capacity: t.capacity || 4,
      }));

      plan = await FloorPlan.create({
        tenantId: req.tenantId,
        storeId,
        name: 'Main Floor',
        gridWidth: 20,
        gridHeight: 15,
        tables: tablePositions,
        zones: [],
        createdBy: req.user.id,
      });
      plan = plan.toObject();
    }

    res.json(plan);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * PUT /floor-plan - Update floor plan layout
 */
router.put(
  '/',
  authorize('manager', 'merchant_admin', 'superadmin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = await resolveWriteStoreId(req);
      if (!storeId) {
        return res.status(400).json({ message: 'Store required' });
      }

      const { gridWidth, gridHeight, cellSizePx, tables, zones, name, lines, texts } = req.body;

      // Validate table positions don't overlap
      if (tables && Array.isArray(tables)) {
        for (const t of tables) {
          if (!mongoose.Types.ObjectId.isValid(t.tableId)) {
            return res.status(400).json({ 
              message: `Invalid tableId: ${t.tableId}` 
            });
          }
        }
      }

      const updateData = {
        updatedBy: req.user.id,
      };
      if (name !== undefined) updateData.name = String(name).trim();
      if (gridWidth !== undefined) updateData.gridWidth = Math.min(50, Math.max(5, Number(gridWidth) || 20));
      if (gridHeight !== undefined) updateData.gridHeight = Math.min(40, Math.max(5, Number(gridHeight) || 15));
      if (cellSizePx !== undefined) updateData.cellSizePx = Math.min(100, Math.max(30, Number(cellSizePx) || 50));
      if (tables !== undefined) updateData.tables = tables;
      if (zones !== undefined) updateData.zones = zones;
      if (lines !== undefined) updateData.lines = lines;
      if (texts !== undefined) updateData.texts = texts;

      const plan = await FloorPlan.findOneAndUpdate(
        { tenantId: req.tenantId, storeId },
        { $set: updateData },
        { new: true, upsert: true, runValidators: true }
      );

      // Sync updated table capacity/shape back to CafeTable collection
      if (tables && Array.isArray(tables)) {
        for (const t of tables) {
          const updateObj = {};
          if (t.capacity !== undefined) updateObj.capacity = Math.min(20, Math.max(1, Number(t.capacity) || 4));
          if (t.shape !== undefined) updateObj.shape = String(t.shape).trim();
          
          if (Object.keys(updateObj).length > 0) {
            await CafeTable.updateOne(
              { _id: t.tableId, tenantId: req.tenantId, storeId },
              { $set: updateObj }
            );
          }
        }
      }

      res.json(plan);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /floor-plan/status - Get real-time table status overlay
 */
router.get('/status', resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!storeId) {
      return res.status(400).json({ message: 'Store required' });
    }

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Get active orders by table
    const activeOrders = await Order.find({
      tenantId: req.tenantId,
      storeId,
      tableId: { $ne: null },
      status: { $nin: ['completed', 'cancelled'] },
    })
      .select('tableId status orderNumber createdAt total guestsCount')
      .lean();

    // Get upcoming reservations
    let upcomingReservations = [];
    try {
      upcomingReservations = await Reservation.find({
        tenantId: req.tenantId,
        storeId,
        tableId: { $ne: null },
        status: { $in: ['confirmed', 'reminded', 'arrived', 'seated'] },
        reservationTime: { $lte: twoHoursFromNow, $gte: new Date(now.getTime() - 30 * 60 * 1000) },
      })
        .select('tableId reservationTime partySize status guestName')
        .lean();
    } catch (e) {
      // Reservation model may not exist yet during migration
      upcomingReservations = [];
    }

    const statusByTable = {};

    // Map orders to tables
    activeOrders.forEach((o) => {
      const key = String(o.tableId);
      const seatedMinutes = Math.round((now - new Date(o.createdAt)) / 60000);
      statusByTable[key] = {
        status: 'occupied',
        orderId: o._id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        orderTotal: o.total || 0,
        seatedAt: o.createdAt,
        seatedMinutes,
        guestsCount: o.guestsCount || null,
      };
    });

    // Map reservations to tables (only if not already occupied)
    upcomingReservations.forEach((r) => {
      const key = String(r.tableId);
      if (!statusByTable[key]) {
        const minutesUntil = Math.round((new Date(r.reservationTime) - now) / 60000);
        statusByTable[key] = {
          status: r.status === 'seated' ? 'occupied' : 'reserved',
          reservationId: r._id,
          reservationTime: r.reservationTime,
          guestName: r.guestName,
          partySize: r.partySize,
          minutesUntil,
        };
      }
    });

    res.json(statusByTable);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /floor-plan/sync-tables - Sync tables from CafeTable collection to floor plan
 */
router.post(
  '/sync-tables',
  authorize('manager', 'merchant_admin', 'superadmin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = await resolveWriteStoreId(req);
      if (!storeId) {
        return res.status(400).json({ message: 'Store required' });
      }

      const plan = await FloorPlan.findOne({ tenantId: req.tenantId, storeId });
      if (!plan) {
        return res.status(404).json({ message: 'Floor plan not found' });
      }

      const allTables = await CafeTable.find({
        tenantId: req.tenantId,
        storeId,
        active: true,
      }).sort({ sortOrder: 1 }).lean();

      const existingTableIds = new Set(plan.tables.map((t) => String(t.tableId)));
      const newTables = allTables.filter((t) => !existingTableIds.has(String(t._id)));

      if (newTables.length === 0) {
        return res.json({ message: 'No new tables to add', plan });
      }

      // Find next available position
      let maxY = 0;
      plan.tables.forEach((t) => {
        maxY = Math.max(maxY, t.y + t.height);
      });

      const newPositions = newTables.map((t, i) => ({
        tableId: t._id,
        x: (i % 5) * 3,
        y: maxY + Math.floor(i / 5) * 3,
        width: 2,
        height: 2,
        shape: 'rectangle',
        rotation: 0,
        capacity: t.capacity || 4,
      }));

      plan.tables.push(...newPositions);
      plan.updatedBy = req.user.id;
      await plan.save();

      res.json({ 
        message: `Added ${newTables.length} new table(s) to floor plan`,
        plan,
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
