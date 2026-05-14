const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');

function castTenantId(tenantId) {
  if (tenantId == null) return tenantId;
  try {
    const s = String(tenantId);
    if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
  } catch (_) { /* ignore */ }
  return tenantId;
}

async function createNotification(tenantId, userId, payload) {
  return Notification.create({
    tenantId: castTenantId(tenantId),
    userId,
    type: payload.type,
    title: payload.title,
    body: payload.body || '',
    meta: payload.meta || {},
  });
}

/** Notify every active merchant admin in the tenant */
async function notifyMerchantAdmins(tenantId, payload, options = {}) {
  const { excludeUserId } = options;
  const tid = castTenantId(tenantId);
  let admins = await User.find({
    tenantId: tid,
    role: 'merchant_admin',
    isActive: true,
  }).select('_id').lean();

  if (excludeUserId) {
    const ex = String(excludeUserId);
    admins = admins.filter((a) => String(a._id) !== ex);
  }

  if (!admins.length) return [];

  const docs = admins.map((a) => ({
    tenantId: tid,
    userId: a._id,
    type: payload.type,
    title: payload.title,
    body: payload.body || '',
    meta: payload.meta || {},
  }));

  return Notification.insertMany(docs);
}

async function notifyPosStaffOrderStatusChange({
  tenantId,
  storeId,
  excludeUserId,
  order,
  prevStatus,
  nextStatus,
}) {
  const tid = castTenantId(tenantId);
  const roles = ['cashier', 'kitchen', 'manager', 'merchant_admin'];
  const users = await User.find({
    tenantId: tid,
    role: { $in: roles },
    isActive: true,
  })
    .select('_id storeIds')
    .lean();

  const sid = storeId ? String(storeId) : '';
  const targets = users.filter((u) => {
    if (excludeUserId && String(u._id) === String(excludeUserId)) return false;
    const ids = (u.storeIds || []).map(String);
    if (!ids.length) return true;
    return sid && ids.includes(sid);
  });

  if (!targets.length) return [];

  const num = order?.orderNumber != null ? String(order.orderNumber).padStart(3, '0') : '···';
  const title = `Order #${num} → ${nextStatus}`;
  const body = `Previously ${prevStatus}. Tap the order board to handle.`;

  const docs = targets.map((u) => ({
    tenantId: tid,
    userId: u._id,
    type: 'order_status_changed',
    title,
    body,
    meta: {
      resourceType: 'order',
      resourceId: String(order._id),
      prevStatus,
      nextStatus,
      storeId: sid,
      orderType: order.orderType || '',
    },
  }));

  return Notification.insertMany(docs);
}

/**
 * Notify front-of-house staff that a guest used “call waiter” on a table QR link.
 * Targets cashier, manager, and merchant_admin scoped to the store (via storeIds when set).
 */
async function notifyCashiersTableWaiterCall({
  tenantId,
  storeId,
  tableLabel,
  tableId,
  order,
}) {
  const tid = castTenantId(tenantId);
  const roles = ['cashier', 'manager', 'merchant_admin'];
  const users = await User.find({
    tenantId: tid,
    role: { $in: roles },
    isActive: true,
  })
    .select('_id storeIds')
    .lean();

  const sid = storeId ? String(storeId) : '';
  const targets = users.filter((u) => {
    const ids = (u.storeIds || []).map(String);
    if (!ids.length) return true;
    return sid && ids.includes(sid);
  });

  if (!targets.length) return [];

  const num = order?.orderNumber != null ? String(order.orderNumber).padStart(3, '0') : null;
  const title = num ? `Table ${tableLabel} — guest called (#${num})` : `Table ${tableLabel} — guest called`;
  const body = num
    ? `A guest at table ${tableLabel} requested assistance (order #${num}).`
    : `A guest at table ${tableLabel} requested assistance (no open order yet).`;

  const docs = targets.map((u) => ({
    tenantId: tid,
    userId: u._id,
    type: 'table_waiter_call',
    title,
    body,
    meta: {
      resourceType: order ? 'order' : 'table',
      resourceId: order ? String(order._id) : String(tableId),
      storeId: sid,
      tableLabel: String(tableLabel || ''),
      tableId: String(tableId || ''),
    },
  }));

  return Notification.insertMany(docs);
}

/**
 * Notify cashiers only when a guest creates or updates an order via the public QR link.
 */
async function notifyCashiersQrOrderChange({ tenantId, storeId, tableLabel, order, changeKind }) {
  const tid = castTenantId(tenantId);
  const users = await User.find({
    tenantId: tid,
    role: 'cashier',
    isActive: true,
  })
    .select('_id storeIds')
    .lean();

  const sid = storeId ? String(storeId) : '';
  const targets = users.filter((u) => {
    const ids = (u.storeIds || []).map(String);
    if (!ids.length) return true;
    return sid && ids.includes(sid);
  });

  if (!targets.length) return [];

  const num = order?.orderNumber != null ? String(order.orderNumber).padStart(3, '0') : '···';
  const isNew = changeKind === 'new_order';
  const title = isNew
    ? `Table ${tableLabel} — new QR order (#${num})`
    : `Table ${tableLabel} — QR order updated (#${num})`;
  const body = isNew
    ? 'A guest started an order from the table QR link. Open the order board to review it.'
    : 'A guest added items to this table’s order from their phone. Review the order for updates.';

  const oid = order?._id != null ? String(order._id) : '';
  const tableIdStr = order?.tableId != null ? String(order.tableId) : '';

  const docs = targets.map((u) => ({
    tenantId: tid,
    userId: u._id,
    type: 'qr_order_updated',
    title,
    body,
    meta: {
      resourceType: 'order',
      resourceId: oid,
      storeId: sid,
      tableLabel: String(tableLabel || ''),
      tableId: tableIdStr,
      changeKind: isNew ? 'new_order' : 'items_added',
    },
  }));

  return Notification.insertMany(docs);
}

module.exports = {
  createNotification,
  notifyMerchantAdmins,
  notifyPosStaffOrderStatusChange,
  notifyCashiersTableWaiterCall,
  notifyCashiersQrOrderChange,
};
