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
          revenue: {
            $sum: {
              $multiply: [
                {
                  $add: [
                    '$items.price',
                    {
                      $reduce: {
                        input: { $ifNull: ['$items.modifiers', []] },
                        initialValue: 0,
                        in: { $add: ['$$value', { $multiply: ['$$this.price', { $ifNull: ['$$this.qty', 1] }] }] }
                      }
                    }
                  ]
                },
                '$items.qty'
              ]
            }
          },
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

/**
 * GET /api/reports/extended/cashier-sessions/:id/detail
 * Fetch cashier session detail including orders and returns.
 */
router.get(
  '/cashier-sessions/:id/detail',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const session = await CashierSession.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
        storeId: req.storeId,
      }).populate('cashierId', 'name email').lean();

      if (!session) {
        return res.status(404).json({ message: 'Cashier session not found' });
      }

      const Order = require('../models/Order');
      
      const openedAt = new Date(session.openedAt);
      const closedAt = session.closedAt ? new Date(session.closedAt) : new Date();
      const cashierId = session.cashierId?._id || session.cashierId;

      const orderMatch = {
        tenantId: req.tenantId,
        storeId: req.storeId,
        status: { $ne: 'cancelled' },
        paymentCollected: true,
        updatedAt: { $gte: openedAt, $lte: closedAt },
        $or: [
          { updatedBy: cashierId },
          { createdBy: cashierId, updatedBy: { $in: [null, undefined] } }
        ],
      };

      const orders = await Order.find(orderMatch)
        .select('orderNumber status paymentType totalAmount discountTotal createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const returnsMatch = {
        tenantId: req.tenantId,
        storeId: req.storeId,
        'returns.returnedBy': cashierId,
        'returns.returnedAt': { $gte: openedAt, $lte: closedAt },
      };

      const returnedOrders = await Order.find(returnsMatch)
        .select('orderNumber paymentType returns')
        .lean();

      const returnsList = [];
      returnedOrders.forEach(o => {
        (o.returns || []).forEach(r => {
          if (
            String(r.returnedBy) === String(cashierId) &&
            new Date(r.returnedAt) >= openedAt &&
            new Date(r.returnedAt) <= closedAt
          ) {
            returnsList.push({
              orderId: o._id,
              orderNumber: o.orderNumber,
              paymentType: o.paymentType,
              refundAmount: r.refundAmount,
              returnedAt: r.returnedAt,
              notes: r.notes || '',
              items: r.items || [],
            });
          }
        });
      });

      returnsList.sort((a, b) => new Date(b.returnedAt) - new Date(a.returnedAt));

      res.json({
        session,
        orders,
        returns: returnsList,
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/cogs
 * COGS & Gross Profit Margin Report
 */
router.get(
  '/cogs',
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

      // 1. Fetch completed orders
      const orders = await Order.find(match).lean();

      // 2. Aggregate quantity sold and revenue per menu item + variant
      const soldMap = {};
      orders.forEach(order => {
        const orderItems = order.items || [];
        const orderSubtotal = orderItems.reduce((sum, i) => {
          const modifiersSum = (i.modifiers || []).reduce((s, m) => s + m.price * (m.qty || 1), 0);
          return sum + (i.price + modifiersSum) * i.qty;
        }, 0);
        const orderDiscount = order.discountTotal || 0;
        const orderCommission = order.commissionAmount || 0;

        orderItems.forEach(item => {
          if (!item.menuItem) return;
          const key = `${item.menuItem}_${item.variantId || 'base'}`;
          if (!soldMap[key]) {
            soldMap[key] = {
              menuItemId: item.menuItem,
              variantId: item.variantId || null,
              itemName: item.name + (item.variantName ? ` (${item.variantName})` : ''),
              category: item.category || 'Other',
              quantitySold: 0,
              totalRevenue: 0,
              totalDiscount: 0,
              totalCommission: 0,
            };
          }
          const modifiersSum = (item.modifiers || []).reduce((s, m) => s + m.price * (m.qty || 1), 0);
          const lineUnitPrice = item.price + modifiersSum;
          const itemRevenue = lineUnitPrice * item.qty;
          soldMap[key].quantitySold += item.qty;
          soldMap[key].totalRevenue += itemRevenue;

          // Distribute order-level discount + commission proportionally by item's revenue share
          if (orderSubtotal > 0) {
            const share = itemRevenue / orderSubtotal;
            if (orderDiscount > 0) {
              soldMap[key].totalDiscount += orderDiscount * share;
            }
            if (orderCommission > 0) {
              soldMap[key].totalCommission += orderCommission * share;
            }
          }
        });
      });

      const menuItemIds = [...new Set(Object.values(soldMap).map(s => s.menuItemId))];

      // 3. Fetch ingredient links populated with inventory unit costs
      const IngredientLink = require('../models/IngredientLink');
      const links = await IngredientLink.find({
        tenantId: req.tenantId,
        menuItemId: { $in: menuItemIds }
      }).populate('inventoryItemId');

      // 4. Get tenant costing method
      const TenantSettings = require('../models/TenantSettings');
      const tenantSettings = await TenantSettings.findOne({ tenantId: req.tenantId });
      const costingMethod = tenantSettings?.inventoryCostingMethod || 'wac';
      
      const FORMULA_FIELDS = {
        wac: 'wacCost',
        fifo: 'fifoCost',
        lifo: 'lifoCost',
        last_cost: 'lastCost',
      };
      const costField = FORMULA_FIELDS[costingMethod] || 'wacCost';

      // Helper to calculate recipe cost of a menu item/variant
      const calculateUnitCost = (menuItemId, variantId) => {
        let cost = 0;
        const itemLinks = links.filter(l => String(l.menuItemId) === String(menuItemId));
        
        // Exact variant links
        const variantLinks = itemLinks.filter(l => l.variantId && String(l.variantId) === String(variantId));
        const activeLinks = variantLinks.length > 0 ? variantLinks : itemLinks.filter(l => !l.variantId);

        activeLinks.forEach(link => {
          const inv = link.inventoryItemId;
          if (inv) {
            const unitCost = inv[costField] || 0;
            const wastageMult = 1 + (link.wastagePercentage || 0) / 100;
            cost += link.quantity * wastageMult * unitCost;
          }
        });
        return cost;
      };

      // 5. Build final report payload
      const results = Object.values(soldMap).map(sold => {
        const unitCost = calculateUnitCost(sold.menuItemId, sold.variantId);
        const totalCost = unitCost * sold.quantitySold;
        const grossProfit = sold.totalRevenue - totalCost;
        const marginPercentage = sold.totalRevenue > 0 ? (grossProfit / sold.totalRevenue) * 100 : 0;

        return {
          ...sold,
          unitCost: Math.round(unitCost * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          marginPercentage: Math.round(marginPercentage * 100) / 100
        };
      });

      res.json(results);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/wastage
 * Wastage, Spillage & Variance report
 */
router.get(
  '/wastage',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { since, until } = req.query;

      const storeFilter = buildStoreFilter(req);
      const match = {
        tenantId: new mongoose.Types.ObjectId(req.tenantId),
        ...(storeFilter.storeId ? { storeId: new mongoose.Types.ObjectId(storeFilter.storeId) } : {})
      };

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.date = dateFilter;
      }

      // 1. Fetch wastage reports
      const WastageReport = require('../models/WastageReport');
      const reports = await WastageReport.find(match)
        .populate('createdBy', 'name')
        .populate('items.inventoryItemId')
        .populate('items.menuItemId')
        .lean();

      // 2. Get tenant costing method
      const TenantSettings = require('../models/TenantSettings');
      const tenantSettings = await TenantSettings.findOne({ tenantId: req.tenantId });
      const costingMethod = tenantSettings?.inventoryCostingMethod || 'wac';
      
      const FORMULA_FIELDS = {
        wac: 'wacCost',
        fifo: 'fifoCost',
        lifo: 'lifoCost',
        last_cost: 'lastCost',
      };
      const costField = FORMULA_FIELDS[costingMethod] || 'wacCost';

      // 3. Pre-fetch recipes for wasted menu items
      const menuIds = [];
      reports.forEach(r => {
        (r.items || []).forEach(it => {
          if (it.itemType === 'menu' && it.menuItemId) {
            menuIds.push(it.menuItemId._id);
          }
        });
      });

      const IngredientLink = require('../models/IngredientLink');
      const links = await IngredientLink.find({
        tenantId: req.tenantId,
        menuItemId: { $in: menuIds }
      }).populate('inventoryItemId');

      const calculateMenuUnitCost = (menuItemId, variantId) => {
        let cost = 0;
        const itemLinks = links.filter(l => String(l.menuItemId) === String(menuItemId));
        const variantLinks = itemLinks.filter(l => l.variantId && String(l.variantId) === String(variantId));
        const activeLinks = variantLinks.length > 0 ? variantLinks : itemLinks.filter(l => !l.variantId);

        activeLinks.forEach(link => {
          const inv = link.inventoryItemId;
          if (inv) {
            const unitCost = inv[costField] || 0;
            cost += link.quantity * (1 + (link.wastagePercentage || 0) / 100) * unitCost;
          }
        });
        return cost;
      };

      // 4. Compute financial wastage
      const processedItems = [];
      const reasonSummary = { expiry: 0, damage: 0, spillage: 0, other: 0 };

      reports.forEach(report => {
        (report.items || []).forEach(it => {
          let unitCost = 0;
          let name = '';
          
          if (it.itemType === 'inventory' && it.inventoryItemId) {
            unitCost = it.inventoryItemId[costField] || 0;
            name = it.inventoryItemId.itemName;
          } else if (it.itemType === 'menu' && it.menuItemId) {
            unitCost = calculateMenuUnitCost(it.menuItemId._id, it.variantId);
            name = it.menuItemId.name;
          }
          
          const totalLoss = unitCost * it.quantity;
          const reasonKey = it.reason || 'other';
          reasonSummary[reasonKey] = (reasonSummary[reasonKey] || 0) + totalLoss;
          
          processedItems.push({
            date: report.date,
            itemName: name,
            itemType: it.itemType,
            quantity: it.quantity,
            unit: it.itemType === 'inventory' ? it.inventoryItemId?.unit : 'pcs',
            reason: it.reason,
            unitCost: Math.round(unitCost * 100) / 100,
            totalLoss: Math.round(totalLoss * 100) / 100,
            createdBy: report.createdBy?.name || 'Staff'
          });
        });
      });

      res.json({
        byReason: Object.keys(reasonSummary).map(r => ({
          reason: r,
          cost: Math.round(reasonSummary[r] * 100) / 100
        })),
        items: processedItems
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

/**
 * GET /api/reports/extended/loyalty
 * Loyalty Accrual & Redemption Report
 */
router.get(
  '/loyalty',
  protect,
  authorize(...readRoles),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      // 1. Check subscription gate
      const Tenant = require('../models/Tenant');
      const tenant = await Tenant.findById(req.tenantId);
      
      if (!tenant?.paidAddons?.loyalty?.active) {
        return res.json({ isSubscribed: false });
      }

      const { since, until } = req.query;
      const match = getCastedMatch(req, 'completed');

      const dateFilter = {};
      if (since) dateFilter.$gte = new Date(since);
      if (until) dateFilter.$lte = new Date(until);
      if (Object.keys(dateFilter).length > 0) {
        match.createdAt = dateFilter;
      }

      // 2. Fetch completed orders
      const orders = await Order.find(match).lean();

      let pointsIssued = 0;
      let pointsRedeemed = 0;
      let redemptionDiscount = 0;
      const uniqueCustomers = new Set();

      // Initialize daily trend map
      const dailyMap = {};
      const startDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = until ? new Date(until) : new Date();
      
      const dayDiff = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
      for (let i = 0; i <= dayDiff; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split('T')[0];
        dailyMap[key] = { date: key, issued: 0, redeemed: 0, discount: 0 };
      }

      orders.forEach(order => {
        pointsIssued += order.loyaltyPointsEarned || 0;
        if (order.loyaltyRedemption) {
          pointsRedeemed += order.loyaltyRedemption.pointsCost || 0;
          redemptionDiscount += order.loyaltyRedemption.discountAmount || 0;
        }
        if (order.customerId) {
          uniqueCustomers.add(String(order.customerId));
        }
        
        const dayKey = order.createdAt.toISOString().split('T')[0];
        if (dailyMap[dayKey]) {
          dailyMap[dayKey].issued += order.loyaltyPointsEarned || 0;
          if (order.loyaltyRedemption) {
            dailyMap[dayKey].redeemed += order.loyaltyRedemption.pointsCost || 0;
            dailyMap[dayKey].discount += order.loyaltyRedemption.discountAmount || 0;
          }
        }
      });

      res.json({
        isSubscribed: true,
        summary: {
          pointsIssued,
          pointsRedeemed,
          redemptionDiscountTotal: Math.round(redemptionDiscount * 100) / 100,
          activeMembersCount: uniqueCustomers.size
        },
        trend: Object.values(dailyMap)
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
