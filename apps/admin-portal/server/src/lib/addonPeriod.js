'use strict';

const {
  entitlementKeyForCode,
  emptyEntitlement,
  isPaidAddonEffective,
  isQrOrderingEffective,
  isLoyaltyEffective,
  isTableManagementEffective,
  isUberEatsEffective,
  isAccountingEffective,
  isDualScreenEffective,
  isWhatsappEffective,
} = require('@innovapos/paid-addons');

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

async function applyAddonExpiryIfNeeded(tenant, entitlementKey) {
  const row = tenant.paidAddons?.[entitlementKey];
  if (!row?.active) return tenant;
  if (!row.periodEndsAt) return tenant;
  if (new Date() < new Date(row.periodEndsAt)) return tenant;

  tenant.paidAddons = tenant.paidAddons || {};
  tenant.paidAddons[entitlementKey] = emptyEntitlement();
  await tenant.save();
  return tenant;
}

/** Expire QR ordering, loyalty, table management, Uber Eats, accounting, dual screen, and whatsapp when their paid periods have ended. */
async function applyPaidAddonExpiryIfNeeded(tenant) {
  let t = tenant;
  t = await applyAddonExpiryIfNeeded(t, 'qrOrdering');
  t = await applyAddonExpiryIfNeeded(t, 'loyalty');
  t = await applyAddonExpiryIfNeeded(t, 'tableManagement');
  t = await applyAddonExpiryIfNeeded(t, 'uberEats');
  t = await applyAddonExpiryIfNeeded(t, 'accounting');
  t = await applyAddonExpiryIfNeeded(t, 'dualScreen');
  t = await applyAddonExpiryIfNeeded(t, 'whatsapp');
  return t;
}

/** @deprecated use applyPaidAddonExpiryIfNeeded */
async function applyQrOrderingExpiryIfNeeded(tenant) {
  return applyPaidAddonExpiryIfNeeded(tenant);
}

module.exports = {
  computeAddonPeriodEnd,
  entitlementKeyForCode,
  isPaidAddonEffective,
  isQrOrderingEffective,
  isLoyaltyEffective,
  isTableManagementEffective,
  isUberEatsEffective,
  isAccountingEffective,
  isDualScreenEffective,
  isWhatsappEffective,
  applyAddonExpiryIfNeeded,
  applyPaidAddonExpiryIfNeeded,
  applyQrOrderingExpiryIfNeeded,
};
