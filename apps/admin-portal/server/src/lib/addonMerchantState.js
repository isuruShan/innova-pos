'use strict';

const PaymentReceipt = require('../models/PaymentReceipt');
const { isPaidAddonEffective, entitlementKeyForCode } = require('@innovapos/paid-addons');

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
    };
  }

  const row = tenant.paidAddons?.[entitlementKey] || {};
  const active = isPaidAddonEffective(tenant.paidAddons, entitlementKey);
  const cancelScheduled = Boolean(row.cancelAtPeriodEnd && active);
  return {
    pendingVerification: Boolean(pendingReceipt),
    alreadyActive: active,
    cancelScheduled,
    periodEndsAt: row.periodEndsAt || null,
    canSubscribe: !active && !pendingReceipt,
    canUnsubscribe: active && !row.cancelAtPeriodEnd,
  };
}

module.exports = { getAddonMerchantState };
