'use strict';

const mongoose = require('mongoose');
const AnlyItemSalesDaily = require('./models/AnlyItemSalesDaily');
const AnlySyncState = require('./models/AnlySyncState');
const { buildAnalyticsStoreMatch } = require('./anlyStoreMatch');
const { buildDailyOrderVolumeTransactional } = require('./orderVolumeTransactional');
const {
  localDateKey,
  parseDateRange,
  startOfLocalDay,
  endOfLocalDay,
} = require('./anlyDateKeys');
const { getAnlyConfig } = require('./anlySync');

function getOrderModel() {
  return mongoose.model('Order');
}

async function fetchTopItemsFromAnly(tenantId, storeId, rangeFrom, rangeTo, todayKey, todayInRange) {
  const match = {
    ...buildAnalyticsStoreMatch(tenantId, storeId),
    dateKey: todayInRange
      ? { $gte: rangeFrom, $lte: rangeTo, $ne: todayKey }
      : { $gte: rangeFrom, $lte: rangeTo },
  };

  const grouped = await AnlyItemSalesDaily.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$menuItemId',
        name: { $last: '$itemName' },
        qty: { $sum: '$qty' },
        revenue: { $sum: '$revenue' },
      },
    },
  ]);

  return Object.fromEntries(
    grouped.map((g) => [
      String(g._id),
      { menuItemId: g._id, name: g.name || 'Item', qty: g.qty || 0, revenue: g.revenue || 0 },
    ]),
  );
}

async function fetchTodayItemsTransactional(tenantId, storeId) {
  const Order = getOrderModel();
  const start = startOfLocalDay(new Date());
  const end = endOfLocalDay(new Date());
  const orders = await Order.find({
    ...buildAnalyticsStoreMatch(tenantId, storeId),
    status: 'completed',
    createdAt: { $gte: start, $lte: end },
  })
    .select('items')
    .lean();

  const map = {};
  for (const o of orders) {
    for (const line of o.items || []) {
      const mid = line.menuItem ? String(line.menuItem) : line.name;
      if (!map[mid]) {
        map[mid] = {
          menuItemId: line.menuItem,
          name: line.name || 'Item',
          qty: 0,
          revenue: 0,
        };
      }
      const qty = Number(line.qty) || 0;
      map[mid].qty += qty;
      map[mid].revenue += (Number(line.price) || 0) * qty;
    }
  }
  return map;
}

async function getOrderVolumeAnalytics(tenantId, storeId, fromQ, toQ) {
  const range = parseDateRange(fromQ, toQ);
  if (range.error) return { error: range.error };

  const Order = getOrderModel();
  const dailyMap = await buildDailyOrderVolumeTransactional(Order, tenantId, storeId, range);
  const daily = Object.values(dailyMap);
  const orderCount = daily.reduce((s, d) => s + (d.orders || 0), 0);
  const totalRevenue = Math.round(daily.reduce((s, d) => s + (d.revenue || 0), 0) * 100) / 100;

  return {
    daily,
    orderCount,
    totalRevenue,
    rangeFrom: range.rangeFrom,
    rangeTo: range.rangeTo,
    source: { orders: 'transactional' },
  };
}

async function getTopItemsAnalytics(tenantId, storeId, fromQ, toQ, limit = 10, sort = 'qty') {
  const range = parseDateRange(fromQ, toQ);
  if (range.error) return { error: range.error };

  const todayKey = localDateKey(new Date());
  const todayInRange = todayKey >= range.rangeFrom && todayKey <= range.rangeTo;

  const merged = await fetchTopItemsFromAnly(
    tenantId,
    storeId,
    range.rangeFrom,
    range.rangeTo,
    todayKey,
    todayInRange,
  );

  if (todayInRange) {
    const live = await fetchTodayItemsTransactional(tenantId, storeId);
    for (const [key, row] of Object.entries(live)) {
      if (!merged[key]) {
        merged[key] = { ...row };
      } else {
        merged[key].qty += row.qty;
        merged[key].revenue += row.revenue;
      }
    }
  }

  const topItems = Object.values(merged)
    .map((r) => ({
      menuItemId: r.menuItemId,
      name: r.name,
      qty: r.qty,
      revenue: Math.round(r.revenue * 100) / 100,
    }))
    .sort((a, b) => (sort === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty))
    .slice(0, Math.min(50, Math.max(1, limit)));

  return {
    topItems,
    bestSeller: topItems[0] || null,
    rangeFrom: range.rangeFrom,
    rangeTo: range.rangeTo,
    source: { historical: 'anly', today: todayInRange ? 'transactional' : null },
  };
}

async function getAnlyStatus(tenantId) {
  const cfg = getAnlyConfig();
  const state = await AnlySyncState.findOne({ tenantId }).lean();
  return {
    enabled: cfg.enabled,
    intervalMs: cfg.intervalMs,
    lastRunAt: state?.lastRunAt || null,
    lastError: state?.lastError || '',
    backfillCompletedAt: state?.backfillCompletedAt || null,
  };
}

module.exports = {
  getOrderVolumeAnalytics,
  getTopItemsAnalytics,
  getAnlyStatus,
};
