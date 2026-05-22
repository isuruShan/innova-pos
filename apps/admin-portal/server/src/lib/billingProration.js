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

function toDateOnly(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Calendar days from today until the end of the current subscription period.
 */
function remainingDaysInCurrentPeriod(periodEnd) {
  if (!periodEnd) return null;
  const end = toDateOnly(new Date(periodEnd));
  const now = toDateOnly(new Date());
  if (end <= now) return 0;
  return Math.max(1, Math.round((end.getTime() - now.getTime()) / 86400000));
}

/**
 * Prorate using the **current** subscription period:
 *   amount = (cycle price ÷ period length in days) × remaining days
 *
 * @param {import('mongoose').LeanDocument<any>} addon
 * @param {import('mongoose').LeanDocument<any>|null} plan
 * @param {Date|string|null} periodEnd
 * @param {{ billingCycleDays?: number, currentPeriodDays?: number, countryIso?: string }} [opts]
 */
function computeProratedAddonCharge(addon, plan, periodEnd, opts = {}) {
  const full = priceAddonForPlan(addon, plan, opts.countryIso);
  const currency = full.currency || 'LKR';
  const cycleAmount = Number(full.amount) || 0;
  const monthlyListPrice = Number(full.monthlyAmount) || 0;
  const yearlyListPrice = Number(full.yearlyAmount) || 0;
  const billingCycle = full.billingCycle || plan?.billingCycle || 'monthly';

  const fallbackCycleDays =
    Number(opts.billingCycleDays)
    || Number(plan?.durationDays)
    || (billingCycle === 'yearly' ? 365 : 30);

  /** Length of the merchant's current paid subscription period (days). */
  const periodLength = Math.max(
    1,
    Number(opts.currentPeriodDays) > 0 ? Number(opts.currentPeriodDays) : fallbackCycleDays,
  );

  const billingLabel =
    billingCycle === 'yearly'
      ? 'per year on your subscription'
      : 'per month on your subscription';

  const remainingDays = remainingDaysInCurrentPeriod(periodEnd);

  if (remainingDays == null || remainingDays <= 0 || cycleAmount <= 0) {
    return {
      fullAmount: cycleAmount,
      amount: cycleAmount,
      currency,
      label: full.label || addon?.name || '',
      billingLabel,
      billingCycle,
      monthlyListPrice,
      yearlyListPrice,
      cycleDays: periodLength,
      periodLength,
      remainingDays: remainingDays || periodLength,
      periodEndsAt: periodEnd ? toDateOnly(new Date(periodEnd)) : null,
      currentPeriodDays: opts.currentPeriodDays || null,
      isProrated: false,
      prorationNote: 'Full billing period charge.',
    };
  }

  const amount = roundMoney((cycleAmount / periodLength) * remainingDays);
  const isProrated = remainingDays < periodLength;
  const end = toDateOnly(new Date(periodEnd));

  return {
    fullAmount: cycleAmount,
    amount,
    currency,
    label: full.label || addon?.name || '',
    billingLabel,
    billingCycle,
    monthlyListPrice,
    yearlyListPrice,
    cycleDays: periodLength,
    periodLength,
    remainingDays,
    periodEndsAt: end,
    currentPeriodDays: opts.currentPeriodDays || periodLength,
    isProrated,
    prorationNote: isProrated
      ? `Prorated for ${remainingDays} day${remainingDays === 1 ? '' : 's'} left in your current subscription (ends ${end.toLocaleDateString()}).`
      : 'Full billing period charge.',
  };
}

/** Rates block for API / UI — always includes real monthly list price. */
function buildRecurringRates(full, plan) {
  const billingCycle = full?.billingCycle || plan?.billingCycle || 'monthly';
  return {
    monthly: Number(full?.monthlyAmount) || 0,
    yearly: Number(full?.yearlyAmount) || 0,
    currency: full?.currency || 'LKR',
    billingCycle,
    cycleAmount: Number(full?.amount) || 0,
    cycleLabel: billingCycle === 'yearly' ? 'year' : 'month',
  };
}

function buildProrationPayload(prorated) {
  return {
    fullAmount: prorated.fullAmount,
    amount: prorated.amount,
    currency: prorated.currency,
    cycleDays: prorated.periodLength ?? prorated.cycleDays,
    periodLength: prorated.periodLength ?? prorated.cycleDays,
    remainingDays: prorated.remainingDays,
    periodEndsAt: prorated.periodEndsAt,
    isProrated: prorated.isProrated,
    billingCycle: prorated.billingCycle,
    monthlyListPrice: prorated.monthlyListPrice,
    yearlyListPrice: prorated.yearlyListPrice,
    note: prorated.prorationNote,
  };
}

module.exports = {
  roundMoney,
  resolveSubscriptionPeriodEnd,
  remainingDaysInCurrentPeriod,
  computeProratedAddonCharge,
  buildRecurringRates,
  buildProrationPayload,
};
