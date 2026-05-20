'use strict';

const Tenant = require('../models/Tenant');
const { isLoyaltyEffective } = require('@innovapos/paid-addons');

async function isLoyaltyAddonActiveForTenant(tenantId) {
  if (!tenantId) return false;
  const tenant = await Tenant.findById(tenantId).select('paidAddons').lean();
  return isLoyaltyEffective(tenant?.paidAddons);
}

module.exports = { isLoyaltyAddonActiveForTenant };
