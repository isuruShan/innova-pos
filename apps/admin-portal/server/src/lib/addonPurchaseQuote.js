'use strict';

const { getAddonByCode, priceAddonForPlan } = require('./addonBilling');
const Subscription = require('../models/Subscription');
const PaymentReceipt = require('../models/PaymentReceipt');
const {
  computeProratedAddonCharge,
  buildRecurringRates,
  buildProrationPayload,
} = require('./billingProration');
const { applyPaidAddonExpiryIfNeeded } = require('./addonPeriod');
const {
  loadTenantForBilling,
  resolveCurrentSubscriptionPeriod,
  resolveNextBillingPlan,
} = require('./resolveBillingPlan');

/**
 * First-payment quote for an add-on (prorated to remaining days in current subscription).
 */
async function getAddonPurchaseQuote(tenantId, code) {
  let tenant = await loadTenantForBilling(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  tenant = await applyPaidAddonExpiryIfNeeded(tenant);

  const addon = await getAddonByCode(code);
  if (!addon || !addon.isActive) throw new Error('Add-on not available');

  const plan = await resolveNextBillingPlan(tenant);
  const { periodEnd } = await resolveCurrentSubscriptionPeriod(tenant);
  const full = priceAddonForPlan(addon, plan, tenant.countryIso);
  const prorated = computeProratedAddonCharge(addon, plan, periodEnd, {
    countryIso: tenant.countryIso,
  });

  // Calculate future prepaid or pending renewal cycles
  let futureCyclesCount = 0;
  if (periodEnd) {
    const futureSubscriptions = await Subscription.find({
      tenantId: tenant._id,
      startDate: { $gte: periodEnd }
    }).lean();

    const pendingReceipts = await PaymentReceipt.find({
      tenantId: tenant._id,
      status: 'pending',
      receiptKind: 'subscription',
      billingPeriodStart: { $gte: periodEnd }
    }).lean();

    futureCyclesCount = futureSubscriptions.length + pendingReceipts.length;
  }

  const extraCharge = full.amount * futureCyclesCount;
  const totalAmount = prorated.amount + extraCharge;

  let label = prorated.label || addon?.name || '';
  let prorationNote = prorated.prorationNote;
  if (futureCyclesCount > 0) {
    const cycleLabel = futureCyclesCount === 1 ? '1 next pre-paid cycle' : `${futureCyclesCount} next pre-paid cycles`;
    prorationNote = `${prorationNote || ''} Includes full cycle charge of ${full.currency} ${extraCharge.toLocaleString()} for ${cycleLabel}.`;
    label = `${label} (+ ${cycleLabel})`;
  }

  return {
    addon,
    plan,
    billingLabel: prorated.billingLabel,
    recurringRates: buildRecurringRates(full, plan),
    priced: {
      amount: totalAmount,
      currency: prorated.currency,
      label: label,
    },
    fullCycle: {
      amount: full.amount,
      currency: full.currency,
      label: full.label,
      monthlyAmount: full.monthlyAmount,
      yearlyAmount: full.yearlyAmount,
      billingCycle: full.billingCycle,
    },
    proration: {
      ...buildProrationPayload(prorated),
      amount: totalAmount,
      note: prorationNote,
    },
  };
}

module.exports = { getAddonPurchaseQuote, resolveNextBillingPlan };
