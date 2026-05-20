'use strict';

const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { tenantPlanAudience } = require('../utils/planAudience');
const { resolveSubscriptionPeriodEnd } = require('./billingProration');

/** Calendar length of a plan's billing cycle (for per-day rates). */
function planBillingCycleDays(plan) {
  if (!plan) return 30;
  const d = Number(plan.durationDays);
  if (d > 0) return d;
  return plan.billingCycle === 'yearly' ? 365 : 30;
}

/**
 * Plan used for the next subscription payment and add-on list pricing.
 * Scheduled plan change (pendingPlanId) takes precedence over the current assigned plan.
 */
async function resolveNextBillingPlan(tenant) {
  if (!tenant) return null;
  const audience = tenantPlanAudience(tenant.countryIso);
  const regionFilter = { isActive: true, planAudience: audience };

  const pickId = tenant.pendingPlanId || tenant.assignedPlanId;
  if (!pickId) {
    return SubscriptionPlan.findOne({ isActive: true, isDefault: true, ...regionFilter })
      .sort({ createdAt: 1 })
      .lean();
  }

  if (typeof pickId === 'object' && pickId._id && pickId.isActive !== false) {
    return pickId;
  }

  return SubscriptionPlan.findOne({ _id: pickId, ...regionFilter }).lean();
}

/**
 * Active paid period boundaries (for proration numerator).
 */
async function resolveCurrentSubscriptionPeriod(tenant) {
  const periodEnd = await resolveSubscriptionPeriodEnd(tenant);
  if (!periodEnd) {
    return { periodEnd: null, periodStart: null, periodDays: null };
  }

  const latest = await Subscription.findOne({ tenantId: tenant._id || tenant })
    .sort({ endDate: -1 })
    .lean();

  let periodStart = null;
  let periodDays = null;
  if (latest?.startDate && latest?.endDate) {
    periodStart = new Date(latest.startDate);
    const end = new Date(latest.endDate);
    const fromRecord = Number(latest.durationDays) || 0;
    const fromDates = Math.max(
      1,
      Math.ceil((end.getTime() - periodStart.getTime()) / 86400000)
    );
    periodDays = fromRecord > 0 ? fromRecord : fromDates;
  }

  return { periodEnd, periodStart, periodDays };
}

async function loadTenantForBilling(tenantId) {
  return Tenant.findById(tenantId)
    .populate('assignedPlanId')
    .populate('pendingPlanId')
    .lean();
}

module.exports = {
  planBillingCycleDays,
  resolveNextBillingPlan,
  resolveCurrentSubscriptionPeriod,
  loadTenantForBilling,
};
