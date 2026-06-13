const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('./pushNotifier');

// Module-level logger — defaults to console until setNotificationLogger() is called at startup
let _logger = console;

/**
 * Wire in the application Winston logger.
 * Call once from index.js after createLogger().
 */
function setNotificationLogger(logger) {
  _logger = logger;
}

function castTenantId(tenantId) {
  if (tenantId == null) return tenantId;
  try {
    const s = String(tenantId);
    if (mongoose.Types.ObjectId.isValid(s)) return new mongoose.Types.ObjectId(s);
  } catch (_) { /* ignore */ }
  return tenantId;
}

async function createNotification(tenantId, userId, payload) {
  const doc = await Notification.create({
    tenantId: castTenantId(tenantId),
    userId,
    type: payload.type,
    title: payload.title,
    body: payload.body || '',
    meta: payload.meta || {},
  });
  sendPushNotification(userId, payload, _logger).catch((err) => {
    _logger.error('[notificationHelpers] createNotification push failed', { error: err.message });
  });
  return doc;
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

  const inserted = await Notification.insertMany(docs);
  const targetIds = admins.map((a) => a._id);
  sendPushNotification(targetIds, payload, _logger).catch((err) => {
    _logger.error('[notificationHelpers] notifyMerchantAdmins push failed', { error: err.message });
  });
  return inserted;
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

  const inserted = await Notification.insertMany(docs);
  const targetIds = supers.map((u) => u._id);
  sendPushNotification(targetIds, payload, _logger).catch((err) => {
    _logger.error('[notificationHelpers] notifySuperAdmins push failed', { error: err.message });
  });
  return inserted;
}

module.exports = {
  setNotificationLogger,
  createNotification,
  notifyMerchantAdmins,
  notifySuperAdmins,
};
