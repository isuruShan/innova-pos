'use strict';

const Subscription = require('../models/Subscription');
const { priceAddonForPlan } = require('./addonBilling');

/** Fixed days per month for all proration calculations. */
const PRORATION_DAYS_PER_MONTH = 30;

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
 * Monthly list price used for proration (falls back to yearly ÷ 12).
 */
function resolveMonthlyPrice(monthlyListPrice, yearlyListPrice) {
  const monthly = Number(monthlyListPrice) || 0;
  if (monthly > 0) return monthly;
  const yearly = Number(yearlyListPrice) || 0;
  if (yearly > 0) return roundMoney(yearly / 12);
  return 0;
}

/**
 * Prorate: (monthly amount ÷ 30) × remaining days in current subscription.
 *
 * @param {import('mongoose').LeanDocument<any>} addon
 * @param {import('mongoose').LeanDocument<any>|null} plan
 * @param {Date|string|null} periodEnd
 * @param {{ countryIso?: string }} [opts]
 */
function computeProratedAddonCharge(addon, plan, periodEnd, opts = {}) {
  const full = priceAddonForPlan(addon, plan, opts.countryIso);
  const currency = full.currency || 'LKR';
  const monthlyListPrice = resolveMonthlyPrice(full.monthlyAmount, full.yearlyAmount);
  const yearlyListPrice = Number(full.yearlyAmount) || monthlyListPrice * 12;
  const billingCycle = full.billingCycle || plan?.billingCycle || 'monthly';
  const cycleAmount = Number(full.amount) || 0;

  const billingLabel = 'per month on your subscription';

  const remainingDays = remainingDaysInCurrentPeriod(periodEnd);
  const end = periodEnd ? toDateOnly(new Date(periodEnd)) : null;

  if (monthlyListPrice <= 0) {
    return {
      fullAmount: cycleAmount,
      amount: cycleAmount,
      currency,
      label: full.label || addon?.name || '',
      billingLabel,
      billingCycle,
      monthlyListPrice: 0,
      yearlyListPrice,
      daysPerMonth: PRORATION_DAYS_PER_MONTH,
      cycleDays: PRORATION_DAYS_PER_MONTH,
      periodLength: PRORATION_DAYS_PER_MONTH,
      remainingDays: remainingDays || PRORATION_DAYS_PER_MONTH,
      periodEndsAt: end,
      isProrated: false,
      prorationNote: 'Price is not configured yet.',
    };
  }

  if (remainingDays == null || remainingDays <= 0) {
    return {
      fullAmount: monthlyListPrice,
      amount: monthlyListPrice,
      currency,
      label: full.label || addon?.name || '',
      billingLabel,
      billingCycle,
      monthlyListPrice,
      yearlyListPrice,
      daysPerMonth: PRORATION_DAYS_PER_MONTH,
      cycleDays: PRORATION_DAYS_PER_MONTH,
      periodLength: PRORATION_DAYS_PER_MONTH,
      remainingDays: PRORATION_DAYS_PER_MONTH,
      periodEndsAt: end,
      isProrated: false,
      prorationNote: 'Full monthly charge.',
    };
  }

  const amount = roundMoney((monthlyListPrice / PRORATION_DAYS_PER_MONTH) * remainingDays);
  const isProrated = remainingDays < PRORATION_DAYS_PER_MONTH;

  return {
    fullAmount: monthlyListPrice,
    amount,
    currency,
    label: full.label || addon?.name || '',
    billingLabel,
    billingCycle,
    monthlyListPrice,
    yearlyListPrice,
    daysPerMonth: PRORATION_DAYS_PER_MONTH,
    cycleDays: PRORATION_DAYS_PER_MONTH,
    periodLength: PRORATION_DAYS_PER_MONTH,
    remainingDays,
    periodEndsAt: end,
    isProrated,
    prorationNote: isProrated
      ? `Prorated: (${monthlyListPrice} ÷ ${PRORATION_DAYS_PER_MONTH}) × ${remainingDays} days left until ${end.toLocaleDateString()}.`
      : 'Full monthly charge.',
  };
}

/** Rates block for API / UI — always includes real monthly list price. */
function buildRecurringRates(full, plan) {
  const billingCycle = full?.billingCycle || plan?.billingCycle || 'monthly';
  const monthly = resolveMonthlyPrice(full?.monthlyAmount, full?.yearlyAmount);
  return {
    monthly,
    yearly: Number(full?.yearlyAmount) || monthly * 12,
    currency: full?.currency || 'LKR',
    billingCycle,
    cycleAmount: Number(full?.amount) || 0,
    cycleLabel: billingCycle === 'yearly' ? 'year' : 'month',
    daysPerMonth: PRORATION_DAYS_PER_MONTH,
  };
}

function buildProrationPayload(prorated) {
  return {
    fullAmount: prorated.monthlyListPrice ?? prorated.fullAmount,
    amount: prorated.amount,
    currency: prorated.currency,
    daysPerMonth: prorated.daysPerMonth ?? PRORATION_DAYS_PER_MONTH,
    cycleDays: prorated.daysPerMonth ?? PRORATION_DAYS_PER_MONTH,
    periodLength: prorated.daysPerMonth ?? PRORATION_DAYS_PER_MONTH,
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
  PRORATION_DAYS_PER_MONTH,
  roundMoney,
  resolveSubscriptionPeriodEnd,
  remainingDaysInCurrentPeriod,
  resolveMonthlyPrice,
  computeProratedAddonCharge,
  buildRecurringRates,
  buildProrationPayload,
};
