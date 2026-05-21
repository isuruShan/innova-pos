'use strict';

const User = require('../models/User');
const { getRolePricing } = require('./userLicensePricing');
const { computeProratedAddonCharge } = require('./billingProration');
const {
  loadTenantForBilling,
  planBillingCycleDays,
  resolveCurrentSubscriptionPeriod,
  resolveNextBillingPlan,
} = require('./resolveBillingPlan');

const INCLUDED_USERS = 1;

async function countActiveUsers(tenantId) {
  return User.countDocuments({ tenantId, isActive: true });
}

function pseudoAddonFromPricing(pricing) {
  return {
    monthlyAmount: pricing.monthlyAmount,
    yearlyAmount: pricing.yearlyAmount,
    currency: pricing.currency,
    name: pricing.name,
    isActive: true,
  };
}

async function prorateRoleCharge(tenant, role, kind, quantity = 1) {
  const plan = await resolveNextBillingPlan(tenant);
  const { periodEnd, periodDays } = await resolveCurrentSubscriptionPeriod(tenant);
  const pricing = await getRolePricing(role, tenant.countryIso, kind);
  const pseudo = pseudoAddonFromPricing(pricing);
  const lines = [];
  let total = 0;
  for (let i = 0; i < quantity; i += 1) {
    const prorated = computeProratedAddonCharge(pseudo, plan, periodEnd, {
      billingCycleDays: planBillingCycleDays(plan),
      currentPeriodDays: periodDays,
      countryIso: tenant.countryIso,
    });
    total += Number(prorated.amount) || 0;
    lines.push(prorated);
  }
  return {
    plan,
    pricing,
    amount: Math.round(total * 100) / 100,
    currency: pricing.currency || 'LKR',
    label: quantity > 1 ? `${pricing.name} (×${quantity})` : pricing.name,
    lines,
    proration: lines[0] || null,
  };
}

/**
 * Quote for adding a new user (beyond the one included merchant admin).
 * For staff roles assigned to multiple stores, the extra store slot charges
 * are combined into a single total so the payment popup shows the full cost.
 *
 * @param {string} tenantId
 * @param {string} role
 * @param {string[]} [storeIds=[]]  — store IDs the new user will be assigned to
 */
async function quoteCreateUser(tenantId, role, storeIds = []) {
  const tenant = await loadTenantForBilling(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const active = await countActiveUsers(tenantId);
  const requiresPayment = active >= INCLUDED_USERS;

  if (!requiresPayment) {
    return {
      requiresPayment: false,
      reason: 'Your first user is included with your subscription.',
      activeUsers: active,
      priced: { amount: 0, currency: tenant.countryIso === 'LK' ? 'LKR' : 'USD' },
    };
  }

  // --- User seat charge ---
  const seatCharge = await prorateRoleCharge(tenant, role, 'userSeat', 1);

  // --- Extra store slots charge (staff only, 1 slot included per user) ---
  // merchant_admin always has access to all stores — no extra slot fee
  const isAdmin = role === 'merchant_admin';
  const storeCount = Array.isArray(storeIds) ? storeIds.length : 0;
  const extraSlots = isAdmin ? 0 : Math.max(0, storeCount - 1);
  const hasExtraStores = extraSlots > 0;

  let storeCharge = null;
  if (hasExtraStores) {
    storeCharge = await prorateRoleCharge(tenant, role, 'extraStore', extraSlots);
  }

  const totalAmount = Math.round(
    ((Number(seatCharge.amount) || 0) + (hasExtraStores ? Number(storeCharge.amount) || 0 : 0)) * 100,
  ) / 100;
  const currency = seatCharge.currency || 'LKR';
  const billingLabel =
    seatCharge.plan?.billingCycle === 'yearly'
      ? 'per year (your next billing cycle)'
      : 'per month (your next billing cycle)';

  // Build a human-readable combined label
  const labelParts = [seatCharge.label];
  if (hasExtraStores) labelParts.push(storeCharge.label);
  const combinedLabel = labelParts.join(' + ');

  return {
    requiresPayment: true,
    activeUsers: active,
    role,
    extraStoreSlots: extraSlots,
    priced: { amount: totalAmount, currency, label: combinedLabel },
    // Individual line items so the UI can show a breakdown
    lineItems: [
      { label: seatCharge.label, amount: seatCharge.amount, currency, proration: seatCharge.proration },
      ...(hasExtraStores
        ? [{ label: storeCharge.label, amount: storeCharge.amount, currency, proration: storeCharge.proration }]
        : []),
    ],
    proration: seatCharge.proration,
    billingLabel,
  };
}


/**
 * Quote for assigning more stores than the user is licensed for (staff only).
 */
async function quoteAssignStores(tenantId, userId, targetStoreIds) {
  const tenant = await loadTenantForBilling(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const user = await User.findOne({ _id: userId, tenantId, isActive: true });
  if (!user) throw new Error('User not found');

  if (user.role === 'merchant_admin') {
    return {
      requiresPayment: false,
      reason: 'Merchant admins can access all stores in your business.',
      licensedStoreSlots: user.licensedStoreSlots || 1,
      targetStoreCount: targetStoreIds.length,
    };
  }

  const licensed = Math.max(1, Number(user.licensedStoreSlots) || 1);
  const targetCount = Math.max(1, (targetStoreIds || []).length);
  const slotsToAdd = Math.max(0, targetCount - licensed);

  if (slotsToAdd <= 0) {
    return {
      requiresPayment: false,
      licensedStoreSlots: licensed,
      targetStoreCount: targetCount,
      priced: { amount: 0, currency: tenant.countryIso === 'LK' ? 'LKR' : 'USD' },
    };
  }

  const charge = await prorateRoleCharge(tenant, user.role, 'extraStore', slotsToAdd);
  return {
    requiresPayment: true,
    userId: String(user._id),
    role: user.role,
    licensedStoreSlots: licensed,
    targetStoreCount: targetCount,
    slotsToAdd,
    priced: { amount: charge.amount, currency: charge.currency, label: charge.label },
    proration: charge.proration,
    billingLabel:
      charge.plan?.billingCycle === 'yearly'
        ? 'per year (your next billing cycle)'
        : 'per month (your next billing cycle)',
  };
}

module.exports = {
  INCLUDED_USERS,
  countActiveUsers,
  quoteCreateUser,
  quoteAssignStores,
};
