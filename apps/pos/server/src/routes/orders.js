const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Settings = require('../models/Settings');
const Store = require('../models/Store');
const CafeTable = require('../models/CafeTable');
const Promotion = require('../models/Promotion');
const Customer = require('../models/Customer');
const LoyaltyProgramConfig = require('../models/LoyaltyProgramConfig');
const LoyaltyReward = require('../models/LoyaltyReward');
const LoyaltyTier = require('../models/LoyaltyTier');
const { computeLoyaltyRewardDiscount, getEffectiveTier } = require('../lib/loyaltyTier');
const { applyPromotions } = require('../utils/applyPromotions');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { notifyPosStaffOrderStatusChange } = require('../lib/notificationHelpers');
const {
  enrichItems,
  mergeItemsForUpdate,
  recalculateOrderMoney,
} = require('../utils/orderHelpers');

const router = express.Router();

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const FORWARD_TRANSITIONS = { pending: 'preparing', preparing: 'ready', ready: 'completed' };

async function assertTableAvailable({ tenantId, storeId, tableId, excludeOrderId }) {
  if (!tableId) return;
  const filter = {
    tenantId,
    storeId,
    tableId,
    status: { $nin: ['completed', 'cancelled'] },
  };
  if (excludeOrderId) filter._id = { $ne: excludeOrderId };
  const clash = await Order.findOne(filter).select('orderNumber').lean();
  if (clash) {
    const err = new Error(`Table is already in use (order #${clash.orderNumber})`);
    err.statusCode = 409;
    throw err;
  }
}

// GET all orders — supports ?status=, ?orderType=, ?paymentType=, ?since=, ?until=, ?search=
router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { status, orderType, paymentType, since, until, search } = req.query;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (orderType) {
      const types = orderType.split(',').map(s => s.trim()).filter(Boolean);
      filter.orderType = types.length === 1 ? types[0] : { $in: types };
    }
    if (paymentType) {
      const pmts = paymentType.split(',').map(s => s.trim()).filter(Boolean);
      filter.paymentType = pmts.length === 1 ? pmts[0] : { $in: pmts };
    }
    if (since || until) {
      filter.createdAt = {};
      if (since) filter.createdAt.$gte = new Date(since);
      if (until) filter.createdAt.$lte = new Date(until);
    }
    if (search) {
      const n = parseInt(search, 10);
      if (!isNaN(n)) filter.orderNumber = n;
    }

    const orders = await Order.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET single order
