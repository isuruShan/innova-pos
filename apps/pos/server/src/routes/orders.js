const express = require('express');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Settings = require('../models/Settings');
const Promotion = require('../models/Promotion');
const Customer = require('../models/Customer');
const LoyaltyProgramConfig = require('../models/LoyaltyProgramConfig');
const LoyaltyReward = require('../models/LoyaltyReward');
const LoyaltyTier = require('../models/LoyaltyTier');
const { computeLoyaltyRewardDiscount, getEffectiveTier } = require('../lib/loyaltyTier');
const { applyPromotions } = require('../utils/applyPromotions');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { emitAudit } = require('@innovapos/shared-middleware');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');

const router = express.Router();

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const FORWARD_TRANSITIONS = { pending: 'preparing', preparing: 'ready', ready: 'completed' };

async function enrichItems(items, tenantId, storeId) {
  const menuIds = items.map(i => i.menuItem);
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds }, tenantId, storeId }).lean();
  const menuMap = Object.fromEntries(menuDocs.map(m => [m._id.toString(), m]));
  return items.map(i => {
    const doc = menuMap[i.menuItem?.toString()];
    const base = { ...i, category: doc?.category || '', isCombo: false, comboItems: [] };
    if (doc?.isCombo && doc.comboItems?.length) {
      return {
        ...base, isCombo: true,
        comboItems: doc.comboItems.map(ci => ({ name: ci.name, qty: ci.qty * i.qty })),
      };
    }
    return base;
  });
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
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
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
      reference,
      items,
      paymentType,
      paymentAmount,
      customerId,
      loyaltyRewardId,
    } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'Items are required' });
    if (orderType === 'dine-in' && !tableNumber?.trim())
      return res.status(400).json({ message: 'Table number is required for dine-in orders' });

    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for order creation' });

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

    // Apply active promotions (tenant-scoped)
    const now = new Date();
    const activePromos = await Promotion.find({
      tenantId: req.tenantId,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $and: [
        { $or: [{ storeId }, { storeId: null }] },
        { $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }] },
      ],
    });
    const { applied: appliedPromotions, discountTotal: promoDiscountTotal } = applyPromotions(enrichedItems, activePromos);
    let loyaltyDiscount = 0;
    let loyaltyRedemptionPayload = null;

    let tiersCache = null;
    async function loadTiers() {
      if (!tiersCache) tiersCache = await LoyaltyTier.find({ tenantId: req.tenantId }).lean();
      return tiersCache;
    }

    if (loyaltyRewardId && customerId) {
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
      const customer = await Customer.findOne({ _id: customerId, tenantId: req.tenantId });
      if (!customer) {
        return res.status(400).json({ message: 'Customer not found' });
      }
      const tiers = await loadTiers();
      const eff = getEffectiveTier(customer, tiers);
      if (eff.level < (reward.minTierLevel || 1)) {
        return res.status(400).json({ message: 'Customer tier is too low for this reward' });
      }
      if (Number(customer.lifetimePoints || 0) < Number(reward.pointsCost || 0)) {
        return res.status(400).json({ message: 'Insufficient loyalty points' });
      }
      const afterPromo = Math.max(0, subtotal - promoDiscountTotal);
      loyaltyDiscount = computeLoyaltyRewardDiscount(reward, enrichedItems, afterPromo);
      if (loyaltyDiscount <= 0) {
        return res.status(400).json({ message: 'This reward does not apply to the current cart' });
      }
      loyaltyRedemptionPayload = {
        reward: reward._id,
        name: reward.name,
        pointsCost: reward.pointsCost,
        discountAmount: Math.round(loyaltyDiscount * 100) / 100,
      };
    }

    const discountTotal = Math.round((promoDiscountTotal + loyaltyDiscount) * 100) / 100;
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
      tableNumber: tableNumber || '',
      reference: reference || '',
      items: enrichedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discountTotal,
      appliedPromotions,
      taxRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      serviceFeeType,
      serviceFeeRate,
      serviceFeeFixed,
      serviceFeeAmount,
      paymentType: paymentType || 'cash',
      paymentAmount: Number(paymentAmount || totalAmount),
      totalAmount,
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

    if (loyaltyRedemptionPayload && order.customerId) {
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

    const { orderType, tableNumber, reference, items } = req.body;

    if (orderType) order.orderType = orderType;
    if (tableNumber !== undefined) order.tableNumber = tableNumber;
    if (reference !== undefined) order.reference = reference;

    if (items && items.length > 0) {
      const enrichedItems = await enrichItems(items, req.tenantId, order.storeId);
      order.items = enrichedItems;
      order.totalAmount = Math.round(enrichedItems.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100;
    }

    order.updatedBy = req.user.id;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT advance/set order status
router.put('/:id/status', protect, authorize('cashier', 'kitchen', 'manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { status } = req.body || {};
    const prevStatus = order.status;

    if (status === 'cancelled') {
      if (order.status === 'completed')
        return res.status(400).json({ message: 'Cannot cancel a completed order' });
      order.status = 'cancelled';
    } else if (status && VALID_STATUSES.includes(status)) {
      order.status = status;
    } else {
      const next = FORWARD_TRANSITIONS[order.status];
      if (!next) return res.status(400).json({ message: `Order cannot be advanced from "${order.status}"` });
      order.status = next;
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

    await emitAudit({
      req,
      action: 'ORDER_STATUS_CHANGED',
      resource: 'Order',
      resourceId: order._id,
      changes: { before: { status: prevStatus }, after: { status: order.status } },
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
