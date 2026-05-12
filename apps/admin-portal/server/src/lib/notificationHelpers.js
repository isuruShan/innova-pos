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

async function notifySuperAdmins(tenantId, payload, options = {}) {
  const { excludeUserId } = options;
  const tid = castTenantId(tenantId);
  let supers = await User.find({
    role: 'superadmin',
    isActive: true,
  }).select('_id').lean();

  if (excludeUserId) {
    const ex = String(excludeUserId);
    supers = supers.filter((u) => String(u._id) !== ex);
  }

  if (!supers.length) return [];

  const docs = supers.map((u) => ({
    tenantId: tid,
    userId: u._id,
    type: payload.type,
    title: payload.title,
    body: payload.body || '',
    meta: payload.meta || {},
  }));

  return Notification.insertMany(docs);
}

module.exports = {
  createNotification,
  notifyMerchantAdmins,
  notifySuperAdmins,
};
