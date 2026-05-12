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
const { notifySuperAdmins } = require('../lib/notificationHelpers');

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
  const audience = tenantPlanAudience(tenant.countryIso);
  const regionFilter = { planAudience: audience };

  // Locked tenants must pay assigned plan only.
  if (tenant.planLocked) {
    if (!tenant.assignedPlanId) return null;
    const assigned = await SubscriptionPlan.findOne({ _id: tenant.assignedPlanId, isActive: true, ...regionFilter });
    return assigned || null;
  }

  if (planId) {
    const selected = await SubscriptionPlan.findOne({ _id: planId, isActive: true, ...regionFilter });
    if (selected) return selected;
  }

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

    let receipts = await PaymentReceipt.find(filter)
      .sort({ createdAt: -1 })
      .populate('tenantId', 'businessName slug')
      .populate('verifiedBy', 'name')
      .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
      .lean();
    receipts = await attachFreshReceiptUrls(receipts);
    res.json(receipts);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /subscriptions/receipts — merchant uploads a payment receipt
router.post('/receipts', authenticateJWT, authorize('merchant_admin'), upload.single('receipt'), async (req, res) => {
  try {
    const { amount, bankReference, bankName, paymentDate, notes, planId } = req.body;
    if (!amount || !bankReference || !paymentDate) {
      return res.status(400).json({ message: 'amount, bankReference, and paymentDate are required' });
    }
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    const tenant = await Tenant.findById(req.tenantId).select('businessName assignedPlanId planLocked countryIso');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    const requestedPlan = await resolveRequestedPlan({ tenant, planId });
    if (!requestedPlan) {
      return res.status(400).json({ message: 'No active plan is assigned. Please contact support.' });
    }
    if (!amountsEqual(amountValue, requestedPlan.amount)) {
      return res.status(400).json({
        message: `Amount must exactly match the plan amount (${requestedPlan.currency} ${Number(requestedPlan.amount).toLocaleString()}).`,
      });
    }

    let receiptFileUrl = '';
    let receiptFileKey = '';

    if (req.file) {
      try {
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
          { headers: { ...form.getHeaders(), Authorization: token }, timeout: 30000 }
        );
        receiptFileKey = uploadRes.data.key;
      } catch (uploadErr) {
        return res.status(500).json({ message: 'Failed to upload receipt file' });
      }
    }

    const receipt = await PaymentReceipt.create({
      tenantId: req.tenantId,
      amount: amountValue,
      currency: requestedPlan.currency || 'LKR',
      requestedPlanId: requestedPlan._id,
      requestedPlanCode: requestedPlan.code,
      expectedAmount: requestedPlan.amount,
      amountMatchesExpected: true,
      bankReference: bankReference.trim(),
      bankName: (bankName || '').trim(),
      paymentDate: new Date(paymentDate),
      receiptFileUrl: '',
      receiptFileKey,
      notes: (notes || '').trim(),
      createdBy: req.user.id,
    });

    // Notify superadmins a payment receipt has been submitted (action is picked up by superadmin).
    try {
      const supers = await User.find({ role: 'superadmin', isActive: true }).select('_id email').lean();
      if (supers.length) {
        await notifySuperAdmins(req.tenantId, {
          type: 'payment_receipt_submitted',
          title: 'Payment receipt submitted',
          body: `A merchant submitted a payment receipt for "${tenant.businessName}".`,
          meta: { resourceType: 'tenant', resourceId: String(req.tenantId), receiptId: String(receipt._id) },
        });

        await Promise.all(
          supers.map((sa) =>
            sendEmail({
              to: sa.email,
              subject: 'New payment receipt submitted — Cafinity',
              html: `<p>Hi Super Admin,</p>
                <p>A payment receipt was submitted by a merchant.</p>
                <ul>
                  <li><strong>Merchant:</strong> ${tenant.businessName}</li>
                  <li><strong>Amount:</strong> ${requestedPlan.currency || 'LKR'} ${Number(amountValue).toLocaleString()}</li>
                  <li><strong>Payment ref:</strong> ${String(bankReference || '').trim()}</li>
                </ul>
                <p>Please check the <strong>Payments</strong> page in the admin portal for verification.</p>`,
            }).catch(() => {})
          ),
        );
      }
    } catch (_) {
      // Notifications + email are best-effort; never block receipt creation.
    }

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

      await sendEmail({
        to: receipt.tenantId?.email || '',
        subject: 'Payment Receipt Update — Cafinity',
        html: `<p>Your payment receipt was not accepted. Reason: ${rejectionReason}</p>`,
      }).catch(() => {});

      return res.json({ message: 'Receipt rejected', receipt });
    }

    if (!receipt.amountMatchesExpected) {
      return res.status(400).json({ message: 'Receipt amount does not match expected plan amount' });
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

    const subscription = await Subscription.create({
      tenantId: tenant._id,
      plan: plan.billingCycle || 'custom',
      planId: plan._id,
      planCode: plan.code,
      amount: plan.amount,
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
    receipt.amountMatchesExpected = amountsEqual(receipt.amount, plan.amount);
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

    // Notify superadmins (so they can handle activation requests / monitor renewals).
    try {
      const supers = await User.find({ role: 'superadmin', isActive: true }).select('_id email').lean();
      if (supers.length) {
        await notifySuperAdmins(tenant._id, {
          type: 'payment_receipt_verified',
          title: 'Payment verified — subscription extended',
          body: `Subscription extended until ${newEnd.toDateString()} for "${tenant.businessName}".`,
          meta: { resourceType: 'tenant', resourceId: String(tenant._id), subscriptionEndDate: newEnd.toISOString() },
        });

        await Promise.all(
          supers.map((sa) =>
            sendEmail({
              to: sa.email,
              subject: 'Payment verified — Subscription extended',
              html: `<p>Hi Super Admin,</p>
                <p>A payment receipt was verified.</p>
                <ul>
                  <li><strong>Merchant:</strong> ${tenant.businessName}</li>
                  <li><strong>Extended until:</strong> ${newEnd.toDateString()}</li>
                </ul>
                <p>You may now activate the merchant if required for one-day overrides.</p>`,
            }).catch(() => {}),
          ),
        );
      }
    } catch (_) {
      /* best-effort */
    }

    // Also send merchant_admins a confirmation email.
    try {
      const merchantAdmins = await User.find({ tenantId: tenant._id, role: 'merchant_admin', isActive: true }).select('email').lean();
      await Promise.all(
        merchantAdmins.map((a) =>
          sendEmail({
            to: a.email,
            subject: 'Subscription extended — Cafinity',
            html: `<p>Hi,</p>
              <p>Your subscription has been extended until <strong>${newEnd.toDateString()}</strong>.</p>
              <p>Thank you.</p>`,
          }).catch(() => {}),
        ),
      );
    } catch (_) {
      /* best-effort */
    }

    res.json({
      message: `Subscription extended by ${extensionDays} days (until ${newEnd.toDateString()})`,
      receipt,
      subscription,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/my — merchant's own subscription status
router.get('/my', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const subscriptions = await Subscription.find({ tenantId: req.tenantId }).sort({ endDate: -1 });
    let receipts = await PaymentReceipt.find({ tenantId: req.tenantId })
      .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
      .sort({ createdAt: -1 })
      .lean();
    receipts = await attachFreshReceiptUrls(receipts);

    res.json({ tenant, subscriptions, receipts });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
