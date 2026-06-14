'use strict';

/** Catalog code (API / receipts) → tenant.paidAddons field name */
const ENTITLEMENT_BY_CODE = {
  qr_ordering: 'qrOrdering',
  loyalty: 'loyalty',
  table_management: 'tableManagement',
  uber_eats: 'uberEats',
  accounting: 'accounting',
  dual_screen: 'dualScreen',
  whatsapp_integration: 'whatsapp',
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
 * @param {object|null|undefined} tenantOrPaidAddons — tenant or tenant.paidAddons
 * @param {'qrOrdering'|'loyalty'|string} entitlementKey
 */
function isPaidAddonEffective(tenantOrPaidAddons, entitlementKey) {
  let paidAddons = tenantOrPaidAddons;
  let includedAddons = [];

  if (tenantOrPaidAddons && typeof tenantOrPaidAddons === 'object') {
    if ('paidAddons' in tenantOrPaidAddons) {
      paidAddons = tenantOrPaidAddons.paidAddons;
      const plan = tenantOrPaidAddons.assignedPlanId;
      if (plan && typeof plan === 'object' && Array.isArray(plan.includedAddons)) {
        includedAddons = plan.includedAddons;
      }
    }
  }

  const code = Object.keys(ENTITLEMENT_BY_CODE).find(k => ENTITLEMENT_BY_CODE[k] === entitlementKey);
  if (code && includedAddons.includes(code)) {
    return true;
  }

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

function isTableManagementEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'tableManagement');
}

function isUberEatsEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'uberEats');
}

function isAccountingEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'accounting');
}

function isDualScreenEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'dualScreen');
}

function isWhatsappEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'whatsapp');
}

module.exports = {
  ENTITLEMENT_BY_CODE,
  KNOWN_ENTITLEMENT_KEYS,
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
  isInTrialPeriod,
};
