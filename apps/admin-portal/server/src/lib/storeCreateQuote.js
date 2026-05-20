'use strict';

const Tenant = require('../models/Tenant');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { getAddonByCode, ensureDefaultPaidAddons } = require('./addonBilling');
const { computeProratedAddonCharge, resolveSubscriptionPeriodEnd } = require('./billingProration');
const { tenantPlanAudience } = require('../utils/planAudience');
const {
  countActiveStoresForTenant,
  requiresPaymentForNewStore,
  INCLUDED_STORES_PER_TENANT,
} = require('./storePurchase');

async function resolvePlanForTenantId(tenantId) {
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant?.assignedPlanId) return { tenant, plan: null };
  const audience = tenantPlanAudience(tenant.countryIso);
  const plan = await SubscriptionPlan.findOne({
    _id: tenant.assignedPlanId,
    isActive: true,
    planAudience: audience,
  }).lean();
  return { tenant, plan };
}

async function getStoreCreateQuote(tenantId) {
  await ensureDefaultPaidAddons();
  const { tenant, plan } = await resolvePlanForTenantId(tenantId);
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

  const periodEnd = await resolveSubscriptionPeriodEnd(tenant);
  const priced = computeProratedAddonCharge(addon, plan, periodEnd);

  return {
    requiresPayment: true,
    activeStoreCount: activeCount,
    includedStores: INCLUDED_STORES_PER_TENANT,
    purchaseKind: 'store',
    name: 'Additional store location',
    shortDescription: 'Adds one new store to your account. You can edit name, code, and settings after payment.',
    priced: {
      amount: priced.amount,
      currency: priced.currency,
      label: priced.label,
      billingLabel: priced.billingLabel,
    },
    proration: {
      fullAmount: priced.fullAmount,
      amount: priced.amount,
      currency: priced.currency,
      cycleDays: priced.cycleDays,
      remainingDays: priced.remainingDays,
      periodEndsAt: priced.periodEndsAt,
      isProrated: priced.isProrated,
      note: priced.prorationNote,
    },
    plan: plan ? { name: plan.name, billingCycle: plan.billingCycle } : null,
  };
}

module.exports = { getStoreCreateQuote, resolvePlanForTenantId };
