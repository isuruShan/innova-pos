'use strict';

const { getAddonByCode, priceAddonForPlan } = require('./addonBilling');
const { computeProratedAddonCharge } = require('./billingProration');
const { applyPaidAddonExpiryIfNeeded } = require('./addonPeriod');
const {
  loadTenantForBilling,
  planBillingCycleDays,
  resolveCurrentSubscriptionPeriod,
  resolveNextBillingPlan,
} = require('./resolveBillingPlan');

/**
 * First-payment quote for an add-on (prorated to remaining subscription days).
 */
async function getAddonPurchaseQuote(tenantId, code) {
  let tenant = await loadTenantForBilling(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  tenant = await applyPaidAddonExpiryIfNeeded(tenant);

  const addon = await getAddonByCode(code);
  if (!addon || !addon.isActive) throw new Error('Add-on not available');

  const plan = await resolveNextBillingPlan(tenant);
  const { periodEnd, periodDays } = await resolveCurrentSubscriptionPeriod(tenant);
  const full = priceAddonForPlan(addon, plan, tenant.countryIso);
  const prorated = computeProratedAddonCharge(addon, plan, periodEnd, {
    billingCycleDays: planBillingCycleDays(plan),
    currentPeriodDays: periodDays,
    countryIso: tenant.countryIso,
  });
  const billingLabel =
    plan?.billingCycle === 'yearly'
      ? 'per year (your next billing cycle)'
      : 'per month (your next billing cycle)';

  return {
    addon,
    plan,
    billingLabel,
    priced: {
      amount: prorated.amount,
      currency: prorated.currency,
      label: prorated.label,
    },
    fullCycle: {
      amount: full.amount,
      currency: full.currency,
      label: full.label,
    },
    proration: {
      fullAmount: prorated.fullAmount,
      amount: prorated.amount,
      currency: prorated.currency,
      cycleDays: prorated.cycleDays,
      remainingDays: prorated.remainingDays,
      periodEndsAt: prorated.periodEndsAt,
      isProrated: prorated.isProrated,
      note: prorated.prorationNote,
    },
  };
}

module.exports = { getAddonPurchaseQuote, resolveNextBillingPlan };
