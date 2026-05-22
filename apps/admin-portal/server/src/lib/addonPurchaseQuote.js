'use strict';

const { getAddonByCode, priceAddonForPlan } = require('./addonBilling');
const {
  computeProratedAddonCharge,
  buildRecurringRates,
  buildProrationPayload,
} = require('./billingProration');
const { applyPaidAddonExpiryIfNeeded } = require('./addonPeriod');
const {
  loadTenantForBilling,
  resolveCurrentSubscriptionPeriod,
  resolveNextBillingPlan,
} = require('./resolveBillingPlan');

/**
 * First-payment quote for an add-on (prorated to remaining days in current subscription).
 */
async function getAddonPurchaseQuote(tenantId, code) {
  let tenant = await loadTenantForBilling(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  tenant = await applyPaidAddonExpiryIfNeeded(tenant);

  const addon = await getAddonByCode(code);
  if (!addon || !addon.isActive) throw new Error('Add-on not available');

  const plan = await resolveNextBillingPlan(tenant);
  const { periodEnd } = await resolveCurrentSubscriptionPeriod(tenant);
  const full = priceAddonForPlan(addon, plan, tenant.countryIso);
  const prorated = computeProratedAddonCharge(addon, plan, periodEnd, {
    countryIso: tenant.countryIso,
  });

  return {
    addon,
    plan,
    billingLabel: prorated.billingLabel,
    recurringRates: buildRecurringRates(full, plan),
    priced: {
      amount: prorated.amount,
      currency: prorated.currency,
      label: prorated.label,
    },
    fullCycle: {
      amount: full.amount,
      currency: full.currency,
      label: full.label,
      monthlyAmount: full.monthlyAmount,
      yearlyAmount: full.yearlyAmount,
      billingCycle: full.billingCycle,
    },
    proration: buildProrationPayload(prorated),
  };
}

module.exports = { getAddonPurchaseQuote, resolveNextBillingPlan };
