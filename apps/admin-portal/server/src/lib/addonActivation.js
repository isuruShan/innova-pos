'use strict';

const Tenant = require('../models/Tenant');
const PaymentReceipt = require('../models/PaymentReceipt');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { tenantPlanAudience } = require('../utils/planAudience');
const { computeAddonPeriodEnd } = require('./addonPeriod');

/**
 * @param {string} tenantId
 * @param {string} addonCode
 * @param {{ amount: number, currency: string, paymentMethod: string, externalId?: string, paypalOrderId?: string, stripeSessionId?: string, createdBy?: string }} opts
 */
async function activatePaidAddonForTenant(tenantId, addonCode, opts) {
  const code = String(addonCode || '').trim().toLowerCase();
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  if (code === 'qr_ordering') {
    const audience = tenantPlanAudience(tenant.countryIso);
    let plan = null;
    if (tenant.assignedPlanId) {
      plan = await SubscriptionPlan.findOne({
        _id: tenant.assignedPlanId,
        isActive: true,
        planAudience: audience,
      }).lean();
    }
    const activatedAt = new Date();
    const periodEndsAt = computeAddonPeriodEnd(activatedAt, plan?.billingCycle || 'monthly');

    tenant.paidAddons = tenant.paidAddons || {};
    tenant.paidAddons.qrOrdering = {
      active: true,
      activatedAt,
      amountPerCycle: Number(opts.amount) || 0,
      currency: String(opts.currency || 'LKR').toUpperCase(),
      periodEndsAt,
      cancelAtPeriodEnd: false,
    };
    await tenant.save();
    return tenant;
  }

  throw new Error(`Unknown add-on code: ${code}`);
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

  await activatePaidAddonForTenant(tenantId, addonCode, {
    amount,
    currency,
    paymentMethod,
    externalId,
    paypalOrderId,
    stripeSessionId,
    createdBy,
  });

  return { receipt, duplicate: false };
}

module.exports = { activatePaidAddonForTenant, recordVerifiedAddonReceipt };
