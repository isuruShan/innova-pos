const express = require('express');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const PaymentReceipt = require('../models/PaymentReceipt');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const { authenticateJWT, authorize, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { sendEmail } = require('../utils/mailer');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { tenantPlanAudience } = require('../utils/planAudience');
const { presignObjectKey } = require('../utils/s3Runtime');
const { notifySuperAdmins, notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { notifySubscriptionEvent } = require('../lib/subscriptionNotify');
const { resolveTenantPeriodEnd } = require('../lib/subscriptionDates');
const { parsePageQuery, paginated } = require('../lib/listPagination');
const {
  computeSubscriptionRenewalExpected,
  getAddonByCode,
} = require('../lib/addonBilling');
const { getAddonPurchaseQuote } = require('../lib/addonPurchaseQuote');
const { getStoreCreateQuote } = require('../lib/storeCreateQuote');
const { createDefaultStoreForTenant } = require('../lib/storePurchase');
const { notifyPaymentSubmitted, notifyPaymentVerified } = require('../lib/paymentNotify');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Only PDF or images allowed'));
  },
});

const amountsEqual = (a, b) => Number(a).toFixed(2) === Number(b).toFixed(2);

async function attachFreshReceiptUrls(receipts) {
  if (!receipts?.length) return receipts;
  const keys = [...new Set(receipts.map((r) => r.receiptFileKey).filter(Boolean))];
  if (!keys.length) return receipts;
  const pairs = await Promise.all(keys.map(async (key) => [key, await presignObjectKey(key, 86400)]));
  const urls = Object.fromEntries(pairs.filter(([, url]) => Boolean(url)));
  return receipts.map((r) => (r.receiptFileKey && urls[r.receiptFileKey]
    ? { ...r, receiptFileUrl: urls[r.receiptFileKey] }
    : r));
}

async function resolveRequestedPlan({ tenant, planId }) {
  const { resolveNextBillingPlan } = require('../lib/resolveBillingPlan');
  const audience = tenantPlanAudience(tenant.countryIso);
  const regionFilter = { planAudience: audience };

  // Locked tenants must pay assigned plan only.
  if (tenant.planLocked) {
    if (!tenant.assignedPlanId) return null;
    const assigned = await SubscriptionPlan.findOne({ _id: tenant.assignedPlanId, isActive: true, ...regionFilter });
    return assigned || null;
  }

  const nextBilling = await resolveNextBillingPlan(tenant);
  const nextId = nextBilling?._id ? String(nextBilling._id) : null;

  if (planId) {
    const selected = await SubscriptionPlan.findOne({ _id: planId, isActive: true, ...regionFilter });
    if (selected) {
      if (nextId && String(selected._id) !== nextId) {
        return null;
      }
      return selected;
    }
  }

  if (nextBilling) return nextBilling;

  const latestReceipt = await PaymentReceipt.findOne({
    tenantId: tenant._id,
    requestedPlanId: { $ne: null },
  }).sort({ createdAt: -1 });
  if (latestReceipt?.requestedPlanId) {
    const previous = await SubscriptionPlan.findOne({ _id: latestReceipt.requestedPlanId, isActive: true, ...regionFilter });
    if (previous) return previous;
  }

  if (tenant.assignedPlanId) {
    const assigned = await SubscriptionPlan.findOne({ _id: tenant.assignedPlanId, isActive: true, ...regionFilter });
    if (assigned) return assigned;
  }

  return SubscriptionPlan.findOne({ isActive: true, isDefault: true, ...regionFilter }).sort({ createdAt: 1 });
}