router.get('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) })
      .populate('createdBy', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST create order
router.post('/', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const headerReqId = (req.headers['x-client-request-id'] || '').trim();
    const clientRequestId = headerReqId || (typeof req.body.clientRequestId === 'string' ? req.body.clientRequestId.trim() : '') || '';

    if (clientRequestId) {
      const dup = await Order.findOne({ tenantId: req.tenantId, clientRequestId });
      if (dup) return res.status(200).json(dup);
    }

    const {
      orderType = 'dine-in',
      tableNumber,
      tableId: tableIdRaw,
      reference,
      items,
      paymentType,
      paymentAmount,
      customerId,
      loyaltyRewardId,
    } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'Items are required' });

    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for order creation' });

    const storeDoc = await Store.findById(storeId).lean();
    const tableMgmt = storeDoc?.tableManagementEnabled === true;

    let resolvedTableId = null;
    let resolvedTableLabel = (tableNumber || '').trim();

    if (orderType === 'dine-in') {
      if (tableMgmt) {
        if (!tableIdRaw || !mongoose.Types.ObjectId.isValid(String(tableIdRaw))) {
          return res.status(400).json({ message: 'Select a table for dine-in' });
        }
        const tbl = await CafeTable.findOne({
          _id: tableIdRaw,
          tenantId: req.tenantId,
          storeId,
          active: true,
        }).lean();
        if (!tbl) return res.status(400).json({ message: 'Invalid or inactive table' });
        try {
          await assertTableAvailable({ tenantId: req.tenantId, storeId, tableId: tbl._id });
        } catch (e) {
          const code = e.statusCode === 409 ? 409 : 400;
          return res.status(code).json({ message: e.message });
        }
        resolvedTableId = tbl._id;
        resolvedTableLabel = tbl.label;
      } else if (!resolvedTableLabel) {
        return res.status(400).json({ message: 'Table number is required for dine-in orders' });
      }
    }

    const deferPayment = orderType === 'dine-in' && tableMgmt;
    if (deferPayment && loyaltyRewardId) {
      return res.status(400).json({
        message:
          'Pay-at-table tabs cannot redeem loyalty rewards when opening the order. Remove the reward to continue.',
      });
    }

    const uniqueMenuIds = [...new Set(items.map((i) => String(i.menuItem)))];
    const menuDocsCount = await MenuItem.countDocuments({ _id: { $in: uniqueMenuIds }, tenantId: req.tenantId, storeId });
    if (menuDocsCount !== uniqueMenuIds.length) {
      return res.status(400).json({ message: 'One or more items are not available in the selected store' });
    }
    const enrichedItems = await enrichItems(items, req.tenantId, storeId);
    const subtotal = enrichedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    // Fetch per-tenant settings
    let taxComponents = [], serviceFeeRate = 0, serviceFeeFixed = 0, serviceFeeType = 'percentage';
    try {
      const settings = await Settings.findOne({ tenantId: req.tenantId, storeId });
      const ts = settings?.orderTypes?.[orderType];
      if (ts) {
        taxComponents = ts.taxComponents || [];
        serviceFeeType = ts.serviceFeeType || 'percentage';
        serviceFeeRate = ts.serviceFeeRate || 0;
        serviceFeeFixed = ts.serviceFeeFixed || 0;
      }
    } catch (_) { /* use defaults */ }

    const tiersCache = await LoyaltyTier.find({ tenantId: req.tenantId }).lean();

    let customerLeanForOrder = null;
    if (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) {
      customerLeanForOrder = await Customer.findOne({ _id: customerId, tenantId: req.tenantId }).lean();
    }
    const promoTierLevel = customerLeanForOrder
      ? getEffectiveTier(customerLeanForOrder, tiersCache).level
      : null;

    // Apply active promotions (tenant-scoped), optionally gated by loyalty tier
    const now = new Date();
    const activePromosRaw = await Promotion.find({
      tenantId: req.tenantId,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $and: [
        { $or: [{ storeId }, { storeId: null }] },
        { $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }] },
      ],
    });
    const activePromos = activePromosRaw.filter((p) => {
      const min = p.minTierLevel;
      if (min == null || Number(min) <= 0) return true;
      if (promoTierLevel == null) return false;
      return promoTierLevel >= Number(min);
    });
    const { applied: appliedPromotions, discountTotal: promoDiscountTotal } = applyPromotions(enrichedItems, activePromos);
    let loyaltyDiscountPoints = 0;
    let automaticLoyaltyDiscount = 0;
    let loyaltyRedemptionPayload = null;
    let appliedAutomaticLoyalty = [];

    let remainingAfterPromos = Math.max(0, subtotal - promoDiscountTotal);

    if (customerLeanForOrder) {
      const tiers = tiersCache;
      const customerLean = customerLeanForOrder;
      const autoRewards = await LoyaltyReward.find({
        tenantId: req.tenantId,
        active: true,
        approvalStatus: 'approved',
        redemptionType: 'automatic',
        $or: [{ storeId }, { storeId: null }],
      })
        .sort({ createdAt: 1 })
        .lean();

      let remaining = remainingAfterPromos;
      for (const reward of autoRewards) {
        const eff = getEffectiveTier(customerLean, tiers);
        if (eff.level < (reward.minTierLevel || 1)) continue;
        const d = computeLoyaltyRewardDiscount(reward, enrichedItems, remaining);
        if (d <= 0) continue;
        remaining -= d;
        automaticLoyaltyDiscount += d;
        appliedAutomaticLoyalty.push({
          reward: reward._id,
          name: reward.name,
          discountAmount: Math.round(d * 100) / 100,
        });
      }
      remainingAfterPromos = remaining;
    }

    if (loyaltyRewardId && customerLeanForOrder) {
      const reward = await LoyaltyReward.findOne({
        _id: loyaltyRewardId,
        tenantId: req.tenantId,
        $or: [{ storeId }, { storeId: null }],
        approvalStatus: 'approved',
        active: true,
      }).lean();
      if (!reward) {
        return res.status(400).json({ message: 'Loyalty reward is not available' });
      }
      if ((reward.redemptionType || 'points') === 'automatic') {
        return res.status(400).json({ message: 'This reward is applied automatically for eligible members' });
      }
      const tiers = tiersCache;
      const eff = getEffectiveTier(customerLeanForOrder, tiers);
      if (eff.level < (reward.minTierLevel || 1)) {
        return res.status(400).json({ message: 'Customer tier is too low for this reward' });
      }
      if (Number(customerLeanForOrder.lifetimePoints || 0) < Number(reward.pointsCost || 0)) {
        return res.status(400).json({ message: 'Insufficient loyalty points' });
      }
      loyaltyDiscountPoints = computeLoyaltyRewardDiscount(reward, enrichedItems, remainingAfterPromos);
      if (loyaltyDiscountPoints <= 0) {
        return res.status(400).json({ message: 'This reward does not apply to the current cart' });
      }
      loyaltyRedemptionPayload = {
        reward: reward._id,
        name: reward.name,
        pointsCost: reward.pointsCost,
        discountAmount: Math.round(loyaltyDiscountPoints * 100) / 100,
      };
    }

    const discountTotal = Math.round((promoDiscountTotal + automaticLoyaltyDiscount + loyaltyDiscountPoints) * 100) / 100;
    const discountedSubtotal = Math.max(0, subtotal - discountTotal);

    // Calculate compound tax components
    let taxAmount = 0;
    let taxRate = 0;
    if (taxComponents.length > 0) {
      let base = discountedSubtotal;
      for (const tc of taxComponents) {
        const componentAmount = Math.round(base * (tc.rate / 100) * 100) / 100;
        taxAmount += componentAmount;
        if (tc.isCompound) base += componentAmount;
      }
      taxRate = taxComponents.reduce((sum, tc) => sum + tc.rate, 0);
    }

    const serviceFeeAmount = serviceFeeType === 'fixed'
      ? Math.round(serviceFeeFixed * 100) / 100
      : Math.round(discountedSubtotal * (serviceFeeRate / 100) * 100) / 100;
    const totalAmount = Math.round((discountedSubtotal + taxAmount + serviceFeeAmount) * 100) / 100;

    const orderPayload = {
      tenantId: req.tenantId,
      storeId,
      orderType,
      tableNumber: resolvedTableLabel,
      ...(resolvedTableId ? { tableId: resolvedTableId } : {}),
      reference: reference || '',
      items: enrichedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discountTotal,
      appliedPromotions,
      ...(appliedAutomaticLoyalty.length ? { appliedAutomaticLoyalty } : {}),
      taxRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      serviceFeeType,
      serviceFeeRate,
      serviceFeeFixed,
      serviceFeeAmount,
      paymentType: deferPayment ? 'pending' : (paymentType || 'cash'),
      paymentAmount: deferPayment ? 0 : Number(paymentAmount || totalAmount),
      paymentCollected: !deferPayment,
      totalAmount,
      orderSource: 'pos',
      createdBy: req.user.id,
      ...(clientRequestId ? { clientRequestId } : {}),
      ...(loyaltyRedemptionPayload ? { loyaltyRedemption: loyaltyRedemptionPayload } : {}),
    };

    if (customerId) {
      const validCustomer = await Customer.exists({
        _id: customerId,
        tenantId: req.tenantId,
      });
      if (validCustomer) orderPayload.customerId = customerId;
    }

    const order = await Order.create(orderPayload);

    if (loyaltyRedemptionPayload && order.customerId && (loyaltyRedemptionPayload.pointsCost || 0) > 0) {
      const ptsCost = loyaltyRedemptionPayload.pointsCost;
      const upd = await Customer.updateOne(
        {
          _id: order.customerId,
          tenantId: req.tenantId,
          lifetimePoints: { $gte: ptsCost },
        },
        {
          $inc: { lifetimePoints: -ptsCost },
          $set: {
            lastLoyaltyActivityAt: new Date(),
            retentionStatus: 'ok',
          },
        },
      );
      if (upd.modifiedCount === 0) {
        await Order.deleteOne({ _id: order._id });
        return res.status(400).json({ message: 'Insufficient loyalty points' });
      }
    }

    await emitAudit({ req, action: 'ORDER_CREATED', resource: 'Order', resourceId: order._id });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update order details
