const express = require('express');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const PaymentReceipt = require('../models/PaymentReceipt');
const { authenticateJWT, authorize, emitAudit } = require('@innovapos/shared-middleware');
const { sendEmail } = require('../utils/mailer');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Only PDF or images allowed'));
  },
});

// GET /subscriptions — list payment receipts
router.get('/receipts', authenticateJWT, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || undefined) : req.tenantId;
    const filter = tenantId ? { tenantId } : {};
    if (req.query.status) filter.status = req.query.status;

    const receipts = await PaymentReceipt.find(filter)
      .sort({ createdAt: -1 })
      .populate('tenantId', 'businessName slug')
      .populate('verifiedBy', 'name')
      .lean();
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /subscriptions/receipts — merchant uploads a payment receipt
router.post('/receipts', authenticateJWT, authorize('merchant_admin'), upload.single('receipt'), async (req, res) => {
  try {
    const { amount, bankReference, bankName, paymentDate, notes } = req.body;
    if (!amount || !bankReference || !paymentDate) {
      return res.status(400).json({ message: 'amount, bankReference, and paymentDate are required' });
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
        receiptFileUrl = uploadRes.data.url;
        receiptFileKey = uploadRes.data.key;
      } catch (uploadErr) {
        return res.status(500).json({ message: 'Failed to upload receipt file' });
      }
    }

    const receipt = await PaymentReceipt.create({
      tenantId: req.tenantId,
      amount: parseFloat(amount),
      bankReference: bankReference.trim(),
      bankName: (bankName || '').trim(),
      paymentDate: new Date(paymentDate),
      receiptFileUrl,
      receiptFileKey,
      notes: (notes || '').trim(),
      createdBy: req.user.id,
    });

    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /subscriptions/receipts/:id/verify — superadmin verifies receipt and extends subscription
router.put('/receipts/:id/verify', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { action, rejectionReason, extensionType, customDays } = req.body;

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
        subject: 'Payment Receipt Update — InnovaPOS',
        html: `<p>Your payment receipt was not accepted. Reason: ${rejectionReason}</p>`,
      }).catch(() => {});

      return res.json({ message: 'Receipt rejected', receipt });
    }

    // Calculate extension days
    const daysMap = { monthly: 30, quarterly: 90, yearly: 365, custom: parseInt(customDays) || 30 };
    const extensionDays = daysMap[extensionType] || 30;

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
      plan: extensionType || 'monthly',
      startDate: now,
      endDate: newEnd,
      extendedByAdmin: true,
      extensionNote: `Payment receipt verified. Extension: ${extensionType || 'monthly'} (${extensionDays} days)`,
      extendedBy: req.user.id,
      extendedAt: now,
      createdBy: req.user.id,
    });

    // Update tenant subscription status
    tenant.subscriptionStatus = 'active';
    tenant.updatedBy = req.user.id;
    await tenant.save();

    // Update receipt
    receipt.status = 'verified';
    receipt.verifiedBy = req.user.id;
    receipt.verifiedAt = now;
    receipt.subscriptionExtended = true;
    receipt.extensionDays = extensionDays;
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

    await sendEmail({
      to: receipt.tenantId?.email || '',
      subject: 'Payment Confirmed — Subscription Extended',
      html: `<p>Your payment has been verified. Your subscription is now active until <strong>${newEnd.toDateString()}</strong>. Thank you!</p>`,
    }).catch(() => {});

    res.json({ message: `Subscription extended by ${extensionDays} days (until ${newEnd.toDateString()})`, receipt, subscription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /subscriptions/my — merchant's own subscription status
router.get('/my', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const subscriptions = await Subscription.find({ tenantId: req.tenantId }).sort({ endDate: -1 });
    const receipts = await PaymentReceipt.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });

    res.json({ tenant, subscriptions, receipts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
