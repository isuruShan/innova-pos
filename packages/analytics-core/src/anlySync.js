'use strict';

const Order = () => require('mongoose').model('Order');
const MenuItem = () => require('mongoose').model('MenuItem');
const Tenant = () => require('mongoose').model('Tenant');
const AnlySyncState = require('./models/AnlySyncState');
const AnlyDailyStoreMetrics = require('./models/AnlyDailyStoreMetrics');
const AnlyItemSalesDaily = require('./models/AnlyItemSalesDaily');
const AnlyProcessedOrder = require('./models/AnlyProcessedOrder');
const { localDateKey, startOfLocalDay } = require('./anlyDateKeys');

function envBool(name, defaultVal) {
  const v = process.env[name];
  if (v == null || v === '') return defaultVal;
  return String(v).toLowerCase() === 'true' || v === '1';
}

function envInt(name, defaultVal) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

function getAnlyConfig() {
  return {
    enabled: envBool('ANLY_SYNC_ENABLED', true),
    intervalMs: envInt('ANLY_SYNC_INTERVAL_MS', 300000),
    backfillDays: envInt('ANLY_BACKFILL_DAYS', 90),
    batchSize: envInt('ANLY_SYNC_BATCH_SIZE', 2000),
    leader: envBool('ANLY_SYNC_LEADER', true),
  };
}

async function loadCategoryMap(tenantId, storeId, menuIds) {
  if (!menuIds.length) return {};
  const filter = { _id: { $in: menuIds }, tenantId };
  if (storeId) filter.storeId = storeId;
  const docs = await MenuItem().find(filter).select('category').lean();
  return Object.fromEntries(docs.map((m) => [String(m._id), (m.category || '').trim() || 'Other']));
}

async function applyOrderToAnalytics(order, categoryByMenuId) {
  const dateKey = localDateKey(order.createdAt);
  const tenantId = order.tenantId;
  const storeId = order.storeId || null;
  const lineQty = (order.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);

  await AnlyDailyStoreMetrics.findOneAndUpdate(
    { tenantId, storeId, dateKey },
    {
      $inc: {
        orderCount: 1,
        revenue: Number(order.totalAmount) || 0,
        discountTotal: Number(order.discountTotal) || 0,
        itemQty: lineQty,
      },
    },
    { upsert: true },
  );

  for (const line of order.items || []) {
    const menuItemId = line.menuItem;
    if (!menuItemId) continue;
    const mid = menuItemId.toString();
    const fromOrder = (line.category || '').trim();
    const fromMenu = categoryByMenuId[mid] || '';
    const category = fromOrder || fromMenu || 'Other';
    const qty = Number(line.qty) || 0;
    const revenue = (Number(line.price) || 0) * qty;

    await AnlyItemSalesDaily.findOneAndUpdate(
      { tenantId, storeId, dateKey, menuItemId },
      {
        $inc: { qty, revenue },
        $set: { itemName: line.name || '', category },
      },
      { upsert: true },
    );
  }
}

async function processOrderOnce(order) {
  const existing = await AnlyProcessedOrder.findOne({ orderId: order._id }).select('_id').lean();
  if (existing) return false;

  const menuIds = [...new Set((order.items || []).map((i) => i.menuItem).filter(Boolean))];
  const categoryByMenuId = await loadCategoryMap(order.tenantId, order.storeId, menuIds);

  try {
    await AnlyProcessedOrder.create({ orderId: order._id, tenantId: order.tenantId });
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }

  await applyOrderToAnalytics(order, categoryByMenuId);
  return true;
}

function buildIncrementalFilter(state) {
  if (!state?.lastSyncedAt) {
    return { status: 'completed' };
  }
  const lastAt = new Date(state.lastSyncedAt);
  const lastId = state.lastOrderId;
  if (lastId) {
    return {
      status: 'completed',
      $or: [
        { updatedAt: { $gt: lastAt } },
        { updatedAt: lastAt, _id: { $gt: lastId } },
      ],
    };
  }
  return { status: 'completed', updatedAt: { $gt: lastAt } };
}