router.put('/:id', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['completed', 'cancelled'].includes(order.status))
      return res.status(400).json({ message: `Cannot edit a ${order.status} order` });

    const { orderType, tableNumber, tableId: tableIdRaw, reference, items } = req.body;

    const storeDoc = await Store.findById(order.storeId).lean();
    const tableMgmt = storeDoc?.tableManagementEnabled === true;
    const nextType = orderType || order.orderType;

    if (orderType) order.orderType = orderType;

    if (nextType === 'dine-in' && tableMgmt) {
      const tid =
        tableIdRaw !== undefined && tableIdRaw !== null && String(tableIdRaw).trim() !== ''
          ? tableIdRaw
          : order.tableId;
      if (!tid || !mongoose.Types.ObjectId.isValid(String(tid))) {
        return res.status(400).json({ message: 'Select a table for dine-in' });
      }
      const tbl = await CafeTable.findOne({
        _id: tid,
        tenantId: req.tenantId,
        storeId: order.storeId,
        active: true,
      }).lean();
      if (!tbl) return res.status(400).json({ message: 'Invalid or inactive table' });
      try {
        await assertTableAvailable({
          tenantId: req.tenantId,
          storeId: order.storeId,
          tableId: tbl._id,
          excludeOrderId: order._id,
        });
      } catch (e) {
        const code = e.statusCode === 409 ? 409 : 400;
        return res.status(code).json({ message: e.message });
      }
      order.tableId = tbl._id;
      order.tableNumber = tbl.label;
    } else {
      if (!tableMgmt) order.tableId = null;
      if (tableNumber !== undefined) order.tableNumber = tableNumber;
      if (nextType !== 'dine-in') order.tableId = null;
    }

    if (reference !== undefined) order.reference = reference;

    if (items && items.length > 0) {
      const merged = await mergeItemsForUpdate(order.items, items, req.tenantId, order.storeId, order.status);
      order.items = merged;
      await recalculateOrderMoney(order);
    }

    order.updatedBy = req.user.id;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT mark one line as delivered to table (cashier)
