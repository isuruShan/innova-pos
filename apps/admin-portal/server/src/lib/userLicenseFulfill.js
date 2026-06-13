'use strict';

const crypto = require('crypto');
const User = require('../models/User');
const Store = require('../models/Store');
const PaymentReceipt = require('../models/PaymentReceipt');
const { sendWelcomeEmail } = require('../utils/mailer');
const { createNotification } = require('./notificationHelpers');
const { emitAudit } = require('@innovapos/shared-middleware');
const { endTenantTrialOnPaidPurchase } = require('./subscriptionActivation');

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');

async function allTenantStoreIds(tenantId) {
  const stores = await Store.find({ tenantId, isActive: true }).select('_id').lean();
  return stores.map((s) => String(s._id));
}

async function normalizeStoreAssignments({ tenantId, storeIds = [], defaultStoreId = null, role }) {
  const tenantStoreSet = new Set(await allTenantStoreIds(tenantId));

  if (role === 'merchant_admin') {
    const allIds = [...tenantStoreSet];
    const def =
      defaultStoreId && tenantStoreSet.has(String(defaultStoreId))
        ? String(defaultStoreId)
        : allIds[0] || null;
    return { normalizedStoreIds: allIds, normalizedDefaultStoreId: def };
  }

  const normalizedStoreIds = [...new Set((storeIds || []).map(String))].filter((id) =>
    tenantStoreSet.has(id),
  );
  const normalizedDefaultStoreId =
    defaultStoreId && tenantStoreSet.has(String(defaultStoreId))
      ? String(defaultStoreId)
      : normalizedStoreIds[0] || null;

  return { normalizedStoreIds, normalizedDefaultStoreId };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {{ name: string, email: string, role: string, storeIds?: string[], defaultStoreId?: string|null, createdBy?: string }} payload
 */
async function fulfillCreateUser(tenantId, payload, meta = {}) {
  const { name, email, role, storeIds, defaultStoreId, createdBy } = payload;
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) throw new Error('Email already in use');

  const { normalizedStoreIds, normalizedDefaultStoreId } = await normalizeStoreAssignments({
    tenantId,
    storeIds,
    defaultStoreId,
    role,
  });

  const tempPassword = generateTempPassword();
  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password: tempPassword,
    role,
    tenantId,
    storeIds: normalizedStoreIds,
    defaultStoreId: normalizedDefaultStoreId,
    licensedStoreSlots: Math.max(1, (normalizedStoreIds || []).length),
    isTemporaryPassword: true,
    isActive: true,
    createdBy: createdBy || null,
  });

  const loginUrl =
    role === 'merchant_admin'
      ? process.env.ADMIN_URL || 'http://localhost:5174'
      : process.env.POS_URL || 'http://localhost:5173';

  // Fire-and-forget — welcome email must not block the response
  sendWelcomeEmail({ to: user.email, name: user.name, tempPassword, loginUrl, role: user.role }).catch(() => {});

  createNotification(tenantId, user._id, {
    type: 'account_created',
    title: '🎉 Welcome to Cafinity!',
    body: `Hello ${user.name}! Your account has been created with temporary login details. Check your email.`,
    meta: { resourceType: 'user', resourceId: String(user._id) },
  }).catch(() => {});

  return { user, tempPassword };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {string} userId
 * @param {string[]} targetStoreIds
 * @param {number} newLicensedSlots
 */
async function fulfillAssignStores(tenantId, userId, targetStoreIds, newLicensedSlots, updatedBy) {
  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) throw new Error('User not found');

  const { normalizedStoreIds, normalizedDefaultStoreId } = await normalizeStoreAssignments({
    tenantId,
    storeIds: targetStoreIds,
    defaultStoreId: user.defaultStoreId,
    role: user.role,
  });

  user.storeIds = normalizedStoreIds;
  user.defaultStoreId = normalizedDefaultStoreId;
  user.licensedStoreSlots = Math.max(1, Number(newLicensedSlots) || normalizedStoreIds.length);
  user.updatedBy = updatedBy || null;
  await user.save();
  return user;
}

async function processVerifiedUserLicenseReceipt(receipt, req) {
  const tenantId = receipt.tenantId?._id || receipt.tenantId;
  await endTenantTrialOnPaidPurchase(tenantId, { activatedBy: receipt.createdBy || req?.user?.id || null });
  const payload = receipt.userLicensePayload || {};
  const action = receipt.userLicenseAction;

  if (action === 'create_user') {
    const { user } = await fulfillCreateUser(tenantId, payload, { createdBy: receipt.createdBy });
    if (req) {
      await emitAudit({
        req,
        action: 'USER_CREATED',
        resource: 'User',
        resourceId: user._id,
        changes: { after: { name: user.name, email: user.email, role: user.role, via: 'user_license' } },
      });
    }
    return { user };
  }

  if (action === 'assign_stores') {
    const user = await fulfillAssignStores(
      tenantId,
      payload.userId,
      payload.targetStoreIds || [],
      payload.newLicensedSlots,
      receipt.createdBy,
    );
    if (req) {
      await emitAudit({
        req,
        action: 'USER_UPDATED',
        resource: 'User',
        resourceId: user._id,
        changes: { after: { licensedStoreSlots: user.licensedStoreSlots, via: 'user_license' } },
      });
    }
    return { user };
  }

  throw new Error('Unknown user license action');
}

async function findPendingUserLicenseReceipt(tenantId, action, payloadMatch) {
  const pending = await PaymentReceipt.find({
    tenantId,
    receiptKind: 'user_license',
    userLicenseAction: action,
    status: 'pending',
  }).sort({ createdAt: -1 });

  return pending.find((r) => {
    const p = r.userLicensePayload || {};
    if (action === 'create_user') {
      return String(p.email || '').toLowerCase() === String(payloadMatch.email || '').toLowerCase();
    }
    if (action === 'assign_stores') {
      return String(p.userId) === String(payloadMatch.userId);
    }
    return false;
  });
}

module.exports = {
  normalizeStoreAssignments,
  fulfillCreateUser,
  fulfillAssignStores,
  processVerifiedUserLicenseReceipt,
  findPendingUserLicenseReceipt,
};