async function syncTenantIncremental(tenantId, batchSize, logger) {
  let state = await AnlySyncState.findOne({ tenantId });
  if (!state) {
    state = await AnlySyncState.create({ tenantId });
  }

  const filter = { tenantId, ...buildIncrementalFilter(state) };
  const orders = await Order().find(filter).sort({ updatedAt: 1, _id: 1 }).limit(batchSize).lean();

  let processed = 0;
  let lastSyncedAt = state.lastSyncedAt;
  let lastOrderId = state.lastOrderId;

  for (const order of orders) {
    const applied = await processOrderOnce(order);
    if (applied) processed += 1;
    lastSyncedAt = order.updatedAt || order.createdAt;
    lastOrderId = order._id;
  }

  state.lastSyncedAt = lastSyncedAt || state.lastSyncedAt;
  state.lastOrderId = lastOrderId || state.lastOrderId;
  state.lastRunAt = new Date();
  state.lastError = '';
  await state.save();

  return processed;
}

async function backfillTenant(tenantId, backfillDays, logger) {
  const state = await AnlySyncState.findOne({ tenantId });
  if (state?.backfillCompletedAt) return 0;

  const end = startOfLocalDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, backfillDays - 1));

  const orders = await Order().find({
    tenantId,
    status: 'completed',
    createdAt: { $gte: start, $lte: new Date() },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  let processed = 0;
  for (const order of orders) {
    const applied = await processOrderOnce(order);
    if (applied) processed += 1;
  }

  const last = orders[orders.length - 1];
  await AnlySyncState.findOneAndUpdate(
    { tenantId },
    {
      backfillCompletedAt: new Date(),
      lastSyncedAt: last?.updatedAt || last?.createdAt || new Date(),
      lastOrderId: last?._id || null,
      lastRunAt: new Date(),
      lastError: '',
    },
    { upsert: true },
  );

  logger?.info?.('anly backfill completed', { tenantId: String(tenantId), processed, backfillDays });
  return processed;
}

async function runAnlySync(logger) {
  const cfg = getAnlyConfig();
  if (!cfg.enabled || !cfg.leader) return { skipped: true };

  const tenants = await Tenant().find({}).select('_id').lean();
  let total = 0;

  for (const t of tenants) {
    try {
      const state = await AnlySyncState.findOne({ tenantId: t._id }).lean();
      if (!state?.backfillCompletedAt && cfg.backfillDays > 0) {
        total += await backfillTenant(t._id, cfg.backfillDays, logger);
      }
      total += await syncTenantIncremental(t._id, cfg.batchSize, logger);
    } catch (err) {
      await AnlySyncState.findOneAndUpdate(
        { tenantId: t._id },
        { lastRunAt: new Date(), lastError: err.message || String(err) },
        { upsert: true },
      ).catch(() => {});
      logger?.warn?.('anly sync tenant failed', { tenantId: String(t._id), error: err.message });
    }
  }

  return { processed: total };
}

function startAnlySyncScheduler(logger) {
  const cfg = getAnlyConfig();
  if (!cfg.enabled) {
    logger?.info?.('Analytics ETL disabled (ANLY_SYNC_ENABLED=false)');
    return;
  }
  if (!cfg.leader) {
    logger?.info?.('Analytics ETL skipped on this instance (ANLY_SYNC_LEADER=false)');
    return;
  }

  logger?.info?.('Analytics ETL scheduled', { intervalMs: cfg.intervalMs, backfillDays: cfg.backfillDays });

  runAnlySync(logger).catch((e) => logger?.warn?.('anly sync initial run failed', { error: e.message }));

  setInterval(() => {
    runAnlySync(logger).catch((e) => logger?.warn?.('anly sync failed', { error: e.message }));
  }, cfg.intervalMs);
}

module.exports = {
  getAnlyConfig,
  runAnlySync,
  startAnlySyncScheduler,
};
