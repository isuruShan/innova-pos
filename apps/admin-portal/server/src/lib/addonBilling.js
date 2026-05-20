'use strict';

const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Tenant = require('../models/Tenant');
const Store = require('../models/Store');

/** First active store per tenant is included in the base plan. */
const INCLUDED_STORES_PER_TENANT = 1;

/**
 * @param {import('mongoose').LeanDocument<any>} addon
 * @param {import('mongoose').LeanDocument<any>|null} plan
 */
function priceAddonForPlan(addon, plan) {
  if (!addon || !addon.isActive) return { amount: 0, currency: addon?.currency || 'LKR', label: '' };
  const currency = addon.currency || 'LKR';
  const cycle = plan?.billingCycle || 'monthly';
  let amount = Number(addon.monthlyAmount) || 0;
  if (cycle === 'yearly') {
    const y = Number(addon.yearlyAmount) || 0;
    amount = y > 0 ? y : amount * 12;
  }
  return { amount, currency, label: addon.name };
}

async function getAddonByCode(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return null;
  return PaidAddonDefinition.findOne({ code: c }).lean();
}

const DEFAULT_QR_SCREENSHOTS = [
  '/addons/qr-ordering-menu.svg',
  '/addons/qr-ordering-cart.svg',
  '/addons/qr-ordering-order.svg',
];

const DEFAULT_ADDONS = [
  {
    code: 'qr_ordering',
    name: 'QR Ordering',
    shortDescription: 'Guests scan a QR at the table to browse your menu and send orders to the kitchen.',
    longDescription:
      'When enabled, each table has a QR code that opens a mobile-friendly ordering page. ' +
      'Guests add items to a cart and confirm; your POS staff see updates in real time. ' +
      'Pricing follows your subscription billing period (monthly or yearly).',
    screenshotUrls: DEFAULT_QR_SCREENSHOTS,
    isActive: true,
    sortOrder: 0,
  },
  {
    code: 'additional_store',
    name: 'Additional store',
    shortDescription: 'Each store beyond your first is billed on your subscription.',
    longDescription:
      'Your plan includes one store location. Every additional active store is charged per billing period at the rate set by the platform.',
    screenshotUrls: [],
    isActive: true,
    showInMerchantCatalog: false,
    sortOrder: 10,
  },
  {
    code: 'loyalty',
    name: 'Loyalty program',
    shortDescription: 'Points, tiers, and rewards so guests keep coming back.',
    longDescription:
      'Run a full loyalty program: earn points on completed orders, tier customers by lifetime spend, ' +
      'offer point-based and automatic rewards at checkout, and manage retention from the admin portal. ' +
      'Pricing follows your subscription billing period (monthly or yearly).',
    screenshotUrls: [],
    isActive: true,
    sortOrder: 1,
  },
];

async function ensureDefaultPaidAddons() {
  for (const defaults of DEFAULT_ADDONS) {
    const { code, ...rest } = defaults;
    const existing = await PaidAddonDefinition.findOne({ code });
    if (!existing) {
      await PaidAddonDefinition.create({
        code,
        monthlyAmount: 0,
        yearlyAmount: 0,
        currency: 'LKR',
        ...rest,
      });
      continue;
    }
    let changed = false;
    if (existing.name !== defaults.name) {
      existing.name = defaults.name;
      changed = true;
    }
    if (code === 'qr_ordering' && !existing.screenshotUrls?.length) {
      existing.screenshotUrls = defaults.screenshotUrls;
      changed = true;
    }
    if (existing.showInMerchantCatalog !== defaults.showInMerchantCatalog) {
      existing.showInMerchantCatalog = defaults.showInMerchantCatalog;
      changed = true;
    }
    if (changed) await existing.save();
  }
}

async function countActiveStoresForTenant(tenantId) {
  return Store.countDocuments({ tenantId, isActive: true });
}

/**
 * Subscription line for stores beyond the included first location.
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {import('mongoose').LeanDocument<any>|null} plan
 */
