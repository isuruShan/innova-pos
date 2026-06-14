'use strict';

const express = require('express');
const Stripe = require('stripe');
const Tenant = require('../models/Tenant');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PaymentReceipt = require('../models/PaymentReceipt');
const Subscription = require('../models/Subscription');
const { sendRouteError } = require('@innovapos/shared-middleware');
const { loadPaymentSettings, stripeWebhookSecret } = require('../lib/platformPaymentConfig');
const { stripeSecret } = require('../lib/platformPaymentConfig');
const {
  activateSubscriptionForTenant,
  notifySubscriptionActivated,
} = require('../lib/subscriptionActivation');

const router = express.Router();

async function fulfillOnlinePayment({ tenantId, planId, paymentMethod, externalId, sessionId, amount, currency, excludeAddons = [] }) {
  const existing = await PaymentReceipt.findOne({
    $or: [
      ...(sessionId ? [{ stripeSessionId: sessionId }] : []),
      ...(externalId ? [{ externalPaymentId: externalId }] : []),
    ],
    status: 'verified',
  });
  if (existing) return { duplicate: true };

  const tenant = await Tenant.findById(tenantId);
  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
  if (!tenant || !plan) throw new Error('Tenant or plan not found');

  const pending = await PaymentReceipt.findOne({
    tenantId,
    stripeSessionId: sessionId || undefined,
    paypalOrderId: externalId || undefined,
    status: 'pending',
  });

  const finalExcludeAddons = excludeAddons && excludeAddons.length ? excludeAddons : (pending?.excludeAddons || []);

  const cycle = pending?.paymentBreakdown?.plan?.billingCycle || 'monthly';
  const planObj = plan.toObject ? plan.toObject() : plan;
  const planAmount = cycle === 'yearly' ? (planObj.yearlyPrice || 0) : (planObj.monthlyPrice || 0);
  const durationDays = cycle === 'yearly' ? 365 : 30;

  const decoratedPlan = {
    ...planObj,
    billingCycle: cycle,
    amount: planAmount,
    durationDays,
  };

  let receipt = pending;
  if (!receipt) {
    receipt = await PaymentReceipt.create({
      tenantId,
      paymentMethod,
      amount: amount ?? decoratedPlan.amount,
      currency: currency || decoratedPlan.currency || 'LKR',
      requestedPlanId: decoratedPlan._id,
      requestedPlanCode: decoratedPlan.code,
      expectedAmount: decoratedPlan.amount,
      amountMatchesExpected: true,
      bankReference: sessionId || externalId || `online-${Date.now()}`,
      bankName: paymentMethod === 'stripe' ? 'Stripe' : 'PayPal',
      paymentDate: new Date(),
      stripeSessionId: sessionId || '',
      paypalOrderId: paymentMethod === 'paypal' ? (externalId || '') : '',
      externalPaymentId: externalId || sessionId || '',
      status: 'verified',
      verifiedAt: new Date(),
      subscriptionExtended: true,
      extensionDays: decoratedPlan.durationDays,
      excludeAddons: finalExcludeAddons,
    });
  } else {
    receipt.status = 'verified';
    receipt.verifiedAt = new Date();
    receipt.subscriptionExtended = true;
    receipt.extensionDays = decoratedPlan.durationDays;
    if (finalExcludeAddons && finalExcludeAddons.length && (!receipt.excludeAddons || !receipt.excludeAddons.length)) {
      receipt.excludeAddons = finalExcludeAddons;
    }
    await receipt.save();
  }

  const { tenant: updated, subscription, newEnd, pendingMatch, convertedFromTrial } =
    await activateSubscriptionForTenant(tenantId, decoratedPlan, {
      paymentNote: `${paymentMethod} payment confirmed`,
      activatedBy: null,
      excludeAddons: finalExcludeAddons,
    });

  if (subscription?._id) {
    receipt.subscriptionId = subscription._id;
    receipt.subscriptionExtended = true;
    receipt.billingPeriodStart = subscription.startDate;
    receipt.billingPeriodEnd = subscription.endDate;
    await receipt.save();
  }

  await notifySubscriptionActivated(updated, newEnd, { pendingMatch, convertedFromTrial });
  return { receipt, newEnd };
}

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const doc = await loadPaymentSettings();
    const whSecret = stripeWebhookSecret(doc);
    const secret = stripeSecret(doc);
    if (!whSecret || !secret) {
      return res.status(503).json({ message: 'Stripe webhook not configured' });
    }

    const stripe = new Stripe(secret);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
    } catch (err) {
      return res.status(400).json({ message: `Webhook signature failed: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const tenantId = session.metadata?.tenantId;
      const planId = session.metadata?.planId;
      let excludeAddons = [];
      if (session.metadata?.excludeAddons) {
        try {
          excludeAddons = JSON.parse(session.metadata.excludeAddons);
        } catch (_) {}
      }
      if (tenantId && planId) {
        await fulfillOnlinePayment({
          tenantId,
          planId,
          paymentMethod: 'stripe',
          sessionId: session.id,
          externalId: session.payment_intent || session.id,
          amount: (session.amount_total || 0) / 100,
          currency: (session.currency || 'lkr').toUpperCase(),
          excludeAddons,
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = { router, fulfillOnlinePayment };
