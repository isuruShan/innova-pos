'use strict';

const express = require('express');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const CashierSession = require('../models/CashierSession');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

const readRoles = ['manager', 'merchant_admin', 'superadmin'];

/**
 * GET /api/reports/extended/menu-mix
 * Sales aggregate by menu item and category.
 */
router.get(
  '/menu-mix',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until, search, categories } = req.query;

      const storeFilter = buildStoreFilter(req);
      const match = {
        tenantId: req.tenantId,
        ...storeFilter,
        status: 'completed',
      };

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.createdAt = dateFilter;
      }

      const pipeline = [
        { $match: match },
        { $unwind: '$items' },
      ];

      const itemMatch = {};
      if (search) {
        itemMatch['items.name'] = { $regex: String(search).trim(), $options: 'i' };
      }
      if (categories) {
        const cats = Array.isArray(categories)
          ? categories
          : String(categories).split(',').map(c => c.trim()).filter(Boolean);
        if (cats.length > 0) {
          itemMatch['items.category'] = { $in: cats };
        }
      }

      if (Object.keys(itemMatch).length > 0) {
        pipeline.push({ $match: itemMatch });
      }

      pipeline.push({
        $group: {
          _id: '$items.menuItem',
          name: { $first: '$items.name' },
          category: { $first: { $ifNull: ['$items.category', 'Uncategorized'] } },
          qty: { $sum: '$items.qty' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        },
      });

      const results = await Order.aggregate(pipeline);
      res.json(results);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/order-distribution
 * Revenue splits by order type and order source.
 */
router.get(
  '/order-distribution',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until, orderTypes, orderSources } = req.query;

      const storeFilter = buildStoreFilter(req);
      const match = {
        tenantId: req.tenantId,
        ...storeFilter,
        status: 'completed',
      };

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.createdAt = dateFilter;
      }

      if (orderTypes) {
        const types = Array.isArray(orderTypes)
          ? orderTypes
          : String(orderTypes).split(',').map(t => t.trim()).filter(Boolean);
        if (types.length > 0) {
          match.orderType = { $in: types };
        }
      }
      if (orderSources) {
        const sources = Array.isArray(orderSources)
          ? orderSources
          : String(orderSources).split(',').map(s => s.trim()).filter(Boolean);
        if (sources.length > 0) {
          match.orderSource = { $in: sources };
        }
      }

      const groupByType = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$orderType',
            ordersCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
      ]);

      const groupBySource = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$orderSource',
            ordersCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
      ]);

      res.json({
        byType: groupByType.map(g => ({
          type: g._id || 'dine-in',
          orders: g.ordersCount,
          revenue: Math.round(g.revenue * 100) / 100,
        })),
        bySource: groupBySource.map(g => ({
          source: g._id || 'pos',
          orders: g.ordersCount,
          revenue: Math.round(g.revenue * 100) / 100,
        })),
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/hourly-sales
 * Revenue splits hour by hour.
 */
router.get(
  '/hourly-sales',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until, timezone = 'Asia/Colombo' } = req.query;

      const storeFilter = buildStoreFilter(req);
      const match = {
        tenantId: req.tenantId,
        ...storeFilter,
        status: 'completed',
      };

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.createdAt = dateFilter;
      }

      const results = await Order.aggregate([
        { $match: match },
        {
          $project: {
            hour: { $hour: { date: '$createdAt', timezone } },
            totalAmount: 1,
          },
        },
        {
          $group: {
            _id: '$hour',
            ordersCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        orders: 0,
        revenue: 0,
        avgOrderValue: 0,
      }));

      results.forEach(r => {
        const h = r._id;
        if (h >= 0 && h < 24) {
          hourlyData[h].orders = r.ordersCount;
          hourlyData[h].revenue = Math.round(r.revenue * 100) / 100;
          hourlyData[h].avgOrderValue = r.ordersCount > 0
            ? Math.round((r.revenue / r.ordersCount) * 100) / 100
            : 0;
        }
      });

      res.json(hourlyData);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/payment-reconciliation
 * Sales grouped by payment type.
 */
router.get(
  '/payment-reconciliation',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until } = req.query;

      const storeFilter = buildStoreFilter(req);
      const match = {
        tenantId: req.tenantId,
        ...storeFilter,
        status: 'completed',
      };

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.createdAt = dateFilter;
      }

      const results = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentType',
            ordersCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
      ]);

      const formatted = results.map(r => ({
        paymentType: r._id || 'cash',
        orders: r.ordersCount,
        revenue: Math.round(r.revenue * 100) / 100,
        avgOrderValue: r.ordersCount > 0
          ? Math.round((r.revenue / r.ordersCount) * 100) / 100
          : 0,
      }));

      res.json(formatted);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/refunds
 * Return transactions list with cashier and approval data.
 */
router.get(
  '/refunds',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until, reason, cashierId } = req.query;

      const storeFilter = buildStoreFilter(req);
      const orders = await Order.find({
        tenantId: req.tenantId,
        ...storeFilter,
        'returns.0': { $exists: true },
      })
        .populate('returns.returnedBy', 'name email')
        .populate('returns.approvedBy', 'name email')
        .select('orderNumber returns')
        .lean();

      let allRefunds = [];
      orders.forEach(o => {
        o.returns.forEach(r => {
          allRefunds.push({
            orderId: o._id,
            orderNumber: o.orderNumber,
            returnedAt: r.returnedAt,
            returnedBy: r.returnedBy,
            approvedBy: r.approvedBy,
            reason: r.reason || 'No reason provided',
            refundAmount: r.refundAmount,
            items: r.items,
          });
        });
      });

      // Filters
      if (since) {
        const sDate = new Date(since);
        allRefunds = allRefunds.filter(r => new Date(r.returnedAt) >= sDate);
      }
      if (until) {
        const uDate = new Date(until);
        allRefunds = allRefunds.filter(r => new Date(r.returnedAt) <= uDate);
      }
      if (reason) {
        const rSearch = String(reason).trim().toLowerCase();
        allRefunds = allRefunds.filter(r => r.reason.toLowerCase().includes(rSearch));
      }
      if (cashierId) {
        allRefunds = allRefunds.filter(r =>
          String(r.returnedBy?._id) === String(cashierId) ||
          String(r.approvedBy?._id) === String(cashierId)
        );
      }

      // Sort chronological descending
      allRefunds.sort((a, b) => new Date(b.returnedAt) - new Date(a.returnedAt));
      res.json(allRefunds);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/cashier-sessions
 * List shift drawer session history with variances.
 */
router.get(
  '/cashier-sessions',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until, cashierId, hasVariance } = req.query;

      const match = {
        tenantId: req.tenantId,
        storeId: req.storeId,
        status: 'closed',
      };

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.closedAt = dateFilter;
      }

      if (cashierId) {
        match.cashierId = cashierId;
      }

      if (hasVariance === 'true') {
        match.varianceAmount = { $ne: 0, $exists: true };
      }

      const sessions = await CashierSession.find(match)
        .populate('cashierId', 'name email')
        .sort({ closedAt: -1 })
        .lean();

      res.json(sessions);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
