'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore } = require('../middleware/storeScope');

const router = express.Router();
const readRoles = ['manager', 'merchant_admin'];

// Apply standard POS tenant & store scoping filters
router.use(protect, tenantScope);

/**
 * Parse date range helper
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
 * GET /api/delivery-analytics/summary
 * Fetch overall summary stats for delivery orders
 */
router.get(
  '/summary',
  authorize(...readRoles),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) {
        return res.status(400).json({ message: 'Store required' });
      }

      const { start, end } = parseDateRange(req.query);

      // 1. Fetch total completed orders count (for utilization ratio calculation)
      const overallCompletedCount = await Order.countDocuments({
        tenantId: req.tenantId,
        storeId,
        createdAt: { $gte: start, $lte: end },
        status: 'completed'
      });

      // 2. Aggregate pipeline for delivery metrics
      const pipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            orderType: 'delivery',
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            activeOrders: { $sum: { $cond: [{ $in: ['$status', ['pending', 'preparing', 'ready', 'delivered']] }, 1, 0] } },
            totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
            totalDeliveryFee: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$deliveryDetails.deliveryFee', 0] }, 0] } },
            // Average turnaround in minutes (using completed or delivered orders)
            avgTurnaroundMinutes: {
              $avg: {
                $cond: [
                  { $and: [{ $in: ['$status', ['delivered', 'completed']] }, { $gt: ['$updatedAt', '$createdAt'] }] },
                  { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 60000] },
                  null
                ]
              }
            }
          }
        }
      ];

      const [deliverySummary] = await Order.aggregate(pipeline);

      const summaryResult = deliverySummary || {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        activeOrders: 0,
        totalRevenue: 0,
        totalDeliveryFee: 0,
        avgTurnaroundMinutes: 0
      };

      // 3. Status breakdown
      const statusBreakdown = await Order.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            orderType: 'delivery',
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // 4. Order source breakdown (WhatsApp, Cashier board/POS, Online)
      const sourceBreakdown = await Order.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            orderType: 'delivery',
            createdAt: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$orderSource',
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]);

      // Map breakdowns to clean key-value structures
      const statuses = {};
      ['pending', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'].forEach(s => {
        const found = statusBreakdown.find(b => b._id === s);
        statuses[s] = found ? found.count : 0;
      });

      const sources = {};
      ['pos', 'qr', 'whatsapp'].forEach(src => {
        const found = sourceBreakdown.find(b => b._id === src);
        sources[src] = found ? { count: found.count, revenue: found.revenue } : { count: 0, revenue: 0 };
      });

      // Calculate utilization rate
      const utilizationRate = overallCompletedCount > 0
        ? Math.round((summaryResult.completedOrders / overallCompletedCount) * 10000) / 10000
        : 0;

      res.json({
        period: { start, end },
        totalDeliveryOrders: summaryResult.totalOrders,
        completedDeliveryOrders: summaryResult.completedOrders,
        cancelledDeliveryOrders: summaryResult.cancelledOrders,
        activeDeliveryOrders: summaryResult.activeOrders,
        totalDeliveryRevenue: Math.round(summaryResult.totalRevenue * 100) / 100,
        totalDeliveryFeeRevenue: Math.round(summaryResult.totalDeliveryFee * 100) / 100,
        avgDeliveryAmount: summaryResult.completedOrders > 0 ? Math.round((summaryResult.totalRevenue / summaryResult.completedOrders) * 100) / 100 : 0,
        avgTurnaroundTimeMinutes: Math.round(summaryResult.avgTurnaroundMinutes || 0),
        statusVolume: statuses,
        sourceBreakdown: sources,
        utilizationRate
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/delivery-analytics/trend
 * Trend of delivery orders by day
 */
router.get(
  '/trend',
  authorize(...readRoles),
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      if (!storeId) {
        return res.status(400).json({ message: 'Store required' });
      }

      const { start, end } = parseDateRange(req.query);

      const trendPipeline = [
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(req.tenantId),
            storeId: new mongoose.Types.ObjectId(storeId),
            orderType: 'delivery',
            createdAt: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            deliveryFees: { $sum: { $ifNull: ['$deliveryDetails.deliveryFee', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ];

      const results = await Order.aggregate(trendPipeline);

      const trend = results.map(r => ({
        date: r._id,
        count: r.count,
        revenue: Math.round(r.revenue * 100) / 100,
        deliveryFees: Math.round(r.deliveryFees * 100) / 100
      }));

      res.json({
        trend,
        period: { start, end }
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
