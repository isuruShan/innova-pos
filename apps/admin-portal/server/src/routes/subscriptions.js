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
const { presignObjectKey, presignObjectKeys } = require('../utils/s3Runtime');
const { notifySuperAdmins, notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { notifySubscriptionEvent } = require('../lib/subscriptionNotify');
const { resolveTenantPeriodEnd } = require('../lib/subscriptionDates');
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');
const {
  computeSubscriptionRenewalExpected,
  getAddonByCode,
} = require('../lib/addonBilling');
const { getAddonPurchaseQuote } = require('../lib/addonPurchaseQuote');
const { getStoreCreateQuote } = require('../lib/storeCreateQuote');
const { createDefaultStoreForTenant } = require('../lib/storePurchase');
const { notifyPaymentSubmitted, notifyPaymentVerified } = require('../lib/paymentNotify');
const {
  activateSubscriptionForTenant,
  notifySubscriptionActivated,
  endTenantTrialOnPaidPurchase,
} = require('../lib/subscriptionActivation');

const router = express.Router();

const RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    RECEIPT_IMAGE_TYPES.includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Only image files are allowed (JPG, PNG, WEBP, GIF)'));
  },
});

const amountsEqual = (a, b) => Number(a).toFixed(2) === Number(b).toFixed(2);

/**
 * Attach fresh presigned URLs to receipt documents using batch presigning.
 * Uses single HTTP call instead of N calls for N receipts.
 */
