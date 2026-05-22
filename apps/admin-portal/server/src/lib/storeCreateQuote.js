'use strict';

const { getAddonByCode, ensureDefaultPaidAddons, priceAddonForPlan } = require('./addonBilling');
const {
  computeProratedAddonCharge,
  buildRecurringRates,
  buildProrationPayload,
} = require('./billingProration');
const {
  loadTenantForBilling,
  planBillingCycleDays,
  resolveCurrentSubscriptionPeriod,
  resolveNextBillingPlan,
} = require('./resolveBillingPlan');
const {
  countActiveStoresForTenant,
  requiresPaymentForNewStore,
  INCLUDED_STORES_PER_TENANT,
} = require('./storePurchase');

async function getStoreCreateQuote(tenantId) {
  await ensureDefaultPaidAddons();
  const tenant = await loadTenantForBilling(tenantId);
  if (!tenant) return { requiresPayment: false, error: 'Tenant not found' };
  const plan = await resolveNextBillingPlan(tenant);
  const activeCount = await countActiveStoresForTenant(tenantId);
  const requiresPayment = requiresPaymentForNewStore(activeCount);

  if (!requiresPayment) {
    return {
      requiresPayment: false,
      activeStoreCount: activeCount,
      includedStores: INCLUDED_STORES_PER_TENANT,
      message: 'Your first store is included in your plan at no extra charge.',
    };
  }

  const addon = await getAddonByCode('additional_store');
  if (!addon || !addon.isActive) {
    return {
      requiresPayment: true,
      activeStoreCount: activeCount,
      error: 'Additional store pricing is not configured. Contact support.',
    };
  }
  if (!plan) {
    return {
      requiresPayment: true,
      activeStoreCount: activeCount,
      error: 'No billing plan assigned. Contact support.',
    };
  }

  const { periodEnd, periodDays } = await resolveCurrentSubscriptionPeriod(tenant);
  const full = priceAddonForPlan(addon, plan, tenant.countryIso);
  const prorated = computeProratedAddonCharge(addon, plan, periodEnd, {
    billingCycleDays: planBillingCycleDays(plan),
    currentPeriodDays: periodDays,
    countryIso: tenant.countryIso,
  });

  return {
    requiresPayment: true,
    activeStoreCount: activeCount,
    includedStores: INCLUDED_STORES_PER_TENANT,
    purchaseKind: 'store',
    name: 'Additional store location',
    shortDescription: 'Adds one new store to your account. You can edit name, code, and settings after payment.',
    recurringRates: buildRecurringRates(full, plan),
    priced: {
      amount: prorated.amount,
      currency: prorated.currency,
      label: prorated.label,
      billingLabel: prorated.billingLabel,
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
    plan: plan ? { name: plan.name, billingCycle: plan.billingCycle } : null,
  };
}

module.exports = { getStoreCreateQuote };
