'use strict';

const mongoose = require('mongoose');
const Order = require('../models/Order');
const AnlyDailyStoreMetrics = require('../models/AnlyDailyStoreMetrics');
const AnlyItemSalesDaily = require('../models/AnlyItemSalesDaily');
const AnlySyncState = require('../models/AnlySyncState');
const {
  localDateKey,
  parseDateRange,
  buildEmptyDailyMap,
  startOfLocalDay,
  endOfLocalDay,
} = require('./anlyDateKeys');
const { getAnlyConfig } = require('../jobs/anlySync');

function storeFilter(storeId) {
  return storeId ? { storeId: new mongoose.Types.ObjectId(storeId) } : { storeId: null };
}

async function fetchDailyFromAnly(tenantId, storeId, rangeFrom, rangeTo) {
  const rows = await AnlyDailyStoreMetrics.find({
    tenantId,
    ...storeFilter(storeId),
    dateKey: { $gte: rangeFrom, $lte: rangeTo },
  })
    .select('dateKey orderCount revenue')
    .lean();

  const byDate = Object.fromEntries(rows.map((r) => [r.dateKey, r]));
  return byDate;
}

async function fetchTodayTransactional(tenantId, storeId) {
  const today = localDateKey(new Date());
  const start = startOfLocalDay(new Date());
  const end = endOfLocalDay(new Date());
  const filter = {
    tenantId,
    status: 'completed',
    createdAt: { $gte: start, $lte: end },
  };
  if (storeId) filter.storeId = storeId;
  else filter.storeId = null;

  const orderDocs = await Order.find(filter).select('totalAmount').lean();
  let revenue = 0;
  let orderCount = 0;
  for (const o of orderDocs) {
    orderCount += 1;
    revenue += Number(o.totalAmount) || 0;
  }
  return { dateKey: today, orderCount, revenue: Math.round(revenue * 100) / 100 };
}

async function getOrderVolumeAnalytics(tenantId, storeId, fromQ, toQ) {
  const range = parseDateRange(fromQ, toQ);
  if (range.error) return { error: range.error };

  const dailyMap = buildEmptyDailyMap(range.startDate, range.dayCount);
  const anlyByDate = await fetchDailyFromAnly(tenantId, storeId, range.rangeFrom, range.rangeTo);

  const todayKey = localDateKey(new Date());
  const todayInRange = todayKey >= range.rangeFrom && todayKey <= range.rangeTo;

  for (const key of Object.keys(dailyMap)) {
    if (todayInRange && key === todayKey) continue;
    const row = anlyByDate[key];
    if (row) {
      dailyMap[key].orders = row.orderCount || 0;
      dailyMap[key].revenue = Math.round((row.revenue || 0) * 100) / 100;
    }
  }

  if (todayInRange) {
    const live = await fetchTodayTransactional(tenantId, storeId);
    dailyMap[todayKey].orders = live.orderCount;
    dailyMap[todayKey].revenue = live.revenue;
  }

  const daily = Object.values(dailyMap);
  const orderCount = daily.reduce((s, d) => s + (d.orders || 0), 0);
  const totalRevenue = Math.round(daily.reduce((s, d) => s + (d.revenue || 0), 0) * 100) / 100;

  return {
    daily,
    orderCount,
    totalRevenue,
    rangeFrom: range.rangeFrom,
    rangeTo: range.rangeTo,
    source: { historical: 'anly', today: todayInRange ? 'transactional' : null },
  };
}

async function fetchTopItemsFromAnly(tenantId, storeId, rangeFrom, rangeTo, todayKey, todayInRange) {
  const match = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    ...storeFilter(storeId),
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
  const start = startOfLocalDay(new Date());
  const end = endOfLocalDay(new Date());
  const filter = {
    tenantId,
    status: 'completed',
    createdAt: { $gte: start, $lte: end },
  };
  if (storeId) filter.storeId = storeId;
  else filter.storeId = null;

  const orders = await Order.find(filter).select('items').lean();
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
