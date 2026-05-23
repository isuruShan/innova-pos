'use strict';

const express = require('express');
const mongoose = require('mongoose');
const TableSession = require('../models/TableSession');
const CafeTable = require('../models/CafeTable');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('table_management');

router.use(protect, tenantScope, requireTableMgmt);

/**
 * Parse date range from query params
 */
function parseDateRange(query) {
  const { startDate, endDate, period = '7d' } = query;
  
  let start, end;
  const now = new Date();
  
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    switch (period) {
      case '1d':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case '7d':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case '30d':
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case '90d':
        start = new Date(now);
        start.setDate(start.getDate() - 90);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    }
  }
  
  return { start, end };
}

/**
 * GET /table-analytics/summary - Dashboard summary KPIs
 */
router.get(
  '/summary',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const { start, end } = parseDateRange(req.query);

      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            seatedAt: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            totalRevenue: { $sum: '$orderTotal' },
            totalCovers: { $sum: { $ifNull: ['$partySize', 0] } },
            avgDuration: { $avg: '$durationMinutes' },
            avgRevenuePerCover: { $avg: '$revenuePerCover' },
            avgPartySize: { $avg: '$partySize' },
            completedSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
      ];

      const [result] = await TableSession.aggregate(pipeline);

      // Get table count for turnover calculation
      const tableCount = await CafeTable.countDocuments({
        tenantId: req.tenantId,
        storeId,
        active: true,
      });

      // Calculate days in range
      const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

      const summary = result || {
        totalSessions: 0,
        totalRevenue: 0,
        totalCovers: 0,
        avgDuration: 0,
        avgRevenuePerCover: 0,
        avgPartySize: 0,
        completedSessions: 0,
      };

      // Calculate derived metrics
      summary.turnoversPerDay = tableCount > 0 
        ? Math.round((summary.totalSessions / daysDiff / tableCount) * 100) / 100 
        : 0;
      summary.avgRevenuePerTable = tableCount > 0 
        ? Math.round(summary.totalRevenue / tableCount) 
        : 0;
      summary.tableCount = tableCount;
      summary.daysPeriod = daysDiff;
      summary.dateRange = { start, end };

      res.json(summary);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /table-analytics/by-table - Per-table breakdown
 */
