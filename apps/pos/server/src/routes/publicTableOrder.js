const express = require('express');
const { sendRouteError } = require('@innovapos/shared-middleware');
const CafeTable = require('../models/CafeTable');
const Store = require('../models/Store');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { enrichItems, recalculateOrderMoney, appendItemsToOrder } = require('../utils/orderHelpers');

const router = express.Router();

router.get('/:token', async (req, res) => {
  try {
    const tbl = await CafeTable.findOne({ qrToken: req.params.token }).lean();
    if (!tbl) return res.status(404).json({ message: 'Invalid or expired table link' });
    const store = await Store.findById(tbl.storeId).select('name tableManagementEnabled').lean();
    if (!store?.tableManagementEnabled) {
      return res.status(403).json({ message: 'Table ordering is not available for this venue right now.' });
    }
    const menuItems = await MenuItem.find({
      tenantId: tbl.tenantId,
      storeId: tbl.storeId,
      available: true,
    })
      .sort({ category: 1, name: 1 })
      .lean();

    const openOrder = await Order.findOne({
      tenantId: tbl.tenantId,
      storeId: tbl.storeId,
      tableId: tbl._id,
      status: { $nin: ['completed', 'cancelled'] },
    }).lean();

    res.json({
      tableLabel: tbl.label,
      storeName: store.name,
      menuItems,
      order: openOrder,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/:token/items', async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!items?.length) return res.status(400).json({ message: 'Add at least one item to confirm.' });

    const tbl = await CafeTable.findOne({ qrToken: req.params.token });
    if (!tbl) return res.status(404).json({ message: 'Invalid or expired table link' });

    const store = await Store.findById(tbl.storeId).lean();
    if (!store?.tableManagementEnabled) {
      return res.status(403).json({ message: 'Table ordering is not available for this venue right now.' });
    }

    let order = await Order.findOne({
      tenantId: tbl.tenantId,
      storeId: tbl.storeId,
      tableId: tbl._id,
      status: { $nin: ['completed', 'cancelled'] },
    });

    if (!order) {
      const enrichedItems = await enrichItems(items, tbl.tenantId, tbl.storeId);
      order = new Order({
        tenantId: tbl.tenantId,
        storeId: tbl.storeId,
        orderType: 'dine-in',
        tableNumber: tbl.label,
        tableId: tbl._id,
        reference: '',
        items: enrichedItems,
        status: 'pending',
        discountTotal: 0,
        appliedPromotions: [],
        paymentType: 'pending',
        paymentAmount: 0,
        paymentCollected: false,
        orderSource: 'qr',
      });
      await recalculateOrderMoney(order);
      await order.save();
    } else {
      await appendItemsToOrder(order, items, tbl.tenantId, tbl.storeId);
      await order.save();
    }

    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
