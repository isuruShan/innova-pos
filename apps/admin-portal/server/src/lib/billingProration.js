'use strict';

const Subscription = require('../models/Subscription');
const { priceAddonForPlan } = require('./addonBilling');

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * End of the current paid period used for add-on / store proration.
 * @param {import('mongoose').LeanDocument<any>} tenant
 */
async function resolveSubscriptionPeriodEnd(tenant) {
  if (!tenant) return null;
  if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt) {
    return new Date(tenant.trialEndsAt);
  }
  const latest = await Subscription.findOne({ tenantId: tenant._id || tenant })
    .sort({ endDate: -1 })
    .lean();
  if (latest?.endDate) return new Date(latest.endDate);
  if (tenant.trialEndsAt) return new Date(tenant.trialEndsAt);
  return null;
}

/**
 * Prorate a full-cycle add-on price for remaining days in the active subscription period.
 * @param {import('mongoose').LeanDocument<any>} addon
 * @param {import('mongoose').LeanDocument<any>|null} plan
 * @param {Date|string|null} periodEnd
 */
function computeProratedAddonCharge(addon, plan, periodEnd) {
  const full = priceAddonForPlan(addon, plan);
  const currency = full.currency || 'LKR';
  const fullAmount = Number(full.amount) || 0;
  const cycleDays = Math.max(1, Number(plan?.durationDays) || (plan?.billingCycle === 'yearly' ? 365 : 30));
  const billingLabel =
    plan?.billingCycle === 'yearly' ? 'per year (matches your yearly plan)' : 'per month (matches your monthly plan)';

  const end = periodEnd ? new Date(periodEnd) : null;
  const now = new Date();
  if (!end || end <= now || fullAmount <= 0) {
    return {
      fullAmount,
      amount: fullAmount,
      currency,
      label: full.label || addon?.name || '',
      billingLabel,
      cycleDays,
      remainingDays: cycleDays,
      isProrated: false,
      prorationNote: 'Full billing period charge.',
    };
  }

  const msLeft = end.getTime() - now.getTime();
  const remainingDays = Math.min(cycleDays, Math.max(1, Math.ceil(msLeft / 86400000)));
  const amount = roundMoney((fullAmount / cycleDays) * remainingDays);

  return {
    fullAmount,
    amount,
    currency,
    label: full.label || addon?.name || '',
    billingLabel,
    cycleDays,
    remainingDays,
    periodEndsAt: end,
    isProrated: remainingDays < cycleDays,
    prorationNote: `Prorated for ${remainingDays} of ${cycleDays} days left in your current subscription period (ends ${end.toLocaleDateString()}).`,
  };
}

module.exports = {
  roundMoney,
  resolveSubscriptionPeriodEnd,
  computeProratedAddonCharge,
};
