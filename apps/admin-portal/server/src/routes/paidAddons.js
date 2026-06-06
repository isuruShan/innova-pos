'use strict';

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const Tenant = require('../models/Tenant');
const { authenticateJWT, authorize, sendRouteError, resolveUploadProxyTimeoutMs } = require('@innovapos/shared-middleware');
const { ensureDefaultPaidAddons, priceAddonForPlan, getAddonByCode } = require('../lib/addonBilling');
const { buildRecurringRates } = require('../lib/billingProration');
const { getAddonPurchaseQuote } = require('../lib/addonPurchaseQuote');
const { resolveNextBillingPlan, loadTenantForBilling } = require('../lib/resolveBillingPlan');
const { applyPaidAddonExpiryIfNeeded, entitlementKeyForCode } = require('../lib/addonPeriod');
const { getAddonMerchantState } = require('../lib/addonMerchantState');
const { resolveMediaUrls } = require('../lib/resolveMediaUrls');

const router = express.Router();

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPEG, PNG, or WebP images allowed'), ok);
  },
});

/** All known paid addon codes */
const ADDON_CODES = ['loyalty', 'qr_ordering', 'table_management', 'uber_eats', 'accounting', 'dual_screen', 'whatsapp_integration'];

/** Merchant: get list of currently active add-on codes (for conditional UI rendering). */
router.get('/status', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    let tenant = await Tenant.findById(req.tenantId).select('paidAddons').lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    // Determine which addons are active for this tenant
    const activeAddons = [];
    for (const code of ADDON_CODES) {
      const entitlementKey = entitlementKeyForCode(code);
      const addon = tenant.paidAddons?.[entitlementKey];
      if (addon?.active || addon?.subscribed) {
        // Check if the addon is past its expiry date
        if (addon.expiresAt && new Date(addon.expiresAt) < new Date()) {
          continue; // Skip expired addon
        }
        activeAddons.push(code);
      }
    }

    res.json({ activeAddons });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

async function buildCatalogRow(tenant, addon, plan, billingLabel) {
  const priced = priceAddonForPlan(addon, plan, tenant.countryIso);
  const state = await getAddonMerchantState(tenant, addon.code);
  const screenshotUrls = await resolveMediaUrls(addon.screenshotUrls || []);
  const includedInPlan = plan && Array.isArray(plan.includedAddons) && plan.includedAddons.includes(addon.code);
  return {
    code: addon.code,
    name: addon.name,
    shortDescription: addon.shortDescription,
    longDescription: addon.longDescription,
    screenshotUrls,
    priced: {
      amount: priced.amount,
      monthlyAmount: priced.monthlyAmount,
      yearlyAmount: priced.yearlyAmount,
      currency: priced.currency,
      label: priced.label,
      billingCycle: priced.billingCycle,
    },
    recurringRates: buildRecurringRates(priced, plan),
    billingLabel,
    plan: plan ? { name: plan.name, billingCycle: plan.billingCycle, code: plan.code } : null,
    ...state,
    ...(includedInPlan ? {
      includedInPlan: true,
      alreadyActive: true,
      canSubscribe: false,
      canUnsubscribe: false,
      canStartTrial: false,
    } : { includedInPlan: false }),
  };
}

/** Merchant: purchasable add-ons with prices for the current billing period. */
router.get('/merchant-catalog', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    // Check global paid addons visibility setting
    const PlatformPaymentSettings = require('../models/PlatformPaymentSettings');
    const platformSettings = await PlatformPaymentSettings.findOne({ singletonKey: 'default' }).lean();
    if (platformSettings?.paidAddonsEnabled === false) {
      return res.json([]); // Return empty catalog if globally disabled
    }

    await ensureDefaultPaidAddons();
    let tenant = await loadTenantForBilling(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    tenant = await applyPaidAddonExpiryIfNeeded(tenant);

    const plan = await resolveNextBillingPlan(tenant);
    const defs = await PaidAddonDefinition.find({
      isActive: true,
      showInMerchantCatalog: { $ne: false },
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    const billingLabel =
      plan?.billingCycle === 'yearly'
        ? 'per year (your next billing cycle)'
        : 'per month (your next billing cycle)';

    const list = await Promise.all(defs.map((addon) => buildCatalogRow(tenant, addon, plan, billingLabel)));

    res.json(list);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/** Schedule unsubscribe — service remains until end of current paid period. */
router.post('/:code/unsubscribe', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toLowerCase();
    let tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    tenant = await applyPaidAddonExpiryIfNeeded(tenant);

    const entitlementKey = entitlementKeyForCode(code);
    if (!entitlementKey) {
      return res.status(400).json({ message: 'Unknown add-on' });
    }

    const addon = await getAddonByCode(code);
    const addonName = addon?.name || code;

    const state = await getAddonMerchantState(tenant, code);
    if (!state.alreadyActive) {
      return res.status(400).json({ message: 'This add-on is not active on your account' });
    }
    if (state.cancelScheduled) {
      return res.json({
        message: 'Unsubscribe is already scheduled for the end of your current period.',
        periodEndsAt: state.periodEndsAt,
      });
    }

    const ent = tenant.paidAddons?.[entitlementKey];
    if (!ent?.periodEndsAt) {
      return res.status(400).json({ message: 'Billing period end is not set. Contact support.' });
    }

    tenant.paidAddons[entitlementKey].cancelAtPeriodEnd = true;
    tenant.updatedBy = req.user.id;
    await tenant.save();

    res.json({
      message: `${addonName} will stay active until ${new Date(ent.periodEndsAt).toLocaleDateString()}, then turn off.`,
      periodEndsAt: ent.periodEndsAt,
      cancelAtPeriodEnd: true,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/** Start 7-day trial for an add-on */
router.post('/:code/start-trial', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toLowerCase();
    let tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    tenant = await applyPaidAddonExpiryIfNeeded(tenant);

    const entitlementKey = entitlementKeyForCode(code);
    if (!entitlementKey) {
      return res.status(400).json({ message: 'Unknown add-on' });
    }

    const addon = await getAddonByCode(code);
    if (!addon || !addon.isActive) {
      return res.status(404).json({ message: 'Add-on not available' });
    }

    const state = await getAddonMerchantState(tenant, code);
    
    if (!state.canStartTrial) {
      if (state.alreadyActive) {
        return res.status(400).json({ message: 'This add-on is already active' });
      }
      if (state.trialActivatedAt) {
        return res.status(400).json({ message: 'Trial has already been used for this add-on' });
      }
      if (state.pendingVerification) {
        return res.status(400).json({ message: 'Payment verification is pending for this add-on' });
      }
      return res.status(400).json({ message: 'Cannot start trial for this add-on' });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    tenant.paidAddons = tenant.paidAddons || {};
    tenant.paidAddons[entitlementKey] = {
      active: true,
      activatedAt: now,
      amountPerCycle: 0,
      currency: '',
      periodEndsAt: null,
      cancelAtPeriodEnd: false,
      trialActivatedAt: now,
      trialEndsAt: trialEnd,
      billingCycle: '',
    };
    tenant.updatedBy = req.user.id;
    await tenant.save();

    res.json({
      message: `${addon.name} trial started! You have 7 days to try it out.`,
      trialEndsAt: trialEnd,
      addon: {
        code: addon.code,
        name: addon.name,
      },
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    await ensureDefaultPaidAddons();
    const rows = await PaidAddonDefinition.find().sort({ sortOrder: 1, name: 1 }).lean();
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        screenshotUrls: row.screenshotUrls || [],
        screenshotPreviewUrls: await resolveMediaUrls(row.screenshotUrls || []),
      })),
    );
    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post(
  '/:code/screenshots',
  authenticateJWT,
  authorize('superadmin'),
  screenshotUpload.single('screenshot'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const code = String(req.params.code || '').trim().toLowerCase();
      let doc = await PaidAddonDefinition.findOne({ code });
      if (!doc) return res.status(404).json({ message: 'Add-on not found' });

      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: req.file.originalname || 'addon-screenshot.webp',
        contentType: req.file.mimetype,
      });
      form.append('type', 'addon-screenshot');
      const uploadRes = await axios.post(
        `${process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002'}/upload`,
        form,
        {
          headers: { ...form.getHeaders(), Authorization: req.headers.authorization },
          timeout: resolveUploadProxyTimeoutMs(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );
      const key = uploadRes.data?.key;
      if (!key) return res.status(500).json({ message: 'Upload did not return a file key' });

      doc.screenshotUrls = [...(doc.screenshotUrls || []), key];
      doc.updatedBy = req.user.id;
      await doc.save();

      const url = (await resolveMediaUrls([key]))[0] || '';
      res.json({ key, url, screenshotUrls: doc.screenshotUrls });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

router.put('/:code', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toLowerCase();
    const {
      name,
      shortDescription,
      longDescription,
      monthlyAmount,
      yearlyAmount,
      currency,
      internationalMonthlyAmount,
      internationalYearlyAmount,
      internationalCurrency,
      isActive,
      showInMerchantCatalog,
      sortOrder,
      screenshotUrls,
    } = req.body;

    let doc = await PaidAddonDefinition.findOne({ code });
    if (!doc) {
      doc = new PaidAddonDefinition({ code });
    }
    if (name != null) doc.name = String(name).trim();
    if (shortDescription != null) doc.shortDescription = String(shortDescription).trim();
    if (longDescription != null) doc.longDescription = String(longDescription).trim();
    if (monthlyAmount != null) doc.monthlyAmount = Math.max(0, Number(monthlyAmount) || 0);
    if (yearlyAmount != null) doc.yearlyAmount = Math.max(0, Number(yearlyAmount) || 0);
    if (currency != null) doc.currency = String(currency).trim().toUpperCase();
    if (internationalMonthlyAmount != null) {
      doc.internationalMonthlyAmount = Math.max(0, Number(internationalMonthlyAmount) || 0);
    }
    if (internationalYearlyAmount != null) {
      doc.internationalYearlyAmount = Math.max(0, Number(internationalYearlyAmount) || 0);
    }
    if (internationalCurrency != null) {
      doc.internationalCurrency = String(internationalCurrency).trim().toUpperCase();
    }
    if (isActive != null) doc.isActive = Boolean(isActive);
    if (showInMerchantCatalog != null) doc.showInMerchantCatalog = Boolean(showInMerchantCatalog);
    if (sortOrder != null) doc.sortOrder = Number(sortOrder) || 0;
    if (screenshotUrls != null) {
      doc.screenshotUrls = Array.isArray(screenshotUrls)
        ? screenshotUrls.map((u) => String(u).trim()).filter(Boolean)
        : [];
    }
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(doc);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/** Merchant: quote for an add-on based on their assigned plan billing cycle. */
router.get('/quote/:code', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    await ensureDefaultPaidAddons();
    const code = String(req.params.code || '').trim().toLowerCase();
    const addon = await getAddonByCode(code);
    if (!addon || !addon.isActive) {
      return res.status(404).json({ message: 'Add-on not available' });
    }

    let tenant = await Tenant.findById(req.tenantId).populate('assignedPlanId');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    tenant = await applyPaidAddonExpiryIfNeeded(tenant);

    const quote = await getAddonPurchaseQuote(req.tenantId, code);
    const state = await getAddonMerchantState(tenant, code);

    res.json({
      addon: {
        code: addon.code,
        name: addon.name,
        shortDescription: addon.shortDescription,
        longDescription: addon.longDescription,
        screenshotUrls: await resolveMediaUrls(addon.screenshotUrls || []),
      },
      priced: quote.priced,
      recurringRates: quote.recurringRates,
      fullCycle: quote.fullCycle,
      proration: quote.proration,
      billingLabel: quote.billingLabel,
      plan: quote.plan
        ? { name: quote.plan.name, billingCycle: quote.plan.billingCycle, code: quote.plan.code }
        : null,
      ...state,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
