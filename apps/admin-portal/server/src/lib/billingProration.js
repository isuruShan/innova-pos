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

  // Normalise both dates to midnight (UTC) so proration is calendar-date based,
  // not time-of-day based.
  const endRaw = periodEnd ? new Date(periodEnd) : null;
  const nowRaw = new Date();

  // Strip time: floor to start of calendar day in UTC
  function toDateOnly(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  const end = endRaw ? toDateOnly(endRaw) : null;
  const now = toDateOnly(nowRaw);
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

  // Use calendar-day difference (each day is exactly 86400 s in UTC-normalised dates)
  const msLeft = end.getTime() - now.getTime();
  let remainingDays = Math.max(1, Math.round(msLeft / 86400000));
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
