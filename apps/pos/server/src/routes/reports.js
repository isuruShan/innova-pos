const express = require('express');
const Order = require('../models/Order');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/day-end', protect, authorize('cashier', 'manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { date } = req.query;
    const target = date ? new Date(date) : new Date();
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      tenantId: req.tenantId,
      status: 'completed',
      createdAt: { $gte: start, $lte: end },
    }).populate('createdBy', 'name').sort({ createdAt: 1 });

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders = orders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscounts = orders.reduce((s, o) => s + (o.discountTotal || 0), 0);

    const promoMap = {};
    orders.forEach(o => {
      (o.appliedPromotions || []).forEach(ap => {
        const key = ap.name || String(ap.promotion);
        if (!promoMap[key]) promoMap[key] = { name: key, type: ap.type, uses: 0, totalDiscount: 0 };
        promoMap[key].uses += 1;
        promoMap[key].totalDiscount += ap.discountAmount || 0;
      });
    });

    res.json({
      date: target.toISOString().split('T')[0],
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrder * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      promotionStats: Object.values(promoMap),
      orders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/sales', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      tenantId: req.tenantId,
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const dailyMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, revenue: 0, orders: 0 };
    }

    orders.forEach(o => {
      const key = new Date(o.createdAt).toISOString().split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].revenue += o.totalAmount;
        dailyMap[key].orders += 1;
      }
    });

    const itemSales = {};
    orders.forEach(o => {
      o.items.forEach(i => {
        if (!itemSales[i.name]) itemSales[i.name] = { name: i.name, qty: 0, revenue: 0 };
        itemSales[i.name].qty += i.qty;
        itemSales[i.name].revenue += i.price * i.qty;
      });
    });

    const categorySales = {};
    orders.forEach(o => {
      o.items.forEach(i => {
        const cat = i.category || 'Other';
        if (!categorySales[cat]) categorySales[cat] = { name: cat, value: 0 };
        categorySales[cat].value += i.qty;
      });
    });

    const topItems = Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const bestSeller = topItems[0] || null;

    const today = new Date().toISOString().split('T')[0];
    const todayData = dailyMap[today] || { revenue: 0, orders: 0 };

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalDiscounts = orders.reduce((s, o) => s + (o.discountTotal || 0), 0);

    const promoMap = {};
    orders.forEach(o => {
      (o.appliedPromotions || []).forEach(ap => {
        const key = ap.name || String(ap.promotion);
        if (!promoMap[key]) promoMap[key] = { name: key, type: ap.type, uses: 0, totalDiscount: 0 };
        promoMap[key].uses += 1;
        promoMap[key].totalDiscount += ap.discountAmount || 0;
      });
    });

    res.json({
      daily: Object.values(dailyMap),
      topItems,
      bestSeller,
      categorySales: Object.values(categorySales),
      todayRevenue: Math.round(todayData.revenue * 100) / 100,
      todayOrders: todayData.orders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      avgOrderValue: orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
      promotionStats: Object.values(promoMap),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