// GET /subscriptions — list payment receipts
router.get('/receipts', authenticateJWT, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || undefined) : req.tenantId;
    const filter = tenantId ? { tenantId } : {};
    if (req.query.status) filter.status = req.query.status;

    const search = String(req.query.search || req.query.q || '').trim();
    if (search && req.user.role === 'superadmin') {
      const Tenant = require('../models/Tenant');
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const tenants = await Tenant.find({ businessName: re }).select('_id').lean();
      const ids = tenants.map((t) => t._id);
      if (!ids.length) {
        const { page, limit } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
        return res.json(paginated([], 0, page, limit));
      }
      filter.tenantId = { $in: ids };
    }

    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
    const total = await PaymentReceipt.countDocuments(filter);
    let receipts = await PaymentReceipt.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('tenantId', 'businessName slug')
      .populate('verifiedBy', 'name')
      .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
      .lean();
    receipts = await attachFreshReceiptUrls(receipts);
    res.json(paginated(receipts, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/receipts/:id — superadmin payment detail
router.get('/receipts/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const PaidAddonDefinition = require('../models/PaidAddonDefinition');
    let receipt = await PaymentReceipt.findById(req.params.id)
      .populate('tenantId', 'businessName slug subscriptionStatus trialEndsAt countryIso')
      .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
      .populate('verifiedBy', 'name email')
      .populate('createdBy', 'name email')
      .lean();
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });

    [receipt] = await attachFreshReceiptUrls([receipt]);

    const tenant = receipt.tenantId;
    let billingBreakdown = null;
    let addonMeta = null;
    let storeMeta = null;

    if (receipt.receiptKind === 'subscription' || (!receipt.receiptKind && !receipt.addonCode)) {
      billingBreakdown = await computeSubscriptionRenewalExpected(tenant);
    }
    if (receipt.receiptKind === 'addon' || receipt.addonCode) {
      const addon = await PaidAddonDefinition.findOne({ code: receipt.addonCode }).lean();
      addonMeta = addon
        ? { code: addon.code, name: addon.name, shortDescription: addon.shortDescription }
        : { code: receipt.addonCode, name: receipt.addonCode };
    }
    if (receipt.receiptKind === 'store') {
      storeMeta = { label: 'Additional store location', description: 'Creates one store with default settings after verification.' };
    }

    res.json({
      receipt,
      billingBreakdown,
      addonMeta,
      storeMeta,
      receiptKindLabel:
        receipt.receiptKind === 'store'
          ? 'Additional store'
          : receipt.receiptKind === 'addon' || receipt.addonCode
            ? 'Paid add-on'
            : 'Subscription renewal',
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /subscriptions/receipts — merchant uploads a payment receipt
router.post('/receipts', authenticateJWT, authorize('merchant_admin'), upload.single('receipt'), async (req, res) => {
  try {
    const {
      amount,
      bankReference,
      notes,
      planId,
      addonCode,
      purchaseKind,
      paymentMethod = 'bank_transfer',
    } = req.body;
    const method = ['bank_transfer', 'stripe', 'paypal'].includes(paymentMethod)
      ? paymentMethod
      : 'bank_transfer';
    if (method === 'bank_transfer' && (!amount || !bankReference)) {
      return res.status(400).json({ message: 'amount and bankReference are required for bank transfer' });
    }
    if (method === 'bank_transfer' && !req.file) {
      return res.status(400).json({ message: 'Receipt file is required for bank transfer' });
    }
    if (method !== 'bank_transfer') {
      return res.status(400).json({
        message: 'Use the online checkout option for card or PayPal payments.',
        code: 'USE_ONLINE_CHECKOUT',
      });
    }
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    const tenant = await Tenant.findById(req.tenantId).select(
      'businessName assignedPlanId planLocked countryIso paidAddons',
    );
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const { isLocalMerchant } = require('../utils/merchantRegion');
    if (!isLocalMerchant(tenant.countryIso)) {
      return res.status(400).json({
        message: 'International merchants must pay with PayPal. Bank transfer is not available for your region.',
        code: 'INTERNATIONAL_PAYPAL_ONLY',
      });
    }

    const purchaseKindNorm = String(purchaseKind || '').trim().toLowerCase();
    const addonCodeNorm = String(addonCode || '').trim().toLowerCase();

    const uploadReceiptFile = async () => {
      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: req.file.originalname || 'receipt',
        contentType: req.file.mimetype,
      });
      form.append('type', 'receipt');
      const token = req.headers.authorization;
      const uploadRes = await axios.post(
        `${process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002'}/upload`,
        form,
        {
          headers: { ...form.getHeaders(), Authorization: token },
          timeout: require('@innovapos/shared-middleware').resolveUploadProxyTimeoutMs(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );
      return uploadRes.data.key || '';
    };

    if (purchaseKindNorm === 'store') {
      const quote = await getStoreCreateQuote(req.tenantId);
      if (quote.error) return res.status(400).json({ message: quote.error });
      if (!quote.requiresPayment) {
        return res.status(400).json({ message: 'No payment required. Create your first store without payment.' });
      }
      const expected = Number(quote.priced?.amount) || 0;
      if (!amountsEqual(amountValue, expected)) {
        return res.status(400).json({
          message: `Amount must exactly match the store charge (${quote.priced.currency} ${Number(expected).toLocaleString()}).`,
        });
      }
      let receiptFileKey = '';
      try {
        receiptFileKey = await uploadReceiptFile();
      } catch (_) {
        return res.status(500).json({ message: 'Failed to upload receipt file' });
      }
      if (!receiptFileKey) {
        return res.status(500).json({ message: 'Failed to upload receipt file' });
      }

      const receipt = await PaymentReceipt.create({
        tenantId: req.tenantId,
        receiptKind: 'store',
        paymentMethod: method,
        amount: amountValue,
        currency: quote.priced.currency || 'LKR',
        requestedPlanId: null,
        requestedPlanCode: '',
        expectedAmount: expected,
        amountMatchesExpected: true,
        bankReference: bankReference.trim(),
        bankName: '',
        paymentDate: new Date(),
        receiptFileUrl: '',
        receiptFileKey,
        notes: (notes || '').trim(),
        createdBy: req.user.id,
      });

      await notifyPaymentSubmitted(receipt, tenant);

      return res.status(201).json(receipt);
    }

    if (addonCodeNorm) {
      const addon = await getAddonByCode(addonCodeNorm);
      if (!addon || !addon.isActive) {
        return res.status(400).json({ message: 'Unknown or inactive add-on' });
      }
      const { getAddonMerchantState } = require('../lib/addonMerchantState');
      const addonState = await getAddonMerchantState(tenant, addonCodeNorm);
      if (addonState.alreadyActive) {
        return res.status(400).json({ message: 'This add-on is already active for your account' });
      }
      if (addonState.pendingVerification) {
        return res.status(400).json({ message: 'A payment for this add-on is already pending verification' });
      }
      const quote = await getAddonPurchaseQuote(req.tenantId, addonCodeNorm);
      const priced = quote.priced;
      if (!priced.amount || priced.amount <= 0) {
        return res.status(400).json({ message: 'Add-on price is not configured yet. Contact support.' });
      }
      if (!amountsEqual(amountValue, priced.amount)) {
        return res.status(400).json({
          message: `Amount must exactly match the add-on charge (${priced.currency} ${Number(priced.amount).toLocaleString()}).`,
        });
      }

      let receiptFileKey = '';
      try {
        receiptFileKey = await uploadReceiptFile();
      } catch (_) {
        return res.status(500).json({ message: 'Failed to upload receipt file' });
      }
      if (!receiptFileKey) {
        return res.status(500).json({ message: 'Failed to upload receipt file' });
      }

      const pricePlan = quote.plan || (await resolveRequestedPlan({ tenant, planId }));

      const receipt = await PaymentReceipt.create({
        tenantId: req.tenantId,
        receiptKind: 'addon',
        addonCode: addonCodeNorm,
        paymentMethod: method,
        amount: amountValue,
        currency: priced.currency || 'LKR',
        requestedPlanId: pricePlan?._id || null,
        requestedPlanCode: pricePlan?.code || '',
        expectedAmount: priced.amount,
        amountMatchesExpected: true,
        bankReference: bankReference.trim(),
        bankName: '',
        paymentDate: new Date(),
        receiptFileUrl: '',
        receiptFileKey,
        notes: (notes || '').trim(),
        createdBy: req.user.id,
      });

      await notifyPaymentSubmitted(receipt, tenant);

      return res.status(201).json(receipt);
    }

    const requestedPlan = await resolveRequestedPlan({ tenant, planId });
    if (!requestedPlan) {
      return res.status(400).json({
        message: planId
          ? 'Selected plan does not match your next billing period. Refresh the page and use the plan shown for your upcoming renewal.'
          : 'No active plan is assigned. Please contact support.',
      });
    }

    const renewal = await computeSubscriptionRenewalExpected(tenant);
    const expectedTotal = renewal.total > 0 ? renewal.total : Number(requestedPlan.amount) || 0;
    if (!amountsEqual(amountValue, expectedTotal)) {
      return res.status(400).json({
        message: `Amount must exactly match the expected renewal total (${requestedPlan.currency} ${Number(expectedTotal).toLocaleString()}) including any active paid add-ons.`,
      });
    }

    let receiptFileKey = '';
    try {
      receiptFileKey = await uploadReceiptFile();
    } catch (_) {
      return res.status(500).json({ message: 'Failed to upload receipt file' });
    }
    if (!receiptFileKey) {
      return res.status(500).json({ message: 'Failed to upload receipt file' });
    }

    const receipt = await PaymentReceipt.create({
      tenantId: req.tenantId,
      receiptKind: 'subscription',
      addonCode: '',
      paymentMethod: method,
      amount: amountValue,
      currency: requestedPlan.currency || 'LKR',
      requestedPlanId: requestedPlan._id,
      requestedPlanCode: requestedPlan.code,
      expectedAmount: expectedTotal,
      amountMatchesExpected: true,
      bankReference: bankReference.trim(),
      bankName: '',
      paymentDate: new Date(),
      receiptFileUrl: '',
      receiptFileKey,
      notes: (notes || '').trim(),
      createdBy: req.user.id,
    });

    await notifyPaymentSubmitted(receipt, tenant);

    res.status(201).json(receipt);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT /subscriptions/receipts/:id/verify — superadmin verifies receipt and extends subscription
router.put('/receipts/:id/verify', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { action, rejectionReason } = req.body;

    if (!['verify', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be verify or reject' });
    }

    const receipt = await PaymentReceipt.findById(req.params.id).populate('tenantId');
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    if (receipt.status !== 'pending') {
      return res.status(400).json({ message: 'Receipt already processed' });
    }

    if (action === 'reject') {
      if (!rejectionReason?.trim()) return res.status(400).json({ message: 'Rejection reason required' });
      receipt.status = 'rejected';
      receipt.rejectionReason = rejectionReason;
      receipt.verifiedBy = req.user.id;
      receipt.verifiedAt = new Date();
      receipt.updatedBy = req.user.id;
      await receipt.save();

      const tenantId = receipt.tenantId?._id || receipt.tenantId;
      await notifySubscriptionEvent(tenantId, {
        type: 'payment_receipt_rejected',
        title: 'Payment not accepted',
        body: `Your payment receipt was rejected: ${rejectionReason}`,
        meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
        merchantEmail: {
          subject: 'Payment receipt not accepted — Cafinity',
          html: `<p>Hi,</p><p>Your payment receipt was not accepted.</p><p><strong>Reason:</strong> ${rejectionReason}</p><p>Please submit a new receipt from the Subscription page.</p>`,
        },
        superEmail: {
          subject: 'Payment receipt rejected',
          html: `<p>A payment receipt was rejected for merchant ID ${tenantId}.</p>`,
        },
      }).catch(() => {});

      return res.json({ message: 'Receipt rejected', receipt });
    }

    if (!receipt.amountMatchesExpected) {
      return res.status(400).json({ message: 'Receipt amount does not match expected amount' });
    }

    if (receipt.receiptKind === 'store') {
      const tenantId = receipt.tenantId?._id || receipt.tenantId;
      const store = await createDefaultStoreForTenant(tenantId, req.user.id);
      const now = new Date();
      receipt.status = 'verified';
      receipt.verifiedBy = req.user.id;
      receipt.verifiedAt = now;
      receipt.subscriptionExtended = false;
      receipt.updatedBy = req.user.id;
      await receipt.save();

      await emitAudit({
        req,
        action: 'STORE_PAYMENT_VERIFIED',
        resource: 'PaymentReceipt',
        resourceId: receipt._id,
        changes: { after: { storeId: store._id, storeCode: store.code } },
      });

      try {
        await notifyMerchantAdmins(tenantId, {
          type: 'subscription_approved',
          title: 'Store created',
          body: `Your additional store (${store.code}) is ready. Open Stores to edit name and settings.`,
          meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
        }).catch(() => {});
      } catch (_) {}

      const tenantDoc = await Tenant.findById(tenantId).lean();
      await notifyPaymentVerified(receipt.toObject ? receipt.toObject() : receipt, tenantDoc);

      return res.json({ message: 'Store created', receipt, store });
    }

    if (receipt.receiptKind === 'addon') {
      const { activatePaidAddonForTenant } = require('../lib/addonActivation');
      const { getAddonPurchaseQuote } = require('../lib/addonPurchaseQuote');
      const tenantId = receipt.tenantId?._id || receipt.tenantId;
      const quote = await getAddonPurchaseQuote(tenantId, receipt.addonCode);
      await activatePaidAddonForTenant(tenantId, receipt.addonCode, {
        amount: receipt.amount,
        currency: receipt.currency,
        paymentMethod: receipt.paymentMethod,
        amountPerCycle: quote.fullCycle.amount,
      });
      const now = new Date();
      receipt.status = 'verified';
      receipt.verifiedBy = req.user.id;
      receipt.verifiedAt = now;
      receipt.subscriptionExtended = false;
      receipt.updatedBy = req.user.id;
      await receipt.save();

      await emitAudit({
        req,
        action: 'ADDON_PAYMENT_VERIFIED',
        resource: 'PaymentReceipt',
        resourceId: receipt._id,
        changes: { after: { addonCode: receipt.addonCode } },
      });

      try {
        await notifyMerchantAdmins(tenantId, {
          type: 'subscription_approved',
          title: 'Add-on activated',
          body: `Your paid add-on "${receipt.addonCode}" is now active.`,
          meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
        }).catch(() => {});
      } catch (_) {}

      const tenantDoc = await Tenant.findById(tenantId).lean();
      await notifyPaymentVerified(receipt.toObject ? receipt.toObject() : receipt, tenantDoc);

      return res.json({ message: 'Add-on activated', receipt });
    }

    const plan = receipt.requestedPlanId
      ? await SubscriptionPlan.findOne({ _id: receipt.requestedPlanId, isActive: true })
      : null;
    if (!plan) {
      return res.status(400).json({ message: 'Cannot verify receipt: requested plan no longer active' });
    }
    const extensionDays = plan.durationDays;

    // Extend subscription
    const tenant = await require('../models/Tenant').findById(receipt.tenantId._id || receipt.tenantId);
    const now = new Date();

    // Find current end date (trial end or last subscription end)
    let currentEnd = tenant.trialEndsAt || now;
    const latestSub = await Subscription.findOne({ tenantId: tenant._id }).sort({ endDate: -1 });
    if (latestSub && latestSub.endDate > currentEnd) currentEnd = latestSub.endDate;

    const newEnd = new Date(Math.max(currentEnd.getTime(), now.getTime()));
    newEnd.setDate(newEnd.getDate() + extensionDays);

    const planAmount = Number(plan.amount) || 0;
    const addonPortion = Math.max(0, Number(receipt.amount) - planAmount);

    const subscription = await Subscription.create({
      tenantId: tenant._id,
      plan: plan.billingCycle || 'custom',
      planId: plan._id,
      planCode: plan.code,
      amount: Number(receipt.amount) || planAmount,
      addonAmount: addonPortion,
      currency: plan.currency || 'LKR',
      durationDays: extensionDays,
      startDate: now,
      endDate: newEnd,
      extendedByAdmin: true,
      extensionNote: `Payment receipt verified. Extension: ${plan.name} (${extensionDays} days)`,
      extendedBy: req.user.id,
      extendedAt: now,
      createdBy: req.user.id,
    });

    // Update tenant subscription status
    tenant.subscriptionStatus = 'active';
    tenant.status = 'active';
    // Clear any temporary-activation overrides once payment is verified.
    tenant.temporaryActivationUntil = null;
    tenant.temporaryActivationRequestedAt = null;
    tenant.temporaryActivationRequestedBy = null;
    tenant.temporaryActivationExpiryEndDate = null;
    tenant.temporaryActivationUsedForEndDate = null;
    tenant.subscriptionExpiryReminderSentForEndDate = null;
    tenant.subscriptionDeactivationNotifiedForEndDate = null;
    if (!tenant.assignedPlanId) {
      tenant.assignedPlanId = plan._id;
      tenant.assignedAt = now;
      tenant.assignedBy = req.user.id;
    }
    tenant.updatedBy = req.user.id;
    await tenant.save();

    // Update receipt
    receipt.status = 'verified';
    receipt.verifiedBy = req.user.id;
    receipt.verifiedAt = now;
    receipt.subscriptionExtended = true;
    receipt.extensionDays = extensionDays;
    receipt.amountMatchesExpected = amountsEqual(receipt.amount, receipt.expectedAmount);
    receipt.subscriptionId = subscription._id;
    receipt.updatedBy = req.user.id;
    await receipt.save();

    await emitAudit({
      req,
      action: 'PAYMENT_VERIFIED',
      resource: 'PaymentReceipt',
      resourceId: receipt._id,
      changes: { after: { subscriptionExtendedTo: newEnd, extensionDays } },
    });

    try {
      await notifySuperAdmins(tenant._id, {
        type: 'payment_receipt_verified',
        title: 'Payment verified — subscription extended',
        body: `Subscription extended until ${newEnd.toDateString()} for "${tenant.businessName}".`,
        meta: { resourceType: 'tenant', resourceId: String(tenant._id), subscriptionEndDate: newEnd.toISOString() },
      });
      await notifyMerchantAdmins(tenant._id, {
        type: 'subscription_approved',
        title: 'Subscription activated',
        body: `Your subscription is active until ${newEnd.toDateString()}.`,
        meta: { resourceType: 'tenant', resourceId: String(tenant._id), subscriptionEndDate: newEnd.toISOString() },
      }).catch(() => {});
    } catch (_) {}

    const receiptLean = receipt.toObject ? receipt.toObject() : receipt;
    receiptLean.extensionDays = extensionDays;
    await notifyPaymentVerified(receiptLean, tenant);

    res.json({
      message: `Subscription extended by ${extensionDays} days (until ${newEnd.toDateString()})`,
      receipt,
      subscription,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /subscriptions/schedule-plan — change plan at end of current period
router.post('/schedule-plan', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const audience = tenantPlanAudience(tenant.countryIso);
    const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true, planAudience: audience });
    if (!plan) return res.status(400).json({ message: 'Selected plan is not available' });

    const latestSub = await Subscription.findOne({ tenantId: tenant._id }).sort({ endDate: -1 }).lean();
    const effectiveAt = resolveTenantPeriodEnd(tenant, latestSub?.endDate) || new Date();

    tenant.pendingPlanId = plan._id;
    tenant.pendingPlanEffectiveAt = effectiveAt;
    tenant.updatedBy = req.user.id;
    await tenant.save();

    await notifySubscriptionEvent(tenant._id, {
      type: 'subscription_plan_scheduled',
      title: 'Plan change scheduled',
      body: `Your plan will change to ${plan.name} on ${new Date(effectiveAt).toDateString()}.`,
      meta: { resourceType: 'tenant', resourceId: String(tenant._id), planId: String(plan._id) },
      merchantEmail: {
        subject: 'Subscription plan change scheduled — Cafinity',
        html: `<p>Hi,</p><p>You scheduled a change to <strong>${plan.name}</strong>, effective on <strong>${new Date(effectiveAt).toDateString()}</strong>.</p><p>Complete payment before that date to activate the new plan.</p>`,
      },
      superEmail: {
        subject: 'Merchant scheduled plan change',
        html: `<p>Merchant <strong>${tenant.businessName}</strong> scheduled plan <strong>${plan.name}</strong> effective ${new Date(effectiveAt).toDateString()}.</p>`,
      },
    }).catch(() => {});

    res.json({
      pendingPlanId: tenant.pendingPlanId,
      pendingPlanEffectiveAt: tenant.pendingPlanEffectiveAt,
      message: `Plan will change on ${new Date(effectiveAt).toDateString()} after payment.`,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/my — merchant's own subscription status
router.get('/my', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId)
      .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
      .populate('pendingPlanId', 'name code amount currency billingCycle durationDays isActive');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const subscriptions = await Subscription.find({ tenantId: req.tenantId }).sort({ endDate: -1 });
    let receipts = await PaymentReceipt.find({ tenantId: req.tenantId })
      .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
      .sort({ createdAt: -1 })
      .lean();
    receipts = await attachFreshReceiptUrls(receipts);

    const renewal = await computeSubscriptionRenewalExpected(tenant);
    res.json({ tenant, subscriptions, receipts, billingBreakdown: renewal });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
