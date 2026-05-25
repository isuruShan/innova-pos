'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const CashierSession = require('../models/CashierSession');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

const readRoles = ['manager', 'merchant_admin', 'superadmin'];

const castToObjectId = (id) => {
  if (!id) return id;
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
};

const getCastedMatch = (req, status = 'completed') => {
  const storeFilter = buildStoreFilter(req);
  const match = {
    tenantId: castToObjectId(req.tenantId),
  };
  if (status) {
    match.status = status;
  }
  if (storeFilter.storeId) {
    match.storeId = castToObjectId(storeFilter.storeId);
  } else if (storeFilter.$or) {
    match.$or = storeFilter.$or.map(cond => {
      if (cond.storeId) {
        return { storeId: castToObjectId(cond.storeId) };
      }
      return cond;
    });
  }
  return match;
};

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

      const match = getCastedMatch(req, 'completed');

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

      const match = getCastedMatch(req, 'completed');

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

      const [facetResult] = await Order.aggregate([
        { $match: match },
        {
          $facet: {
            byType: [
              {
                $group: {
                  _id: '$orderType',
                  ordersCount: { $sum: 1 },
                  revenue: { $sum: '$totalAmount' },
                },
              },
            ],
            bySource: [
              {
                $group: {
                  _id: '$orderSource',
                  ordersCount: { $sum: 1 },
                  revenue: { $sum: '$totalAmount' },
                },
              },
            ],
          },
        },
      ]);

      const groupByType = facetResult?.byType || [];
      const groupBySource = facetResult?.bySource || [];

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

      const match = getCastedMatch(req, 'completed');

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

      const match = getCastedMatch(req, 'completed');

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

      const match = getCastedMatch(req, null);
      match['returns.0'] = { $exists: true };

      const pipeline = [
        { $match: match },
        { $unwind: '$returns' },
      ];

      const returnMatch = {};
      if (since || until) {
        returnMatch['returns.returnedAt'] = {};
        if (since) returnMatch['returns.returnedAt'].$gte = new Date(since);
        if (until) returnMatch['returns.returnedAt'].$lte = new Date(until);
      }
      if (reason) {
        returnMatch['returns.reason'] = { $regex: String(reason).trim(), $options: 'i' };
      }
      if (cashierId) {
        const mongoose = require('mongoose');
        const cashierObjId = new mongoose.Types.ObjectId(cashierId);
        returnMatch.$or = [
          { 'returns.returnedBy': cashierObjId },
          { 'returns.approvedBy': cashierObjId },
        ];
      }

      if (Object.keys(returnMatch).length > 0) {
        pipeline.push({ $match: returnMatch });
      }

      pipeline.push({ $sort: { 'returns.returnedAt': -1 } });

      pipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'returns.returnedBy',
            foreignField: '_id',
            as: 'returnedByPopulated',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'returns.approvedBy',
            foreignField: '_id',
            as: 'approvedByPopulated',
          },
        }
      );

      pipeline.push({
        $project: {
          _id: 0,
          orderId: '$_id',
          orderNumber: 1,
          returnedAt: '$returns.returnedAt',
          returnedBy: {
            $cond: {
              if: { $gt: [{ $size: '$returnedByPopulated' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$returnedByPopulated._id', 0] },
                name: { $arrayElemAt: ['$returnedByPopulated.name', 0] },
                email: { $arrayElemAt: ['$returnedByPopulated.email', 0] },
              },
              else: null,
            },
          },
          approvedBy: {
            $cond: {
              if: { $gt: [{ $size: '$approvedByPopulated' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$approvedByPopulated._id', 0] },
                name: { $arrayElemAt: ['$approvedByPopulated.name', 0] },
                email: { $arrayElemAt: ['$approvedByPopulated.email', 0] },
              },
              else: null,
            },
          },
          reason: { $ifNull: ['$returns.reason', 'No reason provided'] },
          refundAmount: '$returns.refundAmount',
          items: '$returns.items',
        },
      });

      const allRefunds = await Order.aggregate(pipeline);
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
