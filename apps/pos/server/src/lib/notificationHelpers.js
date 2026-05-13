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

module.exports = {
  createNotification,
  notifyMerchantAdmins,
  notifyPosStaffOrderStatusChange,
};
