'use strict';

const Tenant = require('../models/Tenant');
const PaymentReceipt = require('../models/PaymentReceipt');
const { computeAddonPeriodEnd } = require('./addonPeriod');
const { entitlementKeyForCode, emptyEntitlement } = require('@innovapos/paid-addons');
const { getAddonByCode, priceAddonForPlan } = require('./addonBilling');
const { resolveNextBillingPlan } = require('./resolveBillingPlan');
const { endTenantTrialOnPaidPurchase } = require('./subscriptionActivation');

/**
 * @param {string} tenantId
 * @param {string} addonCode
 * @param {{ amount: number, currency: string, paymentMethod: string, externalId?: string, paypalOrderId?: string, stripeSessionId?: string, createdBy?: string }} opts
 */
async function activatePaidAddonForTenant(tenantId, addonCode, opts) {
  const code = String(addonCode || '').trim().toLowerCase();
  const entitlementKey = entitlementKeyForCode(code);
  if (!entitlementKey) throw new Error(`Unknown add-on code: ${code}`);

  await endTenantTrialOnPaidPurchase(tenantId, { activatedBy: opts.createdBy || null });

  const tenant = await Tenant.findById(tenantId)
    .populate('assignedPlanId')
    .populate('pendingPlanId');
  if (!tenant) throw new Error('Tenant not found');

  const plan = await resolveNextBillingPlan(tenant);
  const addon = await getAddonByCode(code);
  const fullPriced =
    addon && plan
      ? priceAddonForPlan(addon, plan, tenant.countryIso)
      : { amount: 0, currency: tenant.countryIso === 'LK' ? 'LKR' : 'USD' };
  const amountPerCycle =
    opts.amountPerCycle != null ? Number(opts.amountPerCycle) : Number(fullPriced.amount) || 0;

  const activatedAt = new Date();
  const periodEndsAt = computeAddonPeriodEnd(activatedAt, plan?.billingCycle || 'monthly');

  tenant.paidAddons = tenant.paidAddons || {};
  tenant.paidAddons[entitlementKey] = {
    active: true,
    activatedAt,
    amountPerCycle,
    currency: String(opts.currency || 'LKR').toUpperCase(),
    periodEndsAt,
    cancelAtPeriodEnd: false,
    trialActivatedAt: null,
    trialEndsAt: null,
  };
  await tenant.save();
  return tenant;
}

/**
 * Record a verified online payment receipt for an add-on (PayPal / Stripe capture path).
 */
async function recordVerifiedAddonReceipt({
  tenantId,
  addonCode,
  amount,
  currency,
  paymentMethod,
  externalId,
  paypalOrderId,
  stripeSessionId,
  createdBy,
}) {
  const existing = await PaymentReceipt.findOne({
    $or: [
      ...(stripeSessionId ? [{ stripeSessionId }] : []),
      ...(externalId ? [{ externalPaymentId: externalId }] : []),
      ...(paypalOrderId ? [{ paypalOrderId }] : []),
    ],
    status: 'verified',
  });
  if (existing) return { duplicate: true, receipt: existing };

  let receipt = await PaymentReceipt.findOne({
    tenantId,
    receiptKind: 'addon',
    addonCode: String(addonCode).toLowerCase(),
    status: 'pending',
    ...(paypalOrderId ? { paypalOrderId } : {}),
    ...(stripeSessionId ? { stripeSessionId } : {}),
  });

  const now = new Date();
  if (!receipt) {
    receipt = await PaymentReceipt.create({
      tenantId,
      receiptKind: 'addon',
      addonCode: String(addonCode).toLowerCase(),
      paymentMethod,
      amount,
      currency: currency || 'LKR',
      requestedPlanId: null,
      requestedPlanCode: '',
      expectedAmount: amount,
      amountMatchesExpected: true,
      bankReference: stripeSessionId || paypalOrderId || externalId || `addon-${Date.now()}`,
      bankName: paymentMethod === 'stripe' ? 'Stripe' : 'PayPal',
      paymentDate: now,
      stripeSessionId: stripeSessionId || '',
      paypalOrderId: paypalOrderId || '',
      externalPaymentId: externalId || stripeSessionId || paypalOrderId || '',
      status: 'verified',
      verifiedAt: now,
      subscriptionExtended: false,
      createdBy: createdBy || null,
    });
  } else {
    receipt.status = 'verified';
    receipt.verifiedAt = now;
    receipt.amountMatchesExpected = true;
    await receipt.save();
  }

  const { getAddonPurchaseQuote } = require('./addonPurchaseQuote');
  const quote = await getAddonPurchaseQuote(tenantId, addonCode);

  await activatePaidAddonForTenant(tenantId, addonCode, {
    amount,
    currency,
    paymentMethod,
    externalId,
    paypalOrderId,
    stripeSessionId,
    createdBy,
    amountPerCycle: quote.fullCycle.amount,
  });

  return { receipt, duplicate: false };
}

/**
 * Record verified PayPal payment and create default store.
 */
async function recordVerifiedStoreReceipt({
  tenantId,
  amount,
  currency,
  paymentMethod,
  externalId,
  paypalOrderId,
  createdBy,
}) {
  const { createDefaultStoreForTenant } = require('./storePurchase');
  await endTenantTrialOnPaidPurchase(tenantId, { activatedBy: createdBy || null });
  const existing = await PaymentReceipt.findOne({
    $or: [
      ...(externalId ? [{ externalPaymentId: externalId }] : []),
      ...(paypalOrderId ? [{ paypalOrderId }] : []),
    ],
    status: 'verified',
    receiptKind: 'store',
  });
  if (existing) return { duplicate: true, receipt: existing, store: null };

  let receipt = await PaymentReceipt.findOne({
    tenantId,
    receiptKind: 'store',
    status: 'pending',
    ...(paypalOrderId ? { paypalOrderId } : {}),
  });

  const now = new Date();
  if (!receipt) {
    receipt = await PaymentReceipt.create({
      tenantId,
      receiptKind: 'store',
      paymentMethod,
      amount,
      currency: currency || 'LKR',
      requestedPlanId: null,
      requestedPlanCode: '',
      expectedAmount: amount,
      amountMatchesExpected: true,
      bankReference: paypalOrderId || externalId || `store-${Date.now()}`,
      bankName: paymentMethod === 'paypal' ? 'PayPal' : '',
      paymentDate: now,
      paypalOrderId: paypalOrderId || '',
      externalPaymentId: externalId || paypalOrderId || '',
      status: 'verified',
      verifiedAt: now,
      subscriptionExtended: false,
      createdBy: createdBy || null,
    });
  } else {
    receipt.status = 'verified';
    receipt.verifiedAt = now;
    await receipt.save();
  }

  const store = await createDefaultStoreForTenant(tenantId, createdBy);
  return { receipt, store, duplicate: false };
}

module.exports = {
  activatePaidAddonForTenant,
  recordVerifiedAddonReceipt,
  recordVerifiedStoreReceipt,
  emptyEntitlement,
};
