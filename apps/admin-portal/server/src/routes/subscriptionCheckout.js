'use strict';

const express = require('express');
const Tenant = require('../models/Tenant');
const PaymentReceipt = require('../models/PaymentReceipt');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');
const { tenantPlanAudience } = require('../utils/planAudience');
const { loadPaymentSettings } = require('../lib/platformPaymentConfig');
const { createCheckoutSession } = require('../lib/payments/stripeCheckout');
const { createOrder, createAddonOrder, captureOrder } = require('../lib/payments/paypalCheckout');
const { fulfillOnlinePayment } = require('./subscriptionWebhooks');
const { priceAddonForPlan } = require('../lib/addonBilling');
const PaidAddonDefinition = require('../models/PaidAddonDefinition');

const router = express.Router();

// Shared plan resolver extracted inline to avoid circular deps
async function resolvePlanForTenant(tenant, planId) {
  const audience = tenantPlanAudience(tenant.countryIso);
  const SubscriptionPlan = require('../models/SubscriptionPlan');

  if (tenant.planLocked) {
    if (!tenant.assignedPlanId) return null;
    return SubscriptionPlan.findOne({ _id: tenant.assignedPlanId, isActive: true, planAudience: audience });
  }
  if (planId) {
    const selected = await SubscriptionPlan.findOne({ _id: planId, isActive: true, planAudience: audience });
    if (selected) return selected;
  }
  if (tenant.pendingPlanId) {
    return SubscriptionPlan.findOne({ _id: tenant.pendingPlanId, isActive: true, planAudience: audience });
  }
  if (tenant.assignedPlanId) {
    return SubscriptionPlan.findOne({ _id: tenant.assignedPlanId, isActive: true, planAudience: audience });
  }
  return SubscriptionPlan.findOne({ isActive: true, isDefault: true, planAudience: audience }).sort({ createdAt: 1 });
}

router.post('/stripe', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { planId } = req.body;
    const settings = await loadPaymentSettings();
    if (!settings.stripe?.enabled) {
      return res.status(400).json({ message: 'Stripe payments are not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const plan = await resolvePlanForTenant(tenant, planId);
    if (!plan) return res.status(400).json({ message: 'No valid plan selected' });

    const session = await createCheckoutSession({
      tenant,
      plan,
      userId: req.user.id,
    });

    await PaymentReceipt.create({
      tenantId: tenant._id,
      paymentMethod: 'stripe',
      amount: plan.amount,
      currency: plan.currency || 'LKR',
      requestedPlanId: plan._id,
      requestedPlanCode: plan.code,
      expectedAmount: plan.amount,
      amountMatchesExpected: true,
      bankReference: session.id,
      bankName: 'Stripe',
      paymentDate: new Date(),
      stripeSessionId: session.id,
      status: 'pending',
      createdBy: req.user.id,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/paypal/create-order', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { planId } = req.body;
    const settings = await loadPaymentSettings();
    if (!settings.paypal?.enabled) {
      return res.status(400).json({ message: 'PayPal is not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const plan = await resolvePlanForTenant(tenant, planId);
    if (!plan) return res.status(400).json({ message: 'No valid plan selected' });

    const { orderId } = await createOrder({ tenant, plan });

    await PaymentReceipt.create({
      tenantId: tenant._id,
      paymentMethod: 'paypal',
      amount: plan.amount,
      currency: plan.currency || 'LKR',
      requestedPlanId: plan._id,
      requestedPlanCode: plan.code,
      expectedAmount: plan.amount,
      amountMatchesExpected: true,
      bankReference: orderId,
      bankName: 'PayPal',
      paymentDate: new Date(),
      paypalOrderId: orderId,
      status: 'pending',
      createdBy: req.user.id,
    });

    res.json({ orderId });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/paypal/create-addon-order', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { addonCode } = req.body;
    const code = String(addonCode || '').trim().toLowerCase();
    if (!code) return res.status(400).json({ message: 'addonCode is required' });

    const settings = await loadPaymentSettings();
    if (!settings.paypal?.enabled) {
      return res.status(400).json({ message: 'PayPal is not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const addon = await PaidAddonDefinition.findOne({ code, isActive: true });
    if (!addon) return res.status(400).json({ message: 'Unknown or inactive add-on' });

    if (code === 'qr_ordering' && tenant.paidAddons?.qrOrdering?.active) {
      return res.status(400).json({ message: 'Guest QR ordering is already active for your account' });
    }

    const plan = await resolvePlanForTenant(tenant, null);
    if (!plan) return res.status(400).json({ message: 'No billing plan found for pricing' });

    const { amount, currency, label } = priceAddonForPlan(addon.toObject ? addon.toObject() : addon, plan.toObject ? plan.toObject() : plan);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Add-on price is not configured yet. Contact support.' });
    }

    const { orderId } = await createAddonOrder({
      tenant,
      addonCode: code,
      amount,
      currency,
      description: label || addon.name,
    });

    await PaymentReceipt.create({
      tenantId: tenant._id,
      receiptKind: 'addon',
      addonCode: code,
      paymentMethod: 'paypal',
      amount,
      currency: currency || 'LKR',
      requestedPlanId: null,
      requestedPlanCode: '',
      expectedAmount: amount,
      amountMatchesExpected: true,
      bankReference: orderId,
      bankName: 'PayPal',
      paymentDate: new Date(),
      paypalOrderId: orderId,
      status: 'pending',
      createdBy: req.user.id,
    });

    res.json({ orderId });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/paypal/capture', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    const receipt = await PaymentReceipt.findOne({
      tenantId: req.tenantId,
      paypalOrderId: orderId,
      status: 'pending',
    });
    if (!receipt) return res.status(404).json({ message: 'Pending PayPal payment not found' });

    if (receipt.receiptKind === 'addon') {
      const { recordVerifiedAddonReceipt } = require('../lib/addonActivation');
      const capture = await captureOrder(orderId);
      if (capture.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'PayPal payment was not completed' });
      }
      const unit = capture.purchase_units?.[0];
      const custom = unit?.payments?.captures?.[0]?.id || orderId;

      const r = await recordVerifiedAddonReceipt({
        tenantId: req.tenantId,
        addonCode: receipt.addonCode,
        amount: receipt.amount,
        currency: receipt.currency,
        paymentMethod: 'paypal',
        externalId: custom,
        paypalOrderId: orderId,
        createdBy: req.user.id,
      });
      if (r.duplicate) {
        return res.json({ message: 'Payment already applied', addon: true });
      }
      return res.json({
        message: 'Add-on payment captured',
        addon: true,
        addonCode: receipt.addonCode,
      });
    }

    const capture = await captureOrder(orderId);
    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'PayPal payment was not completed' });
    }

    const unit = capture.purchase_units?.[0];
    const custom = unit?.payments?.captures?.[0]?.id || orderId;

    const result = await fulfillOnlinePayment({
      tenantId: req.tenantId,
      planId: receipt.requestedPlanId,
      paymentMethod: 'paypal',
      externalId: custom,
      amount: receipt.amount,
      currency: receipt.currency,
    });

    res.json({
      message: 'Payment captured and subscription activated',
      subscriptionEndDate: result.newEnd,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
