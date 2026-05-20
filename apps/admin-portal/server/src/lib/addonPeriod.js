'use strict';

/**
 * @param {Date|string} activatedAt
 * @param {'monthly'|'yearly'|string} billingCycle
 */
function computeAddonPeriodEnd(activatedAt, billingCycle) {
  const d = new Date(activatedAt || Date.now());
  if (billingCycle === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function isQrOrderingEffective(paidAddons) {
  const qr = paidAddons?.qrOrdering;
  if (!qr?.active) return false;
  if (!qr.periodEndsAt) return true;
  return new Date() < new Date(qr.periodEndsAt);
}

/**
 * Deactivate QR ordering when the paid period has ended (after unsubscribe or natural expiry).
 * @param {import('mongoose').Document} tenant — mongoose Tenant document
 */
async function applyQrOrderingExpiryIfNeeded(tenant) {
  const qr = tenant.paidAddons?.qrOrdering;
  if (!qr?.active) return tenant;
  if (!qr.periodEndsAt) return tenant;
  if (new Date() < new Date(qr.periodEndsAt)) return tenant;

  tenant.paidAddons = tenant.paidAddons || {};
  tenant.paidAddons.qrOrdering = {
    active: false,
    activatedAt: null,
    amountPerCycle: 0,
    currency: '',
    periodEndsAt: null,
    cancelAtPeriodEnd: false,
  };
  await tenant.save();
  return tenant;
}

module.exports = {
  computeAddonPeriodEnd,
  isQrOrderingEffective,
  applyQrOrderingExpiryIfNeeded,
};