async function attachFreshReceiptUrls(receipts) {
  if (!receipts?.length) return receipts;
  const keys = [...new Set(receipts.map((r) => r.receiptFileKey).filter(Boolean))];
  if (!keys.length) return receipts;
  // Single batch call instead of N individual calls
  const urls = await presignObjectKeys(keys, 86400);
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

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyReceiptKindFilter(filter, kind) {
  if (!kind) return;
  if (kind === 'subscription') {
    filter.$and = [...(filter.$and || []), {
      $or: [
        { receiptKind: 'subscription' },
        { receiptKind: { $exists: false } },
        { receiptKind: null },
      ],
    }];
    return;
  }
  if (kind === 'addon') {
    filter.receiptKind = { $in: ['addon', 'store', 'user_license'] };
    return;
  }
  filter.receiptKind = kind;
}

async function loadReceiptDetail(receiptId, { includeAdminContext = false } = {}) {
  const PaidAddonDefinition = require('../models/PaidAddonDefinition');
  let receipt = await PaymentReceipt.findById(receiptId)
    .populate('tenantId', 'businessName slug subscriptionStatus trialEndsAt countryIso')
    .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
    .populate('verifiedBy', 'name email')
    .populate('createdBy', 'name email')
    .lean();
  if (!receipt) return null;

  [receipt] = await attachFreshReceiptUrls([receipt]);

  const tenant = receipt.tenantId;
  let billingBreakdown = null;
  let addonMeta = null;
  let storeMeta = null;
  let userMeta = null;
  let storesMeta = null;
  let tenantContext = null;

  if (includeAdminContext) {
    if ((receipt.receiptKind === 'subscription' || (!receipt.receiptKind && !receipt.addonCode))
      && !receipt.paymentBreakdown) {
      billingBreakdown = await computeSubscriptionRenewalExpected(tenant);
    }

    const ADDON_LABELS = {
      qrOrdering: 'QR Ordering',
      loyalty: 'Loyalty Program',
      tableManagement: 'Table Management',
      uberEats: 'Uber Eats',
      accounting: 'Accounting',
    };
    const fullTenant = await Tenant.findById(tenant._id)
      .populate('assignedPlanId', 'name billingCycle amount currency')
      .lean();
    const latestSub = await Subscription.findOne({ tenantId: tenant._id })
      .sort({ endDate: -1 })
      .select('endDate')
      .lean();
    const periodEnd = resolveTenantPeriodEnd(fullTenant, latestSub?.endDate);
    const activeAddons = Object.entries(fullTenant?.paidAddons || {})
      .filter(([, v]) => v?.active === true)
      .map(([key]) => ADDON_LABELS[key] || key);
    tenantContext = {
      subscriptionStatus: fullTenant?.subscriptionStatus || tenant.subscriptionStatus,
      planName: fullTenant?.assignedPlanId?.name || null,
      planBillingCycle: fullTenant?.assignedPlanId?.billingCycle || null,
      periodEnd: periodEnd ? periodEnd.toISOString() : null,
      activeAddons,
    };
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
  if (receipt.receiptKind === 'user_license' && receipt.userLicensePayload) {
    const UserModel = require('../models/User');
    const Store = require('../models/Store');
    const payload = receipt.userLicensePayload;
    if (payload.userId) {
      const u = await UserModel.findById(payload.userId).select('name email role').lean();
      userMeta = u || { name: 'Unknown User', email: '' };
    }
    const storeIds = payload.storeIds || payload.targetStoreIds || [];
    if (storeIds.length > 0) {
      const docs = await Store.find({ _id: { $in: storeIds } }).select('name code').lean();
      storesMeta = docs.map((s) => ({ name: s.name, code: s.code }));
    }
  }

  return {
    receipt,
    billingBreakdown,
    addonMeta,
    storeMeta,
    userMeta,
    storesMeta,
    tenantContext,
    receiptKindLabel:
      receipt.receiptKind === 'user_license'
        ? 'User license'
        : receipt.receiptKind === 'store'
          ? 'Additional store'
          : receipt.receiptKind === 'addon' || receipt.addonCode
            ? 'Paid add-on'
            : 'Subscription renewal',
  };
}

// GET /subscriptions/receipts — list payment receipts
router.get('/receipts', authenticateJWT, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || undefined) : req.tenantId;
    const filter = tenantId ? { tenantId } : {};
    if (req.query.status) filter.status = req.query.status;
    applyReceiptKindFilter(filter, req.query.kind);
    if (req.query.method) filter.paymentMethod = req.query.method;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.paymentDate = {};
      if (req.query.dateFrom) filter.paymentDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = to;
      }
    }

    const search = String(req.query.search || req.query.q || '').trim();
    if (search && req.user.role === 'superadmin') {
      const Tenant = require('../models/Tenant');
      const re = new RegExp(escapeRegex(search), 'i');
      const tenants = await Tenant.find({ businessName: re }).select('_id').lean();
      const ids = tenants.map((t) => t._id);
      if (!ids.length) {
        const { page, limit } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
        return res.json(paginated([], 0, page, limit));
      }
      filter.tenantId = { $in: ids };
    } else if (search && req.user.role === 'merchant_admin') {
      const re = new RegExp(escapeRegex(search), 'i');
      filter.$and = [...(filter.$and || []), { $or: [{ bankReference: re }, { notes: re }] }];
    }

    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
    const total = await PaymentReceipt.countDocuments(filter);
    const sort = parseSortQuery(req, {
      createdAt: 'createdAt',
      amount: 'amount',
      status: 'status',
      paymentDate: 'paymentDate',
    }, { createdAt: -1 });
    let receipts = await PaymentReceipt.find(filter)
      .select('-paymentBreakdown')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('tenantId', 'businessName slug')
      .populate('verifiedBy', 'name')
      .populate('requestedPlanId', 'name code amount currency billingCycle durationDays')
      .lean();

    // Attach a human-readable label for what was purchased
    receipts = receipts.map((r) => {
      let purchasedItemLabel = 'Subscription renewal';
      if (r.receiptKind === 'addon' && r.addonCode) {
        purchasedItemLabel = r.addonCode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      } else if (r.receiptKind === 'store') {
        purchasedItemLabel = 'Additional store';
      } else if (r.receiptKind === 'user_license') {
        const action = r.userLicenseAction || '';
        const role = r.userLicensePayload?.role || '';
        if (action === 'create_user') purchasedItemLabel = `New user seat${role ? ` (${role})` : ''}`;
        else if (action === 'assign_stores') purchasedItemLabel = 'Store access (user)';
        else purchasedItemLabel = 'User license';
      } else if (r.requestedPlanId?.name) {
        purchasedItemLabel = r.requestedPlanId.name;
      }
      return { ...r, purchasedItemLabel };
    });

    res.json(paginated(receipts, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/receipts/analytics — superadmin payment analytics (supports dateFrom/dateTo)
router.get('/receipts/analytics', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const now = new Date();

    // Parse optional date range
    let rangeFrom = req.query.dateFrom ? (() => { const d = new Date(req.query.dateFrom); d.setHours(0,0,0,0); return d; })() : null;
    let rangeTo   = req.query.dateTo   ? (() => { const d = new Date(req.query.dateTo);   d.setHours(23,59,59,999); return d; })() : null;

    // Date filter applied to the selected window (verified payments)
    const windowMatch = {};
    if (rangeFrom || rangeTo) {
      windowMatch.paymentDate = {};
      if (rangeFrom) windowMatch.paymentDate.$gte = rangeFrom;
      if (rangeTo)   windowMatch.paymentDate.$lte = rangeTo;
    }
    const verifiedInWindow  = { status: 'verified', ...windowMatch };
    const anyStatusInWindow = Object.keys(windowMatch).length ? windowMatch : null;

    // Chart granularity: daily <=31d, weekly <=90d, monthly otherwise
    const chartFrom  = rangeFrom || new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const chartTo    = rangeTo   || now;
    const spanDays   = Math.ceil((chartTo - chartFrom) / 86_400_000);
    const granularity = spanDays <= 31 ? 'day' : spanDays <= 90 ? 'week' : 'month';

    const timeGroupId = granularity === 'day'
      ? { year: { $year: '$paymentDate' }, month: { $month: '$paymentDate' }, day: { $dayOfMonth: '$paymentDate' } }
      : granularity === 'week'
      ? { year: { $isoWeekYear: '$paymentDate' }, week: { $isoWeek: '$paymentDate' } }
      : { year: { $year: '$paymentDate' }, month: { $month: '$paymentDate' } };

    const [statusAgg, kindAgg, methodAgg, timeAgg, topMerchantsAgg, recentAgg, pendingCount] = await Promise.all([
      // Status totals — scoped to window if range selected
      PaymentReceipt.aggregate([
        ...(anyStatusInWindow ? [{ $match: anyStatusInWindow }] : []),
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, '$amount', 0] } } } },
      ]),
      // By kind — verified in window
      PaymentReceipt.aggregate([
        { $match: verifiedInWindow },
        { $group: { _id: '$receiptKind', count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
        { $sort: { revenue: -1 } },
      ]),
      // By payment method — verified in window
      PaymentReceipt.aggregate([
        { $match: verifiedInWindow },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
        { $sort: { revenue: -1 } },
      ]),
      // Time-series chart — adaptive granularity
      PaymentReceipt.aggregate([
        { $match: { status: 'verified', paymentDate: { $gte: chartFrom, $lte: chartTo } } },
        { $group: { _id: timeGroupId, count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
      ]),
      // Top merchants — verified in window
      PaymentReceipt.aggregate([
        { $match: verifiedInWindow },
        { $group: { _id: '$tenantId', count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'tenants', localField: '_id', foreignField: '_id', as: 'tenant' } },
        { $unwind: { path: '$tenant', preserveNullAndEmptyArrays: false } },
        { $project: { _id: 1, count: 1, revenue: 1, name: '$tenant.businessName', tenantId: '$_id' } },
      ]),
      // Recent verified — in window
      PaymentReceipt.find({ status: 'verified', ...windowMatch })
        .sort({ verifiedAt: -1 })
        .limit(5)
        .populate('tenantId', 'businessName')
        .lean(),
      // Pending count — always all-time
      PaymentReceipt.countDocuments({ status: 'pending' }),
    ]);

    // Shape status totals
    const totals = { verified: 0, pending: 0, rejected: 0, totalRevenue: 0 };
    for (const s of statusAgg) {
      totals[s._id] = s.count;
      if (s._id === 'verified') totals.totalRevenue = s.revenue;
    }

    // Build filled time-series buckets
    const timeMap = {};
    for (const pt of timeAgg) {
      const key = granularity === 'day'
        ? `${pt._id.year}-${String(pt._id.month).padStart(2,'0')}-${String(pt._id.day).padStart(2,'0')}`
        : granularity === 'week'
        ? `${pt._id.year}-W${String(pt._id.week).padStart(2,'0')}`
        : `${pt._id.year}-${String(pt._id.month).padStart(2,'0')}`;
      timeMap[key] = pt;
    }

    const byPeriod = [];
    if (granularity === 'day') {
      for (const d = new Date(chartFrom); d <= chartTo; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        byPeriod.push({ period: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), count: timeMap[key]?.count || 0, revenue: timeMap[key]?.revenue || 0 });
      }
    } else if (granularity === 'week') {
      const cursor = new Date(chartFrom);
      cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // align to Monday
      while (cursor <= chartTo) {
        const startOfYear = new Date(cursor.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((cursor - startOfYear) / 86_400_000 + startOfYear.getDay() + 1) / 7);
        const key = `${cursor.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
        byPeriod.push({ period: `W${String(weekNum).padStart(2,'0')} '${String(cursor.getFullYear()).slice(2)}`, count: timeMap[key]?.count || 0, revenue: timeMap[key]?.revenue || 0 });
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const cursor = new Date(chartFrom.getFullYear(), chartFrom.getMonth(), 1);
      const end    = new Date(chartTo.getFullYear(), chartTo.getMonth(), 1);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'00')}`;
        byPeriod.push({ period: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), count: timeMap[key]?.count || 0, revenue: timeMap[key]?.revenue || 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    res.json({
      totals,
      pendingCount,
      granularity,
      byKind:         kindAgg.map((k) => ({ kind: k._id || 'subscription', count: k.count, revenue: k.revenue })),
      byMethod:       methodAgg.map((m) => ({ method: m._id || 'bank_transfer', count: m.count, revenue: m.revenue })),
      byPeriod,
      topMerchants:   topMerchantsAgg,
      recentActivity: recentAgg,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/receipts/by-tenant/:tenantId — merchant payment history
router.get('/receipts/by-tenant/:tenantId', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const filter = { tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.kind) filter.receiptKind = req.query.kind;
    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 20, maxLimit: 50 });
    const total = await PaymentReceipt.countDocuments(filter);
    let receipts = await PaymentReceipt.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('requestedPlanId', 'name')
      .lean();
    // Attach purchasedItemLabel
    receipts = receipts.map((r) => {
      let purchasedItemLabel = 'Subscription renewal';
      if (r.receiptKind === 'addon' && r.addonCode) purchasedItemLabel = r.addonCode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      else if (r.receiptKind === 'store') purchasedItemLabel = 'Additional store';
      else if (r.receiptKind === 'user_license') {
        const role = r.userLicensePayload?.role || '';
        purchasedItemLabel = r.userLicenseAction === 'create_user' ? `New user seat${role ? ` (${role})` : ''}` : 'User license';
      } else if (r.requestedPlanId?.name) purchasedItemLabel = r.requestedPlanId.name;
      return { ...r, purchasedItemLabel };
    });
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findById(tenantId).select('businessName subscriptionStatus trialEndsAt').lean();
    res.json({ tenant, ...paginated(receipts, total, page, limit) });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/superadmin/dashboard-stats — superadmin dashboard metrics
router.get('/superadmin/dashboard-stats', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const MerchantApplication = require('../models/MerchantApplication');
    const Store = require('../models/Store');

    const pendingAppsCount = await MerchantApplication.countDocuments({ status: 'pending' });
    const pendingPaymentsCount = await PaymentReceipt.countDocuments({ status: 'pending' });
    const totalMerchants = await Tenant.countDocuments({ status: 'active' });
    const totalStores = await Store.countDocuments({ isActive: true });

    const revenue = await PaymentReceipt.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: '$currency', total: { $sum: '$amount' } } }
    ]);
    const revenueMap = Object.fromEntries(revenue.map(r => [r._id, r.total]));

    const recentApps = await MerchantApplication.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentPayments = await PaymentReceipt.find({ status: 'pending' })
      .populate('tenantId', 'businessName')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      pendingAppsCount,
      pendingPaymentsCount,
      totalMerchants,
      totalStores,
      revenue: revenueMap,
      recentApps,
      recentPayments,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/receipts/:id/url — get on-demand presigned/SAS URL for a payment receipt
router.get('/receipts/:id/url', authenticateJWT, async (req, res) => {
  try {
    const receipt = await PaymentReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    
    // Check authorization: must be superadmin or own receipt
    if (req.user.role !== 'superadmin' && String(receipt.tenantId) !== String(req.tenantId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!receipt.receiptFileKey) {
      return res.status(400).json({ message: 'Receipt has no attached file' });
    }

    const { presignObjectKey } = require('../utils/s3Runtime');
    const url = await presignObjectKey(receipt.receiptFileKey, 3600); // 1-hour expiry
    res.json({ url });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /subscriptions/receipts/:id — payment detail (superadmin or owning merchant)
router.get('/receipts/:id', authenticateJWT, async (req, res) => {
  try {
    const receiptDoc = await PaymentReceipt.findById(req.params.id).select('tenantId').lean();
    if (!receiptDoc) return res.status(404).json({ message: 'Receipt not found' });

    const isSuperadmin = req.user.role === 'superadmin';
    if (!isSuperadmin) {
      if (req.user.role !== 'merchant_admin' || String(receiptDoc.tenantId) !== String(req.tenantId)) {
        return res.status(403).json({ message: 'Access forbidden: insufficient role' });
      }
    }

    const detail = await loadReceiptDetail(req.params.id, { includeAdminContext: isSuperadmin });
    if (!detail) return res.status(404).json({ message: 'Receipt not found' });

    res.json(detail);
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
      userLicenseAction,
      userLicensePayload,
      storeLocationName,
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

    if (purchaseKindNorm === 'user_license') {
      const {
        buildCreateUserPayload,
        buildAssignStoresPayload,
        createPendingUserLicenseReceipt,
      } = require('../lib/userLicenseCheckout');
      const actionNorm = String(userLicenseAction || '').trim().toLowerCase();
      if (!['create_user', 'assign_stores'].includes(actionNorm)) {
        return res.status(400).json({ message: 'userLicenseAction must be create_user or assign_stores' });
      }
      let payloadBody = {};
      try {
        payloadBody =
          typeof userLicensePayload === 'string'
            ? JSON.parse(userLicensePayload)
            : userLicensePayload || {};
      } catch {
        return res.status(400).json({ message: 'userLicensePayload must be valid JSON' });
      }

      const built =
        actionNorm === 'create_user'
          ? await buildCreateUserPayload(req.tenantId, payloadBody, req.user.id)
          : await buildAssignStoresPayload(req.tenantId, payloadBody, req.user.id);

      const expected = Number(built.quote.priced?.amount) || 0;
      if (!amountsEqual(amountValue, expected)) {
        return res.status(400).json({
          message: `Amount must exactly match the charge (${built.quote.priced.currency} ${Number(expected).toLocaleString()}).`,
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

      const receipt = await createPendingUserLicenseReceipt({
        tenantId: req.tenantId,
        action: actionNorm,
        payload: built.payload,
        amount: amountValue,
        currency: built.quote.priced.currency || 'LKR',
        paymentMethod: method,
        bankReference: bankReference.trim(),
        receiptFileKey,
        notes,
        paymentBreakdown: built.quote,
        createdBy: req.user.id,
      });

      notifyPaymentSubmitted(receipt, tenant).catch(() => {}); // fire-and-forget
      return res.status(201).json(receipt);
    }

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
        userLicensePayload: storeLocationName ? { name: String(storeLocationName).trim().slice(0, 100) } : null,
        paymentBreakdown: quote,
        createdBy: req.user.id,
      });

      notifyPaymentSubmitted(receipt, tenant).catch(() => {}); // fire-and-forget

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
        paymentBreakdown: quote,
        createdBy: req.user.id,
      });

      notifyPaymentSubmitted(receipt, tenant).catch(() => {}); // fire-and-forget

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

    const { getLatestSubscriptionEnd, resolveTenantPeriodEnd } = require('../lib/subscriptionDates');
    const latestSubEnd = await getLatestSubscriptionEnd(req.tenantId);
    const billingPeriodStart = resolveTenantPeriodEnd(tenant, latestSubEnd) || new Date();
    const durationDays = Number(requestedPlan.durationDays) || 30;
    const billingPeriodEnd = new Date(billingPeriodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

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
      paymentBreakdown: renewal,
      billingPeriodStart,
      billingPeriodEnd,
      createdBy: req.user.id,
    });

    notifyPaymentSubmitted(receipt, tenant).catch(() => {}); // fire-and-forget

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
      // Fire-and-forget — do not block the response on email delivery
      notifySubscriptionEvent(tenantId, {
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

    if (receipt.receiptKind === 'user_license') {
      const { processVerifiedUserLicenseReceipt } = require('../lib/userLicenseFulfill');
      const tenantId = receipt.tenantId?._id || receipt.tenantId;
      await endTenantTrialOnPaidPurchase(tenantId, { activatedBy: req.user.id });
      const now = new Date();
      receipt.status = 'verified';
      receipt.verifiedBy = req.user.id;
      receipt.verifiedAt = now;
      receipt.subscriptionExtended = false;
      receipt.updatedBy = req.user.id;
      await receipt.save();

      const result = await processVerifiedUserLicenseReceipt(receipt, req);

      // Fire-and-forget audit + notifications — do not block the response
      const _receiptObj1 = receipt.toObject ? receipt.toObject() : receipt;
      Promise.all([
        emitAudit({
          req,
          action: 'USER_LICENSE_PAYMENT_VERIFIED',
          resource: 'PaymentReceipt',
          resourceId: receipt._id,
          changes: { after: { action: receipt.userLicenseAction, userId: result.user?._id } },
        }),
        notifyMerchantAdmins(tenantId, {
          type: 'subscription_approved',
          title: receipt.userLicenseAction === 'create_user' ? 'User created' : 'Store access updated',
          body: receipt.userLicenseAction === 'create_user' ? 'Your new user account is ready.' : 'Additional store access has been applied.',
          meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
        }),
        Tenant.findById(tenantId).lean().then((doc) => notifyPaymentVerified(_receiptObj1, doc)),
      ]).catch(() => {});

      return res.json({ message: 'User license applied', receipt, user: result.user });
    }

    if (receipt.receiptKind === 'store') {
      const tenantId = receipt.tenantId?._id || receipt.tenantId;
      await endTenantTrialOnPaidPurchase(tenantId, { activatedBy: req.user.id });
      const store = await createDefaultStoreForTenant(tenantId, req.user.id);
      const now = new Date();
      receipt.status = 'verified';
      receipt.verifiedBy = req.user.id;
      receipt.verifiedAt = now;
      receipt.subscriptionExtended = false;
      receipt.updatedBy = req.user.id;
      await receipt.save();

      // Fire-and-forget audit + notifications — do not block the response
      const _receiptObj2 = receipt.toObject ? receipt.toObject() : receipt;
      Promise.all([
        emitAudit({
          req,
          action: 'STORE_PAYMENT_VERIFIED',
          resource: 'PaymentReceipt',
          resourceId: receipt._id,
          changes: { after: { storeId: store._id, storeCode: store.code } },
        }),
        notifyMerchantAdmins(tenantId, {
          type: 'subscription_approved',
          title: 'Store created',
          body: `Your additional store (${store.code}) is ready. Open Stores to edit name and settings.`,
          meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
        }),
        Tenant.findById(tenantId).lean().then((doc) => notifyPaymentVerified(_receiptObj2, doc)),
      ]).catch(() => {});

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

      // Fire-and-forget audit + notifications — do not block the response
      const _receiptObj3 = receipt.toObject ? receipt.toObject() : receipt;
      Promise.all([
        emitAudit({
          req,
          action: 'ADDON_PAYMENT_VERIFIED',
          resource: 'PaymentReceipt',
          resourceId: receipt._id,
          changes: { after: { addonCode: receipt.addonCode } },
        }),
        notifyMerchantAdmins(tenantId, {
          type: 'subscription_approved',
          title: 'Add-on activated',
          body: `Your paid add-on "${receipt.addonCode}" is now active.`,
          meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
        }),
        Tenant.findById(tenantId).lean().then((doc) => notifyPaymentVerified(_receiptObj3, doc)),
      ]).catch(() => {});

      return res.json({ message: 'Add-on activated', receipt });
    }

    const plan = receipt.requestedPlanId
      ? await SubscriptionPlan.findOne({ _id: receipt.requestedPlanId, isActive: true })
      : null;
    if (!plan) {
      return res.status(400).json({ message: 'Cannot verify receipt: requested plan no longer active' });
    }

    const tenantId = receipt.tenantId?._id || receipt.tenantId;
    const now = new Date();
    const planAmount = Number(plan.amount) || 0;
    const addonPortion = Math.max(0, Number(receipt.amount) - planAmount);

    const { tenant, subscription, newEnd, pendingMatch, convertedFromTrial } =
      await activateSubscriptionForTenant(tenantId, plan, {
        paymentNote: `Payment receipt verified. ${plan.name}`,
        activatedBy: req.user.id,
      });

    if (addonPortion > 0 && subscription) {
      subscription.addonAmount = addonPortion;
      subscription.amount = Number(receipt.amount) || planAmount;
      await subscription.save();
    }

    receipt.status = 'verified';
    receipt.verifiedBy = req.user.id;
    receipt.verifiedAt = now;
    receipt.subscriptionExtended = true;
    receipt.extensionDays = plan.durationDays;
    receipt.amountMatchesExpected = amountsEqual(receipt.amount, receipt.expectedAmount);
    receipt.subscriptionId = subscription._id;
    if (subscription) {
      receipt.billingPeriodStart = subscription.startDate;
      receipt.billingPeriodEnd = subscription.endDate;
    }
    receipt.updatedBy = req.user.id;
    await receipt.save();

    // Fire-and-forget audit + notifications — do not block the response
    const receiptLean = receipt.toObject ? receipt.toObject() : receipt;
    receiptLean.extensionDays = plan.durationDays;
    Promise.all([
      emitAudit({
        req,
        action: 'PAYMENT_VERIFIED',
        resource: 'PaymentReceipt',
        resourceId: receipt._id,
        changes: { after: { subscriptionExtendedTo: newEnd, extensionDays: plan.durationDays, convertedFromTrial } },
      }),
      notifySubscriptionActivated(tenant, newEnd, { pendingMatch, convertedFromTrial }),
      notifyPaymentVerified(receiptLean, tenant),
    ]).catch(() => {});

    const message = convertedFromTrial
      ? `Trial ended — subscription active until ${newEnd.toDateString()}`
      : `Subscription extended by ${plan.durationDays} days (until ${newEnd.toDateString()})`;

    res.json({ message, receipt, subscription });
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

// GET /subscriptions/my — merchant's own subscription status (lightweight; no receipt list)
router.get('/my', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId)
      .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
      .populate('pendingPlanId', 'name code amount currency billingCycle durationDays isActive');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const subscriptions = await Subscription.find({ tenantId: req.tenantId }).sort({ endDate: -1 });
    const pendingReceiptsCount = await PaymentReceipt.countDocuments({
      tenantId: req.tenantId,
      status: 'pending',
    });

    const latestReceipt = await PaymentReceipt.findOne({
      tenantId: req.tenantId,
      receiptKind: 'subscription',
    }).sort({ createdAt: -1 }).populate('requestedPlanId', 'name');

    const includeBreakdown = req.query.includeBreakdown === '1' || req.query.includeBreakdown === 'true';
    let billingBreakdown = null;
    if (includeBreakdown) {
      billingBreakdown = await computeSubscriptionRenewalExpected(tenant);
    }

    res.json({ tenant, subscriptions, pendingReceiptsCount, billingBreakdown, latestReceipt });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * POST /api/subscription/dismiss-expiry-warning
 * Records that the current user has dismissed the expiry warning banner
 */
router.post('/dismiss-expiry-warning', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'No tenant context found'
      });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Add user to the dismissedBy array if not already present
    const alreadyDismissed = tenant.subscription?.expiryWarningDismissedBy?.some(
      entry => String(entry.userId) === String(userId)
    );

    if (!alreadyDismissed) {
      if (!tenant.subscription) {
        tenant.subscription = {};
      }
      if (!tenant.subscription.expiryWarningDismissedBy) {
        tenant.subscription.expiryWarningDismissedBy = [];
      }
      
      tenant.subscription.expiryWarningDismissedBy.push({
        userId,
        dismissedAt: new Date()
      });

      await tenant.save();
    }

    res.json({
      success: true,
      message: 'Warning dismissed successfully'
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /api/subscriptions/superadmin/trial-merchants
 * Returns a list of all trialing merchants with their usage statistics, contact details, and a conversion likelihood score.
 */
router.get('/superadmin/trial-merchants', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const Store = require('../models/Store');
    const Order = require('../models/Order');
    const CafeTable = require('../models/CafeTable');
    const FloorPlan = require('../models/FloorPlan');
    const TenantSettings = require('../models/TenantSettings');

    // Find all tenants with subscriptionStatus === 'trial'
    const trialingTenants = await Tenant.find({ subscriptionStatus: 'trial' });

    const results = [];

    for (const tenant of trialingTenants) {
      // 1. Gather usage metrics
      const storeCount = await Store.countDocuments({ tenantId: tenant._id });
      const userCount = await User.countDocuments({ tenantId: tenant._id });
      const orderCount = await Order.countDocuments({ tenantId: tenant._id });
      const cafeTableCount = await CafeTable.countDocuments({ tenantId: tenant._id });
      const floorPlanCount = await FloorPlan.countDocuments({ tenantId: tenant._id });

      // 2. Fetch admin contacts
      const admins = await User.find({ tenantId: tenant._id, role: 'merchant_admin', isActive: true }, 'name email');
      const settings = await TenantSettings.findOne({ tenantId: tenant._id }, 'phone email');

      const contact = {
        phone: settings?.phone || '',
        email: settings?.email || (admins[0]?.email || ''),
        admins: admins.map(a => ({ name: a.name, email: a.email }))
      };

      // 3. Compute score
      let storeScore = 0;
      if (storeCount === 1) storeScore = 10;
      else if (storeCount > 1) storeScore = 20;

      let userScore = 0;
      if (userCount === 1) userScore = 5;
      else if (userCount >= 2 && userCount <= 3) userScore = 10;
      else if (userCount > 3) userScore = 15;

      let orderScore = 0;
      if (orderCount >= 1 && orderCount <= 9) orderScore = 10;
      else if (orderCount >= 10 && orderCount <= 49) orderScore = 20;
      else if (orderCount >= 50) orderScore = 30;

      let tableScore = 0;
      if (cafeTableCount >= 1) {
        tableScore += 10;
        if (floorPlanCount >= 1) {
          tableScore += 5;
        }
      }

      let hasAddon = false;
      let trialingAddonCount = 0;
      if (tenant.paidAddons) {
        for (const addonKey of ['qrOrdering', 'loyalty', 'tableManagement', 'uberEats']) {
          const addon = tenant.paidAddons[addonKey];
          if (addon) {
            if (addon.active) {
              hasAddon = true;
            } else if (addon.trialActivatedAt) {
              trialingAddonCount++;
            }
          }
        }
      }
      let addonScore = (hasAddon ? 10 : 0) + (trialingAddonCount * 10);

      let urgencyScore = 2;
      const trialDaysLeft = tenant.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
      if (trialDaysLeft !== null) {
        if (trialDaysLeft <= 3) urgencyScore = 10;
        else if (trialDaysLeft <= 7) urgencyScore = 5;
      }

      const score = storeScore + userScore + orderScore + tableScore + addonScore + urgencyScore;

      results.push({
        tenant: {
          _id: tenant._id,
          businessName: tenant.businessName,
          createdAt: tenant.createdAt,
          trialEndsAt: tenant.trialEndsAt,
          trialDaysLeft,
        },
        metrics: {
          stores: storeCount,
          users: userCount,
          orders: orderCount,
          cafeTables: cafeTableCount,
          floorPlans: floorPlanCount,
        },
        contact,
        score,
      });
    }

    // Sort results by score descending
    results.sort((a, b) => b.score - a.score);

    res.json(results);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
