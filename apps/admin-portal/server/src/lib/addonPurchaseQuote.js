'use strict';

const Tenant = require('../models/Tenant');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { tenantPlanAudience } = require('../utils/planAudience');
const { getAddonByCode, priceAddonForPlan } = require('./addonBilling');
const { computeProratedAddonCharge, resolveSubscriptionPeriodEnd } = require('./billingProration');
const { applyPaidAddonExpiryIfNeeded } = require('./addonPeriod');

async function resolvePlanForTenantAddons(tenant) {
  const audience = tenantPlanAudience(tenant.countryIso);
  let plan = tenant.assignedPlanId;
  if (plan && typeof plan === 'object' && plan._id) {
    return plan;
  }
  if (tenant.assignedPlanId) {
    return SubscriptionPlan.findOne({
      _id: tenant.assignedPlanId,
      isActive: true,
      planAudience: audience,
    }).lean();
  }
  return SubscriptionPlan.findOne({ isActive: true, isDefault: true, planAudience: audience })
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * First-payment quote for an add-on (prorated to remaining subscription days).
 */
async function getAddonPurchaseQuote(tenantId, code) {
  let tenant = await Tenant.findById(tenantId).populate('assignedPlanId');
  if (!tenant) throw new Error('Tenant not found');
  tenant = await applyPaidAddonExpiryIfNeeded(tenant);

  const addon = await getAddonByCode(code);
  if (!addon || !addon.isActive) throw new Error('Add-on not available');

  const plan = await resolvePlanForTenantAddons(tenant);
  const periodEnd = await resolveSubscriptionPeriodEnd(tenant);
  const full = priceAddonForPlan(addon, plan);
  const prorated = computeProratedAddonCharge(addon, plan, periodEnd);
  const billingLabel =
    plan?.billingCycle === 'yearly' ? 'per year (matches your yearly plan)' : 'per month (matches your monthly plan)';

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

module.exports = { getAddonPurchaseQuote, resolvePlanForTenantAddons };
