'use strict';

const Tenant = require('../models/Tenant');
require('../models/SubscriptionPlan');
const { isLoyaltyEffective } = require('@innovapos/paid-addons');

async function isLoyaltyAddonActiveForTenant(tenantId) {
  if (!tenantId) return false;
  const tenant = await Tenant.findById(tenantId)
    .select('paidAddons assignedPlanId')
    .populate('assignedPlanId')
    .lean();
  return isLoyaltyEffective(tenant);
}

module.exports = { isLoyaltyAddonActiveForTenant };