async function computeAdditionalStoresSubscriptionLine(tenantId, plan) {
  await ensureDefaultPaidAddons();
  const addon = await getAddonByCode('additional_store');
  if (!addon || !addon.isActive) return null;

  const activeCount = await countActiveStoresForTenant(tenantId);
  const extra = Math.max(0, activeCount - INCLUDED_STORES_PER_TENANT);
  if (extra <= 0) return null;

  const priced = priceAddonForPlan(addon, plan);
  const unit = Number(priced.amount) || 0;
  if (unit <= 0) return null;

  return {
    code: 'additional_store',
    label: extra === 1 ? 'Additional store' : `Additional stores (×${extra})`,
    amount: unit * extra,
    quantity: extra,
    unitAmount: unit,
    currency: priced.currency,
  };
}

/**
 * Preview charge when merchant adds another store (before or after create).
 */
async function previewAdditionalStoreCharge(tenantId, plan) {
  const addon = await getAddonByCode('additional_store');
  const priced = addon && addon.isActive ? priceAddonForPlan(addon, plan) : { amount: 0, currency: 'LKR' };
  const activeCount = await countActiveStoresForTenant(tenantId);
  const extraAfterOneMore = Math.max(0, activeCount + 1 - INCLUDED_STORES_PER_TENANT);
  const extraNow = Math.max(0, activeCount - INCLUDED_STORES_PER_TENANT);
  const unit = Number(priced.amount) || 0;
  return {
    activeStoreCount: activeCount,
    includedStores: INCLUDED_STORES_PER_TENANT,
    extraStoresBilled: extraNow,
    extraStoresAfterCreate: extraAfterOneMore,
    unitAmount: unit,
    currency: priced.currency,
    willChargeOnSubscription: extraAfterOneMore > 0,
    addedPerCycle: extraAfterOneMore > extraNow ? unit : 0,
    billingLabel:
      plan?.billingCycle === 'yearly' ? 'per year (matches your yearly plan)' : 'per month (matches your monthly plan)',
  };
}

/**
 * Expected bank-transfer amount for subscription renewal (plan + active paid add-ons).
 */
async function computeSubscriptionRenewalExpected(tenant) {
  const t = await Tenant.findById(tenant._id || tenant)
    .populate('assignedPlanId')
    .lean();
  if (!t) return { plan: null, addons: [], total: 0, currency: 'LKR' };

  const planDoc = t.assignedPlanId;
  const plan =
    planDoc && typeof planDoc === 'object' && planDoc._id
      ? planDoc
      : await SubscriptionPlan.findOne({ _id: t.assignedPlanId, isActive: true }).lean();

  if (!plan) return { plan: null, addons: [], total: 0, currency: 'LKR' };

  const addons = [];
  let addonTotal = 0;
  const { isQrOrderingEffective, isLoyaltyEffective } = require('./addonPeriod');
  const renewalRows = [
    { code: 'qr_ordering', label: 'QR Ordering', key: 'qrOrdering', check: isQrOrderingEffective },
    { code: 'loyalty', label: 'Loyalty program', key: 'loyalty', check: isLoyaltyEffective },
  ];
  for (const row of renewalRows) {
    const ent = t.paidAddons?.[row.key];
    if (row.check(t.paidAddons) && ent?.amountPerCycle > 0) {
      addons.push({
        code: row.code,
        label: row.label,
        amount: Number(ent.amountPerCycle) || 0,
      });
      addonTotal += Number(ent.amountPerCycle) || 0;
    }
  }

  const storeLine = await computeAdditionalStoresSubscriptionLine(t._id, plan);
  if (storeLine) {
    addons.push({
      code: storeLine.code,
      label: storeLine.label,
      amount: storeLine.amount,
      quantity: storeLine.quantity,
    });
    addonTotal += storeLine.amount;
  }

  const base = Number(plan.amount) || 0;
  const currency = plan.currency || 'LKR';
  return {
    plan: { _id: plan._id, name: plan.name, code: plan.code, amount: base, currency, billingCycle: plan.billingCycle },
    addons,
    total: base + addonTotal,
    currency,
  };
}

module.exports = {
  priceAddonForPlan,
  getAddonByCode,
  ensureDefaultPaidAddons,
  computeSubscriptionRenewalExpected,
  computeAdditionalStoresSubscriptionLine,
  previewAdditionalStoreCharge,
  INCLUDED_STORES_PER_TENANT,
};
