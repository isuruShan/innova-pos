'use strict';

/** Catalog code (API / receipts) → tenant.paidAddons field name */
const ENTITLEMENT_BY_CODE = {
  qr_ordering: 'qrOrdering',
  loyalty: 'loyalty',
};

const KNOWN_ENTITLEMENT_KEYS = Object.values(ENTITLEMENT_BY_CODE);

function entitlementKeyForCode(code) {
  return ENTITLEMENT_BY_CODE[String(code || '').trim().toLowerCase()] || null;
}

function emptyEntitlement() {
  return {
    active: false,
    activatedAt: null,
    amountPerCycle: 0,
    currency: '',
    periodEndsAt: null,
    cancelAtPeriodEnd: false,
    trialActivatedAt: null,
    trialEndsAt: null,
    billingCycle: '',
  };
}

/**
 * Check if addon is in active trial period
 */
function isInTrialPeriod(entitlement) {
  if (!entitlement?.trialEndsAt) return false;
  const now = new Date();
  const trialEnd = new Date(entitlement.trialEndsAt);
  return now < trialEnd && entitlement.active;
}

/**
 * @param {object|null|undefined} paidAddons — tenant.paidAddons
 * @param {'qrOrdering'|'loyalty'|string} entitlementKey
 */
function isPaidAddonEffective(paidAddons, entitlementKey) {
  const row = paidAddons?.[entitlementKey];
  if (!row?.active) return false;
  
  // If in trial period, addon is effective
  if (isInTrialPeriod(row)) return true;
  
  // Check paid subscription validity
  if (!row.periodEndsAt) return true;
  return new Date() < new Date(row.periodEndsAt);
}

function isQrOrderingEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'qrOrdering');
}

function isLoyaltyEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'loyalty');
}

module.exports = {
  ENTITLEMENT_BY_CODE,
  KNOWN_ENTITLEMENT_KEYS,
  entitlementKeyForCode,
  emptyEntitlement,
  isPaidAddonEffective,
  isQrOrderingEffective,
  isLoyaltyEffective,
  isInTrialPeriod,
};
