'use strict';

const express = require('express');
const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const Tenant = require('../models/Tenant');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');
const { ensureDefaultPaidAddons, priceAddonForPlan, getAddonByCode } = require('../lib/addonBilling');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { tenantPlanAudience } = require('../utils/planAudience');

const router = express.Router();

/** Resolve plan document used to price add-ons for this tenant (same rules as GET /quote/:code). */
async function resolvePlanForTenantAddons(tenant) {
  const audience = tenantPlanAudience(tenant.countryIso);
  let plan = tenant.assignedPlanId;
  if (plan && typeof plan === 'object' && plan._id) {
    return plan;
  }
  if (tenant.assignedPlanId) {
    return SubscriptionPlan.findOne({
      _id: tenant.assignedPlanId,
      isActive: true,
      planAudience: audience,
    }).lean();
  }
  return SubscriptionPlan.findOne({ isActive: true, isDefault: true, planAudience: audience })
    .sort({ createdAt: 1 })
    .lean();
}

function addonAlreadyActive(tenant, code) {
  const c = String(code || '').trim().toLowerCase();
  if (c === 'qr_ordering') return Boolean(tenant.paidAddons?.qrOrdering?.active);
  return false;
}

/** Merchant: purchasable add-ons with prices for the current billing period. */
router.get('/merchant-catalog', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    await ensureDefaultPaidAddons();
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const plan = await resolvePlanForTenantAddons(tenant);
    const defs = await PaidAddonDefinition.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    const billingLabel =
      plan?.billingCycle === 'yearly' ? 'per year (matches your yearly plan)' : 'per month (matches your monthly plan)';

    const list = defs.map((addon) => {
      const priced = priceAddonForPlan(addon, plan);
      return {
        code: addon.code,
        name: addon.name,
        shortDescription: addon.shortDescription,
        longDescription: addon.longDescription,
        priced,
        billingLabel,
        plan: plan ? { name: plan.name, billingCycle: plan.billingCycle, code: plan.code } : null,
        alreadyActive: addonAlreadyActive(tenant, addon.code),
      };
    });

    res.json(list);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    await ensureDefaultPaidAddons();
    const rows = await PaidAddonDefinition.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(rows);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

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
      isActive,
      sortOrder,
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
    if (isActive != null) doc.isActive = Boolean(isActive);
    if (sortOrder != null) doc.sortOrder = Number(sortOrder) || 0;
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

    const tenant = await Tenant.findById(req.tenantId).populate('assignedPlanId').lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const plan = await resolvePlanForTenantAddons(tenant);

    const priced = priceAddonForPlan(addon, plan);
    const billingLabel =
      plan?.billingCycle === 'yearly' ? 'per year (matches your yearly plan)' : 'per month (matches your monthly plan)';

    res.json({
      addon: {
        code: addon.code,
        name: addon.name,
        shortDescription: addon.shortDescription,
        longDescription: addon.longDescription,
      },
      priced,
      billingLabel,
      plan: plan
        ? { name: plan.name, billingCycle: plan.billingCycle, code: plan.code }
        : null,
      alreadyActive: addonAlreadyActive(tenant, code),
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
