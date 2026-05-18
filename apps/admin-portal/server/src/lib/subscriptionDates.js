'use strict';

const Subscription = require('../models/Subscription');

async function getLatestSubscriptionEnd(tenantId) {
  const latest = await Subscription.findOne({ tenantId }).sort({ endDate: -1 }).select('endDate').lean();
  return latest?.endDate ? new Date(latest.endDate) : null;
}

function resolveTenantPeriodEnd(tenant, latestSubEnd) {
  if (!tenant) return null;
  if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt) {
    return new Date(tenant.trialEndsAt);
  }
  if (latestSubEnd) return new Date(latestSubEnd);
  if (tenant.trialEndsAt) return new Date(tenant.trialEndsAt);
  return null;
}

module.exports = {
  getLatestSubscriptionEnd,
  resolveTenantPeriodEnd,
};
