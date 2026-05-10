const express = require('express');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

/** Calendar date in the server's local timezone (matches cashier "today"). */
function localDateKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local midnight. */
function parseLocalDateOnly(str) {
  if (!str || typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Inclusive calendar days between two local dates. */
function daysInclusive(fromDay, toDay) {
  const a = startOfLocalDay(fromDay);
  const b = startOfLocalDay(toDay);
  return Math.round((b - a) / 86400000) + 1;
}

router.get('/day-end', protect, authorize('cashier', 'manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { date } = req.query;
    const target = date ? new Date(date) : new Date();
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
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

router.get('/sales', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const fromQ = req.query.from;
    const toQ = req.query.to;
    let startDate;
    let endDate;
    let dayCount;

    if (fromQ && toQ) {
      const fromParsed = parseLocalDateOnly(String(fromQ));
      const toParsed = parseLocalDateOnly(String(toQ));
      if (!fromParsed || !toParsed) {
        return res.status(400).json({ message: 'Invalid from or to date (use YYYY-MM-DD)' });
      }
      let fromDay = startOfLocalDay(fromParsed);
      let toDay = startOfLocalDay(toParsed);
      if (fromDay > toDay) {
        const t = fromDay;
        fromDay = toDay;
        toDay = t;
      }
      dayCount = daysInclusive(fromDay, toDay);
      const maxDays = 366;
      if (dayCount > maxDays) {
        return res.status(400).json({ message: `Date range cannot exceed ${maxDays} days` });
      }
      startDate = startOfLocalDay(fromDay);
      endDate = endOfLocalDay(toDay);
    } else {
      const days = Math.min(366, Math.max(1, parseInt(req.query.days, 10) || 7));
      dayCount = days;
      endDate = endOfLocalDay(new Date());
      const sd = new Date();
      sd.setDate(sd.getDate() - (days - 1));
      startDate = startOfLocalDay(sd);
    }

    const orders = await Order.find({
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const menuIds = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.menuItem)).filter(Boolean)))];
    const menuDocs = menuIds.length
      ? await MenuItem.find({
        _id: { $in: menuIds },
        tenantId: req.tenantId,
        ...buildStoreFilter(req),
      })
        .select('category')
        .lean()
      : [];
    const categoryByMenuId = Object.fromEntries(
      menuDocs.map((m) => [m._id.toString(), (m.category || '').trim() || 'Other']),
    );

    const dailyMap = {};
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = localDateKey(d);
      dailyMap[key] = { date: key, revenue: 0, orders: 0 };
    }

    orders.forEach((o) => {
      const key = localDateKey(o.createdAt);
      if (dailyMap[key]) {
        dailyMap[key].revenue += o.totalAmount;
        dailyMap[key].orders += 1;
      }
    });

    const itemSales = {};
    orders.forEach((o) => {
      o.items.forEach((i) => {
        if (!itemSales[i.name]) itemSales[i.name] = { name: i.name, qty: 0, revenue: 0 };
        itemSales[i.name].qty += i.qty;
        itemSales[i.name].revenue += i.price * i.qty;
      });
    });

    const categorySales = {};
    orders.forEach((o) => {
      o.items.forEach((i) => {
        const fromOrder = (i.category || '').trim();
        const fromMenu = categoryByMenuId[i.menuItem?.toString()] || '';
        const cat = fromOrder || fromMenu || 'Other';
        if (!categorySales[cat]) categorySales[cat] = { name: cat, value: 0 };
        categorySales[cat].value += i.qty;
      });
    });

    const topItems = Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const bestSeller = topItems[0] || null;

    const today = localDateKey(new Date());
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
      orderCount: orders.length,
      rangeFrom: localDateKey(startDate),
      rangeTo: localDateKey(endDate),
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