router.get(
  '/by-table',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const { start, end } = parseDateRange(req.query);
      const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            seatedAt: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$tableId',
            tableLabel: { $first: '$tableLabel' },
            sessions: { $sum: 1 },
            totalRevenue: { $sum: '$orderTotal' },
            totalCovers: { $sum: { $ifNull: ['$partySize', 0] } },
            avgDuration: { $avg: '$durationMinutes' },
            avgRevenuePerCover: { $avg: '$revenuePerCover' },
            avgPartySize: { $avg: '$partySize' },
          },
        },
        {
          $addFields: {
            turnoversPerDay: { $divide: ['$sessions', daysDiff] },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ];

      const results = await TableSession.aggregate(pipeline);

      // Get all tables to include those with no sessions
      const allTables = await CafeTable.find({
        tenantId: req.tenantId,
        storeId,
        active: true,
      }).lean();

      const sessionsByTable = new Map(results.map((r) => [String(r._id), r]));

      const enriched = allTables.map((table) => {
        const stats = sessionsByTable.get(String(table._id));
        return {
          tableId: table._id,
          tableLabel: table.label,
          capacity: table.capacity,
          sessions: stats?.sessions || 0,
          totalRevenue: stats?.totalRevenue || 0,
          totalCovers: stats?.totalCovers || 0,
          avgDuration: Math.round(stats?.avgDuration || 0),
          avgRevenuePerCover: Math.round((stats?.avgRevenuePerCover || 0) * 100) / 100,
          avgPartySize: Math.round((stats?.avgPartySize || 0) * 10) / 10,
          turnoversPerDay: Math.round((stats?.turnoversPerDay || 0) * 100) / 100,
        };
      });

      res.json({
        tables: enriched.sort((a, b) => b.totalRevenue - a.totalRevenue),
        dateRange: { start, end },
        daysPeriod: daysDiff,
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /table-analytics/by-hour - Hourly heatmap data
 */
router.get(
  '/by-hour',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const { start, end } = parseDateRange(req.query);

      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            seatedAt: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: {
              dayOfWeek: '$dayOfWeek',
              hourOfDay: '$hourOfDay',
            },
            sessions: { $sum: 1 },
            revenue: { $sum: '$orderTotal' },
            covers: { $sum: { $ifNull: ['$partySize', 0] } },
          },
        },
        { $sort: { '_id.dayOfWeek': 1, '_id.hourOfDay': 1 } },
      ];

      const results = await TableSession.aggregate(pipeline);

      // Create full heatmap matrix (7 days x 24 hours)
      const heatmap = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const match = results.find(
            (r) => r._id.dayOfWeek === day && r._id.hourOfDay === hour
          );
          heatmap.push({
            dayOfWeek: day,
            hourOfDay: hour,
            sessions: match?.sessions || 0,
            revenue: match?.revenue || 0,
            covers: match?.covers || 0,
          });
        }
      }

      res.json({
        heatmap,
        dateRange: { start, end },
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /table-analytics/by-day-part - Breakdown by meal period
 */
router.get(
  '/by-day-part',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const { start, end } = parseDateRange(req.query);

      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            seatedAt: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$dayPart',
            sessions: { $sum: 1 },
            revenue: { $sum: '$orderTotal' },
            covers: { $sum: { $ifNull: ['$partySize', 0] } },
            avgDuration: { $avg: '$durationMinutes' },
            avgRevenuePerCover: { $avg: '$revenuePerCover' },
          },
        },
        { $sort: { revenue: -1 } },
      ];

      const results = await TableSession.aggregate(pipeline);

      // Ensure all day parts are present
      const dayParts = ['breakfast', 'lunch', 'dinner', 'late_night'];
      const byPart = new Map(results.map((r) => [r._id, r]));

      const enriched = dayParts.map((part) => {
        const data = byPart.get(part);
        return {
          dayPart: part,
          sessions: data?.sessions || 0,
          revenue: data?.revenue || 0,
          covers: data?.covers || 0,
          avgDuration: Math.round(data?.avgDuration || 0),
          avgRevenuePerCover: Math.round((data?.avgRevenuePerCover || 0) * 100) / 100,
        };
      });

      res.json({
        breakdown: enriched,
        dateRange: { start, end },
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /table-analytics/trend - Daily turnover rate trend
 */
router.get(
  '/trend',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const { start, end } = parseDateRange(req.query);

      const tableCount = await CafeTable.countDocuments({
        tenantId: req.tenantId,
        storeId,
        active: true,
      });

      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            seatedAt: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$seatedAt' },
            },
            sessions: { $sum: 1 },
            revenue: { $sum: '$orderTotal' },
            covers: { $sum: { $ifNull: ['$partySize', 0] } },
            avgDuration: { $avg: '$durationMinutes' },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const results = await TableSession.aggregate(pipeline);

      const trend = results.map((r) => ({
        date: r._id,
        sessions: r.sessions,
        revenue: r.revenue,
        covers: r.covers,
        avgDuration: Math.round(r.avgDuration || 0),
        turnoversPerTable: tableCount > 0 
          ? Math.round((r.sessions / tableCount) * 100) / 100 
          : 0,
        revenuePerTable: tableCount > 0 
          ? Math.round(r.revenue / tableCount) 
          : 0,
      }));

      res.json({
        trend,
        tableCount,
        dateRange: { start, end },
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /table-analytics/service-times - Service quality metrics
 */
router.get(
  '/service-times',
  authorize('manager', 'merchant_admin'),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) return res.status(400).json({ message: 'Store required' });

      const { start, end } = parseDateRange(req.query);

      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            seatedAt: { $gte: start, $lte: end },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            avgFirstOrder: { $avg: '$firstItemOrderedMinutes' },
            avgLastServed: { $avg: '$lastItemServedMinutes' },
            avgPayment: { $avg: '$paymentCollectedMinutes' },
            avgDuration: { $avg: '$durationMinutes' },
            totalSessions: { $sum: 1 },
          },
        },
      ];

      const [result] = await TableSession.aggregate(pipeline);

      const metrics = {
        avgFirstOrderMinutes: Math.round(result?.avgFirstOrder || 0),
        avgLastServedMinutes: Math.round(result?.avgLastServed || 0),
        avgPaymentMinutes: Math.round(result?.avgPayment || 0),
        avgTotalDuration: Math.round(result?.avgDuration || 0),
        totalSessions: result?.totalSessions || 0,
        dateRange: { start, end },
      };

      res.json(metrics);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
