'use strict';

const express = require('express');
const Tenant = require('../models/Tenant');
const PaymentReceipt = require('../models/PaymentReceipt');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');
const { tenantPlanAudience } = require('../utils/planAudience');
const { isLocalMerchant } = require('../utils/merchantRegion');
const { loadPaymentSettings } = require('../lib/platformPaymentConfig');
const { createCheckoutSession } = require('../lib/payments/stripeCheckout');
const { createOrder, createAddonOrder, captureOrder } = require('../lib/payments/paypalCheckout');
const { fulfillOnlinePayment } = require('./subscriptionWebhooks');
const { getAddonPurchaseQuote } = require('../lib/addonPurchaseQuote');
const { getStoreCreateQuote } = require('../lib/storeCreateQuote');
const {
  buildCreateUserPayload,
  buildAssignStoresPayload,
  createPendingUserLicenseReceipt,
} = require('../lib/userLicenseCheckout');
const { processVerifiedUserLicenseReceipt } = require('../lib/userLicenseFulfill');
const { computeSubscriptionRenewalExpected } = require('../lib/addonBilling');
const PaidAddonDefinition = require('../models/PaidAddonDefinition');

const router = express.Router();

const { resolveNextBillingPlan } = require('../lib/resolveBillingPlan');
const SubscriptionPlan = require('../models/SubscriptionPlan');

async function resolvePlanForTenant(tenant, planId, billingCycle = 'monthly') {
  const audience = tenantPlanAudience(tenant.countryIso);

  if (tenant.planLocked) {
    if (!tenant.assignedPlanId) return null;
    const planDoc = await SubscriptionPlan.findOne({ _id: tenant.assignedPlanId, isActive: true, planAudience: audience }).lean();
    if (!planDoc) return null;
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? (planDoc.yearlyPrice || 0) : (planDoc.monthlyPrice || 0);
    const durationDays = cycle === 'yearly' ? 365 : 30;
    return {
      ...planDoc,
      billingCycle: cycle,
      amount,
      durationDays,
    };
  }

  const tempTenant = {
    ...(tenant.toObject ? tenant.toObject() : tenant),
    billingCycle
  };
  const nextBilling = await resolveNextBillingPlan(tempTenant);
  const nextId = nextBilling?._id ? String(nextBilling._id) : null;

  if (planId) {
    const selected = await SubscriptionPlan.findOne({ _id: planId, isActive: true, planAudience: audience }).lean();
    if (!selected) return null;
    if (nextId && String(selected._id) !== nextId) return null;
    
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? (selected.yearlyPrice || 0) : (selected.monthlyPrice || 0);
    const durationDays = cycle === 'yearly' ? 365 : 30;
    return {
      ...selected,
      billingCycle: cycle,
      amount,
      durationDays,
    };
  }

  return nextBilling;
}

