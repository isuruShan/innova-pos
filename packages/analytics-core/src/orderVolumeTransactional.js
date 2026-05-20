'use strict';

const {
  localDateKey,
  buildEmptyDailyMap,
} = require('./anlyDateKeys');
const { buildAnalyticsStoreMatch } = require('./anlyStoreMatch');

/**
 * Daily order volume from completed orders (source of truth — matches /reports/sales).
 * @param {import('mongoose').Model} Order
 */
async function buildDailyOrderVolumeTransactional(Order, tenantId, storeId, range) {
  const dailyMap = buildEmptyDailyMap(range.startDate, range.dayCount);
  const orders = await Order.find({
    ...buildAnalyticsStoreMatch(tenantId, storeId),
    status: 'completed',
    createdAt: { $gte: range.startDate, $lte: range.endDate },
  })
    .select('createdAt totalAmount')
    .lean();

  for (const o of orders) {
    const key = localDateKey(o.createdAt);
    if (!dailyMap[key]) continue;
    dailyMap[key].orders += 1;
    dailyMap[key].revenue += Number(o.totalAmount) || 0;
  }

  for (const key of Object.keys(dailyMap)) {
    dailyMap[key].revenue = Math.round(dailyMap[key].revenue * 100) / 100;
  }

  return dailyMap;
}

module.exports = { buildDailyOrderVolumeTransactional };
