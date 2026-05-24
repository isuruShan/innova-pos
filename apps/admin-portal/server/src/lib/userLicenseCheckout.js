'use strict';

const PaymentReceipt = require('../models/PaymentReceipt');
const { quoteCreateUser, quoteAssignStores } = require('./userLicenseQuote');
const { findPendingUserLicenseReceipt } = require('./userLicenseFulfill');

async function buildCreateUserPayload(tenantId, body, createdBy) {
  const { name, email, role, storeIds, defaultStoreId } = body;
  if (!name?.trim() || !email?.trim() || !role) {
    throw new Error('name, email, and role are required');
  }

  const emailClean = String(email).toLowerCase().trim();

  // Validate system-wide email uniqueness in User table
  const User = require('../models/User');
  const userExists = await User.findOne({ email: emailClean });
  if (userExists) throw new Error('Email already in use');

  // Validate in pending approvals for user creation (system-wide)
  const pendingApproval = await PaymentReceipt.findOne({
    receiptKind: 'user_license',
    userLicenseAction: 'create_user',
    status: 'pending',
    'userLicensePayload.email': emailClean,
  });
  if (pendingApproval) {
    throw new Error('A user creation request for this email is already pending approval');
  }

  const quote = await quoteCreateUser(tenantId, role, storeIds || []);
  if (!quote.requiresPayment) {
    throw new Error('No payment required for this user');
  }

  return {
    quote,
    payload: {
      name: String(name).trim(),
      email: emailClean,
      role: String(role).toLowerCase(),
      storeIds: storeIds || [],
      defaultStoreId: defaultStoreId || null,
      createdBy,
    },
  };
}

async function buildAssignStoresPayload(tenantId, body, createdBy) {
  const { userId, storeIds } = body;
  if (!userId) throw new Error('userId is required');
  const targetStoreIds = (storeIds || []).map(String);
  const quote = await quoteAssignStores(tenantId, userId, targetStoreIds);
  if (!quote.requiresPayment) {
    throw new Error('No payment required for this store assignment');
  }
  const pending = await findPendingUserLicenseReceipt(tenantId, 'assign_stores', { userId });
  if (pending) {
    throw new Error('A payment for this store assignment is already pending verification');
  }
  const licensed = quote.licensedStoreSlots;
  const newLicensedSlots = quote.targetStoreCount;
  return {
    quote,
    payload: {
      userId: String(userId),
      targetStoreIds,
      newLicensedSlots,
      slotsToAdd: quote.slotsToAdd,
      createdBy,
    },
  };
}

async function createPendingUserLicenseReceipt({
  tenantId,
  action,
  payload,
  amount,
  currency,
  paymentMethod,
  paypalOrderId,
  bankReference,
  receiptFileKey,
  notes,
  paymentBreakdown,
  createdBy,
}) {
  return PaymentReceipt.create({
    tenantId,
    receiptKind: 'user_license',
    userLicenseAction: action,
    userLicensePayload: payload,
    paymentMethod,
    amount,
    currency: currency || 'LKR',
    requestedPlanId: null,
    requestedPlanCode: '',
    expectedAmount: amount,
    amountMatchesExpected: true,
    bankReference: bankReference || '',
    bankName: paymentMethod === 'paypal' ? 'PayPal' : '',
    paymentDate: new Date(),
    paypalOrderId: paypalOrderId || '',
    receiptFileKey: receiptFileKey || '',
    notes: (notes || '').trim(),
    status: 'pending',
    paymentBreakdown,
    createdBy,
  });
}

module.exports = {
  buildCreateUserPayload,
  buildAssignStoresPayload,
  createPendingUserLicenseReceipt,
};
