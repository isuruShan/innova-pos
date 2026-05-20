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
 * Rate uses the next billing cycle length (`billingCycleDays`); days left use the current period end.
 * @param {import('mongoose').LeanDocument<any>} addon
 * @param {import('mongoose').LeanDocument<any>|null} plan — next billing plan (monthly/yearly pricing)
 * @param {Date|string|null} periodEnd — end of current paid subscription period
 * @param {{ billingCycleDays?: number, currentPeriodDays?: number }} [opts]
 */
function computeProratedAddonCharge(addon, plan, periodEnd, opts = {}) {
  const full = priceAddonForPlan(addon, plan, opts.countryIso);
  const currency = full.currency || 'LKR';
  const fullAmount = Number(full.amount) || 0;
  const billingCycleDays = Math.max(
    1,
    Number(opts.billingCycleDays)
      || Number(plan?.durationDays)
      || (plan?.billingCycle === 'yearly' ? 365 : 30)
  );
  const billingLabel =
    plan?.billingCycle === 'yearly'
      ? 'per year (your next billing cycle)'
      : 'per month (your next billing cycle)';

  const end = periodEnd ? new Date(periodEnd) : null;
  const now = new Date();
  const currentPeriodDays = opts.currentPeriodDays > 0 ? opts.currentPeriodDays : null;

  if (!end || end <= now || fullAmount <= 0) {
    return {
      fullAmount,
      amount: fullAmount,
      currency,
      label: full.label || addon?.name || '',
      billingLabel,
      cycleDays: billingCycleDays,
      remainingDays: billingCycleDays,
      isProrated: false,
      prorationNote: 'Full billing period charge.',
    };
  }

  const msLeft = end.getTime() - now.getTime();
  let remainingDays = Math.max(1, Math.ceil(msLeft / 86400000));
  if (currentPeriodDays) {
    remainingDays = Math.min(currentPeriodDays, remainingDays);
  }

  const amount = roundMoney((fullAmount / billingCycleDays) * remainingDays);
  const isProrated = remainingDays < billingCycleDays;

  return {
    fullAmount,
    amount,
    currency,
    label: full.label || addon?.name || '',
    billingLabel,
    cycleDays: billingCycleDays,
    remainingDays,
    periodEndsAt: end,
    currentPeriodDays,
    isProrated,
    prorationNote: isProrated
      ? `Prorated: ${remainingDays} day${remainingDays === 1 ? '' : 's'} left in your current period (ends ${end.toLocaleDateString()}), priced at your ${plan?.billingCycle === 'yearly' ? 'yearly' : 'monthly'} add-on rate for the next billing cycle.`
      : 'Full billing period charge.',
  };
}

module.exports = {
  roundMoney,
  resolveSubscriptionPeriodEnd,
  computeProratedAddonCharge,
};
