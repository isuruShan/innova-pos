'use strict';

const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Tenant = require('../models/Tenant');

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

async function ensureDefaultPaidAddons() {
  const defaults = {
    name: 'QR Ordering',
    shortDescription: 'Guests scan a QR at the table to browse your menu and send orders to the kitchen.',
    longDescription:
      'When enabled, each table has a QR code that opens a mobile-friendly ordering page. ' +
      'Guests add items to a cart and confirm; your POS staff see updates in real time. ' +
      'Pricing follows your subscription billing period (monthly or yearly).',
    screenshotUrls: DEFAULT_QR_SCREENSHOTS,
    isActive: true,
    sortOrder: 0,
  };
  const existing = await PaidAddonDefinition.findOne({ code: 'qr_ordering' });
  if (!existing) {
    await PaidAddonDefinition.create({
      code: 'qr_ordering',
      monthlyAmount: 0,
      yearlyAmount: 0,
      currency: 'LKR',
      ...defaults,
    });
    return;
  }
  let changed = false;
  if (existing.name !== defaults.name) {
    existing.name = defaults.name;
    changed = true;
  }
  if (!existing.screenshotUrls?.length) {
    existing.screenshotUrls = defaults.screenshotUrls;
    changed = true;
  }
  if (changed) await existing.save();
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
  const { isQrOrderingEffective } = require('./addonPeriod');
  const qr = t.paidAddons?.qrOrdering;
  if (isQrOrderingEffective(t.paidAddons) && qr.amountPerCycle > 0) {
    addons.push({
      code: 'qr_ordering',
      label: 'QR Ordering',
      amount: Number(qr.amountPerCycle) || 0,
    });
    addonTotal += Number(qr.amountPerCycle) || 0;
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
};
