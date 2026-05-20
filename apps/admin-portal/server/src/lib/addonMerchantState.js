'use strict';

const PaymentReceipt = require('../models/PaymentReceipt');
const { isQrOrderingEffective } = require('./addonPeriod');

/**
 * @param {import('mongoose').LeanDocument<any>} tenant
 * @param {string} code
 */
async function getAddonMerchantState(tenant, code) {
  const c = String(code || '').trim().toLowerCase();

  const pendingReceipt = await PaymentReceipt.findOne({
    tenantId: tenant._id,
    receiptKind: 'addon',
    addonCode: c,
    status: 'pending',
  })
    .sort({ createdAt: -1 })
    .lean();

  if (c === 'qr_ordering') {
    const qr = tenant.paidAddons?.qrOrdering || {};
    const active = isQrOrderingEffective(tenant.paidAddons);
    const cancelScheduled = Boolean(qr.cancelAtPeriodEnd && active);
    return {
      pendingVerification: Boolean(pendingReceipt),
      alreadyActive: active,
      cancelScheduled,
      periodEndsAt: qr.periodEndsAt || null,
      canSubscribe: !active && !pendingReceipt,
      canUnsubscribe: active && !qr.cancelAtPeriodEnd,
    };
  }

  return {
    pendingVerification: Boolean(pendingReceipt),
    alreadyActive: false,
    cancelScheduled: false,
    periodEndsAt: null,
    canSubscribe: !pendingReceipt,
    canUnsubscribe: false,
  };
}

module.exports = { getAddonMerchantState };