router.put(
  '/:id/items/:itemId/delivered',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (['completed', 'cancelled'].includes(order.status))
        return res.status(400).json({ message: `Cannot edit a ${order.status} order` });
      const delivered = req.body?.delivered !== false;
      const itemId = req.params.itemId;
      const sub = order.items.id(itemId);
      if (!sub) return res.status(404).json({ message: 'Order line not found' });
      sub.deliveredToTable = delivered;
      order.updatedBy = req.user.id;
      await order.save();
      res.json(order);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// PUT clear kitchen "new line" highlights (kitchen staff)
router.put(
  '/:id/clear-kitchen-new',
  protect,
  authorize('kitchen', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
      if (!order) return res.status(404).json({ message: 'Order not found' });
      order.items.forEach((line) => {
        line.kitchenNew = false;
        line.kitchenPendingQty = null;
      });
      order.updatedBy = req.user.id;
      await order.save();
      res.json(order);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// PUT advance/set order status
router.put('/:id/status', protect, authorize('cashier', 'kitchen', 'manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { status } = req.body || {};
    const prevStatus = order.status;

    let nextStatus;

    if (status === 'cancelled') {
      if (order.status === 'completed')
        return res.status(400).json({ message: 'Cannot cancel a completed order' });
      nextStatus = 'cancelled';
    } else if (status && VALID_STATUSES.includes(status)) {
      nextStatus = status;
    } else {
      const next = FORWARD_TRANSITIONS[order.status];
      if (!next) return res.status(400).json({ message: `Order cannot be advanced from "${order.status}"` });
      nextStatus = next;
    }

    const becomingCompleted = order.status !== 'completed' && nextStatus === 'completed';

    if (becomingCompleted && order.paymentCollected === false) {
      const rolesAllowed = ['cashier', 'manager', 'merchant_admin'];
      if (!rolesAllowed.includes(req.user.role)) {
        return res.status(403).json({
          message: 'Payment must be collected at the register before this order can be completed.',
        });
      }
      const { paymentType: pt, paymentAmount: pa } = req.body || {};
      if (!pt || pt === 'pending') {
        return res.status(400).json({
          message: 'Collect payment before completing — choose how the guest paid (cash, card, etc.).',
        });
      }
      const expected = Number(order.totalAmount || 0);
      const paid = Number(pa != null ? pa : expected);
      if (!Number.isFinite(paid) || paid + 0.005 < expected) {
        return res.status(400).json({
          message: `Collect ${expected.toFixed(2)} before completing this order.`,
        });
      }
      order.paymentType = pt;
      order.paymentAmount = paid;
      order.paymentCollected = true;
    }

    order.status = nextStatus;

    if (prevStatus === 'pending' && nextStatus === 'preparing') {
      order.items.forEach((line) => {
        line.kitchenNew = false;
        line.kitchenPendingQty = null;
      });
    }

    order.updatedBy = req.user.id;
    await order.save();

    if (order.status === 'completed' && prevStatus !== 'completed' && order.customerId) {
      const cfg = await LoyaltyProgramConfig.findOne({ tenantId: req.tenantId }).lean();
      let earned = 0;
      if (!cfg || cfg.isEnabled !== false) {
        const spend = Math.max(1, cfg?.spendPerEarnBlock || 100);
        const blk = Math.max(0, cfg?.pointsPerEarnBlock ?? 1);
        earned = Math.floor(Number(order.totalAmount || 0) / spend) * blk;
      }
      if (earned > 0) {
        await Customer.updateOne(
          { _id: order.customerId, tenantId: req.tenantId },
          {
            $inc: { lifetimePoints: earned },
            $set: {
              lastLoyaltyActivityAt: new Date(),
              retentionStatus: 'ok',
            },
          },
        );
        order.loyaltyPointsEarned = (order.loyaltyPointsEarned || 0) + earned;
        await order.save();
      } else {
        await Customer.updateOne(
          { _id: order.customerId, tenantId: req.tenantId },
          { $set: { lastLoyaltyActivityAt: new Date(), retentionStatus: 'ok' } },
        );
      }
    }

    if (prevStatus !== order.status) {
      try {
        await notifyPosStaffOrderStatusChange({
          tenantId: req.tenantId,
          storeId: order.storeId,
          excludeUserId: req.user?.id,
          order: order.toObject({ flattenMaps: true }),
          prevStatus,
          nextStatus: order.status,
        });
      } catch (notifyErr) {
        console.error('notifyPosStaffOrderStatusChange', notifyErr);
      }
    }

    await emitAudit({
      req,
      action: 'ORDER_STATUS_CHANGED',
      resource: 'Order',
      resourceId: order._id,
      changes: { before: { status: prevStatus }, after: { status: order.status } },
    });

    res.json(order);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
