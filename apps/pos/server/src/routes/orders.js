const express = require('express');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Settings = require('../models/Settings');
const Promotion = require('../models/Promotion');
const { applyPromotions } = require('../utils/applyPromotions');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { emitAudit } = require('@innovapos/shared-middleware');

const router = express.Router();

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const FORWARD_TRANSITIONS = { pending: 'preparing', preparing: 'ready', ready: 'completed' };

async function enrichItems(items, tenantId) {
  const menuIds = items.map(i => i.menuItem);
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds }, tenantId }).lean();
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

// GET all orders — supports ?status=, ?orderType=, ?since=, ?until=, ?search=
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const { status, orderType, since, until, search } = req.query;
    const filter = { tenantId: req.tenantId };

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (orderType) {
      const types = orderType.split(',').map(s => s.trim()).filter(Boolean);
      filter.orderType = types.length === 1 ? types[0] : { $in: types };
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
router.get('/:id', protect, tenantScope, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('createdBy', 'name');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create order
router.post('/', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { orderType = 'dine-in', tableNumber, reference, items } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'Items are required' });
    if (orderType === 'dine-in' && !tableNumber?.trim())
      return res.status(400).json({ message: 'Table number is required for dine-in orders' });

    const enrichedItems = await enrichItems(items, req.tenantId);
    const subtotal = enrichedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    // Fetch per-tenant settings
    let taxComponents = [], serviceFeeRate = 0, serviceFeeFixed = 0, serviceFeeType = 'percentage';
    try {
      const settings = await Settings.findOne({ tenantId: req.tenantId });
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
    });
    const { applied: appliedPromotions, discountTotal } = applyPromotions(enrichedItems, activePromos);

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

    const order = await Order.create({
      tenantId: req.tenantId,
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
      totalAmount,
      createdBy: req.user.id,
    });

    await emitAudit({ req, action: 'ORDER_CREATED', resource: 'Order', resourceId: order._id });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update order details
router.put('/:id', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['completed', 'cancelled'].includes(order.status))
      return res.status(400).json({ message: `Cannot edit a ${order.status} order` });

    const { orderType, tableNumber, reference, items } = req.body;

    if (orderType) order.orderType = orderType;
    if (tableNumber !== undefined) order.tableNumber = tableNumber;
    if (reference !== undefined) order.reference = reference;

    if (items && items.length > 0) {
      const enrichedItems = await enrichItems(items, req.tenantId);
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
router.put('/:id/status', protect, authorize('cashier', 'kitchen', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId });
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