router.post('/stripe', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;
    const settings = await loadPaymentSettings();
    if (!settings.stripe?.enabled) {
      return res.status(400).json({ message: 'Stripe payments are not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId)
      .populate('assignedPlanId')
      .populate('pendingPlanId');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    if (!isLocalMerchant(tenant.countryIso)) {
      return res.status(400).json({
        message: 'Card payments are not available for international merchants. Please use PayPal.',
        code: 'INTERNATIONAL_PAYPAL_ONLY',
      });
    }

    const plan = await resolvePlanForTenant(tenant, planId, billingCycle);
    if (!plan) return res.status(400).json({ message: 'No valid plan selected' });

    const renewal = await computeSubscriptionRenewalExpected(tenant, plan);
    const expectedAmount = renewal.total > 0 ? renewal.total : Number(plan.amount) || 0;

    const session = await createCheckoutSession({
      tenant,
      plan,
      userId: req.user.id,
      amount: expectedAmount,
    });

    const { getLatestSubscriptionEnd, resolveTenantPeriodEnd } = require('../lib/subscriptionDates');
    const latestSubEnd = await getLatestSubscriptionEnd(tenant._id);
    const billingPeriodStart = resolveTenantPeriodEnd(tenant, latestSubEnd) || new Date();
    const durationDays = Number(plan.durationDays) || 30;
    const billingPeriodEnd = new Date(billingPeriodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await PaymentReceipt.create({
      tenantId: tenant._id,
      paymentMethod: 'stripe',
      amount: expectedAmount,
      currency: plan.currency || 'LKR',
      requestedPlanId: plan._id,
      requestedPlanCode: plan.code,
      expectedAmount,
      amountMatchesExpected: true,
      bankReference: session.id,
      bankName: 'Stripe',
      paymentDate: new Date(),
      stripeSessionId: session.id,
      status: 'pending',
      paymentBreakdown: renewal,
      billingPeriodStart,
      billingPeriodEnd,
      createdBy: req.user.id,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/paypal/create-order', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;
    const settings = await loadPaymentSettings();
    if (!settings.paypal?.enabled) {
      return res.status(400).json({ message: 'PayPal is not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId)
      .populate('assignedPlanId')
      .populate('pendingPlanId');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const plan = await resolvePlanForTenant(tenant, planId, billingCycle);
    if (!plan) return res.status(400).json({ message: 'No valid plan selected' });

    const renewal = await computeSubscriptionRenewalExpected(tenant, plan);
    const expectedAmount = renewal.total > 0 ? renewal.total : Number(plan.amount) || 0;

    const { orderId } = await createOrder({ tenant, plan, amount: expectedAmount });

    const { getLatestSubscriptionEnd, resolveTenantPeriodEnd } = require('../lib/subscriptionDates');
    const latestSubEnd = await getLatestSubscriptionEnd(tenant._id);
    const billingPeriodStart = resolveTenantPeriodEnd(tenant, latestSubEnd) || new Date();
    const durationDays = Number(plan.durationDays) || 30;
    const billingPeriodEnd = new Date(billingPeriodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await PaymentReceipt.create({
      tenantId: tenant._id,
      paymentMethod: 'paypal',
      amount: expectedAmount,
      currency: plan.currency || 'LKR',
      requestedPlanId: plan._id,
      requestedPlanCode: plan.code,
      expectedAmount,
      amountMatchesExpected: true,
      bankReference: orderId,
      bankName: 'PayPal',
      paymentDate: new Date(),
      paypalOrderId: orderId,
      status: 'pending',
      paymentBreakdown: renewal,
      billingPeriodStart,
      billingPeriodEnd,
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

    const { getAddonMerchantState } = require('../lib/addonMerchantState');
    const addonState = await getAddonMerchantState(tenant, code);
    if (addonState.alreadyActive) {
      return res.status(400).json({ message: 'This add-on is already active for your account' });
    }
    if (addonState.pendingVerification) {
      return res.status(400).json({ message: 'A payment for this add-on is already pending verification' });
    }

    const quote = await getAddonPurchaseQuote(req.tenantId, code);
    const { amount, currency, label } = quote.priced;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Add-on price is not configured yet. Contact support.' });
    }

    const { orderId } = await createAddonOrder({
      tenant,
      addonCode: code,
      amount,
      currency,
      description: `${label || addon.name}${quote.proration?.isProrated ? ' (prorated)' : ''}`,
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
      paymentBreakdown: quote,
      createdBy: req.user.id,
    });

    res.json({ orderId, proration: quote.proration });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/paypal/create-user-license-order', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { action } = req.body;
    const actionNorm = String(action || '').trim().toLowerCase();
    if (!['create_user', 'assign_stores'].includes(actionNorm)) {
      return res.status(400).json({ message: 'action must be create_user or assign_stores' });
    }

    const settings = await loadPaymentSettings();
    if (!settings.paypal?.enabled) {
      return res.status(400).json({ message: 'PayPal is not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const built =
      actionNorm === 'create_user'
        ? await buildCreateUserPayload(req.tenantId, req.body, req.user.id)
        : await buildAssignStoresPayload(req.tenantId, req.body, req.user.id);

    const { quote, payload } = built;
    const amount = quote.priced?.amount;
    const currency = quote.priced?.currency || 'LKR';
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'User license price is not configured yet. Contact support.' });
    }

    const desc =
      actionNorm === 'create_user'
        ? `User seat: ${payload.name} (${payload.role})`
        : `Extra store access (${quote.slotsToAdd || 1} slot${quote.slotsToAdd > 1 ? 's' : ''})`;

    const { orderId } = await createAddonOrder({
      tenant,
      addonCode: 'user_license',
      amount,
      currency,
      description: `${desc}${quote.proration?.isProrated ? ' (prorated)' : ''}`,
    });

    await createPendingUserLicenseReceipt({
      tenantId: tenant._id,
      action: actionNorm,
      payload,
      amount,
      currency,
      paymentMethod: 'paypal',
      paypalOrderId: orderId,
      paymentBreakdown: quote,
      createdBy: req.user.id,
    });

    res.json({ orderId, proration: quote.proration, priced: quote.priced });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/paypal/create-store-order', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const settings = await loadPaymentSettings();
    if (!settings.paypal?.enabled) {
      return res.status(400).json({ message: 'PayPal is not enabled' });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const quote = await getStoreCreateQuote(req.tenantId);
    if (quote.error) return res.status(400).json({ message: quote.error });
    if (!quote.requiresPayment) {
      return res.status(400).json({ message: 'No payment required for your first store. Use create included.' });
    }

    const amount = quote.priced?.amount;
    const currency = quote.priced?.currency || 'LKR';
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Store price is not configured yet. Contact support.' });
    }

    const { orderId } = await createAddonOrder({
      tenant,
      addonCode: 'additional_store',
      amount,
      currency,
      description: quote.name || 'Additional store location',
    });

    await PaymentReceipt.create({
      tenantId: tenant._id,
      receiptKind: 'store',
      paymentMethod: 'paypal',
      amount,
      currency,
      requestedPlanId: null,
      requestedPlanCode: '',
      expectedAmount: amount,
      amountMatchesExpected: true,
      bankReference: orderId,
      bankName: 'PayPal',
      paymentDate: new Date(),
      paypalOrderId: orderId,
      status: 'pending',
      paymentBreakdown: quote,
      createdBy: req.user.id,
    });

    res.json({ orderId, proration: quote.proration });
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

    if (receipt.receiptKind === 'user_license') {
      const capture = await captureOrder(orderId);
      if (capture.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'PayPal payment was not completed' });
      }
      const unit = capture.purchase_units?.[0];
      const custom = unit?.payments?.captures?.[0]?.id || orderId;

      if (receipt.status === 'verified') {
        return res.json({ message: 'Payment already applied', userLicense: true });
      }

      receipt.status = 'verified';
      receipt.bankReference = custom;
      receipt.verifiedAt = new Date();
      receipt.updatedBy = req.user.id;
      await receipt.save();

      const result = await processVerifiedUserLicenseReceipt(receipt, req);
      return res.json({
        message:
          receipt.userLicenseAction === 'create_user'
            ? 'User created'
            : 'Store access updated',
        userLicense: true,
        action: receipt.userLicenseAction,
        user: result.user,
      });
    }

    if (receipt.receiptKind === 'store') {
      const { recordVerifiedStoreReceipt } = require('../lib/addonActivation');
      const capture = await captureOrder(orderId);
      if (capture.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'PayPal payment was not completed' });
      }
      const unit = capture.purchase_units?.[0];
      const custom = unit?.payments?.captures?.[0]?.id || orderId;

      const r = await recordVerifiedStoreReceipt({
        tenantId: req.tenantId,
        amount: receipt.amount,
        currency: receipt.currency,
        paymentMethod: 'paypal',
        externalId: custom,
        paypalOrderId: orderId,
        createdBy: req.user.id,
      });
      if (r.duplicate) {
        return res.json({
          message: 'Payment already applied',
          store: r.store || null,
          storeId: r.store?._id,
          storeCode: r.store?.code,
        });
      }
      return res.json({
        message: 'Store created',
        store: r.store,
        storeId: r.store?._id,
        storeCode: r.store?.code,
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
