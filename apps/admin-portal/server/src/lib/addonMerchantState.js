'use strict';

const PaymentReceipt = require('../models/PaymentReceipt');
const { isPaidAddonEffective, entitlementKeyForCode, isInTrialPeriod } = require('@innovapos/paid-addons');

/**
 * @param {import('mongoose').LeanDocument<any>} tenant
 * @param {string} code
 */
async function getAddonMerchantState(tenant, code) {
  const c = String(code || '').trim().toLowerCase();
  const entitlementKey = entitlementKeyForCode(c);

  const pendingReceipt = await PaymentReceipt.findOne({
    tenantId: tenant._id,
    receiptKind: 'addon',
    addonCode: c,
    status: 'pending',
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!entitlementKey) {
    return {
      pendingVerification: Boolean(pendingReceipt),
      alreadyActive: false,
      cancelScheduled: false,
      periodEndsAt: null,
      canSubscribe: false,
      canUnsubscribe: false,
      isInTrial: false,
      trialEndsAt: null,
      canStartTrial: false,
    };
  }

  const row = tenant.paidAddons?.[entitlementKey] || {};
  const active = isPaidAddonEffective(tenant, entitlementKey);
  const inTrial = isInTrialPeriod(row);
  const cancelScheduled = Boolean(row.cancelAtPeriodEnd && active);
  
  // Can start trial if: not active, no pending receipt, never had trial before, and tenant is NOT in trial
  const canStartTrial = (tenant.subscriptionStatus !== 'trial') && !active && !pendingReceipt && !row.trialActivatedAt;
  
  return {
    pendingVerification: Boolean(pendingReceipt),
    alreadyActive: active,
    cancelScheduled,
    periodEndsAt: row.periodEndsAt || null,
    canSubscribe: !active && !pendingReceipt,
    canUnsubscribe: active && !row.cancelAtPeriodEnd && !inTrial,
    isInTrial: inTrial,
    trialEndsAt: row.trialEndsAt || null,
    trialActivatedAt: row.trialActivatedAt || null,
    canStartTrial,
    billingCycle: row.billingCycle || null,
  };
}

module.exports = { getAddonMerchantState };
