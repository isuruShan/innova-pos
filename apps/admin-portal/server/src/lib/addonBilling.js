'use strict';

const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Tenant = require('../models/Tenant');
const Store = require('../models/Store');
const { isLocalMerchant } = require('../utils/merchantRegion');
const User = require('../models/User');
const { getRolePricing } = require('./userLicensePricing');


/** First active store per tenant is included in the base plan. */
const INCLUDED_STORES_PER_TENANT = 1;

/**
 * @param {import('mongoose').LeanDocument<any>} addon
 * @param {import('mongoose').LeanDocument<any>|null} plan
 * @param {string} [countryIso] Tenant country — LK uses local LKR prices; others use international USD prices.
 */
function priceAddonForPlan(addon, plan, countryIso = 'LK') {
  if (!addon || !addon.isActive) {
    const fallbackCur = isLocalMerchant(countryIso) ? 'LKR' : 'USD';
    return {
      amount: 0,
      monthlyAmount: 0,
      yearlyAmount: 0,
      currency: fallbackCur,
      label: '',
      billingCycle: plan?.billingCycle || 'monthly',
    };
  }
  const local = isLocalMerchant(countryIso);
  const currency = local
    ? (addon.currency || 'LKR')
    : (addon.internationalCurrency || 'USD');
  const cycle = plan?.billingCycle || 'monthly';
  const monthlyAmount = local
    ? Number(addon.monthlyAmount) || 0
    : Number(addon.internationalMonthlyAmount) || 0;
  const yearlyAmount = local
    ? Number(addon.yearlyAmount) || 0
    : Number(addon.internationalYearlyAmount) || 0;
  let amount = monthlyAmount;
  if (cycle === 'yearly') {
    amount = yearlyAmount > 0 ? yearlyAmount : monthlyAmount * 12;
  }
  return {
    amount,
    monthlyAmount,
    yearlyAmount: yearlyAmount > 0 ? yearlyAmount : monthlyAmount * 12,
    currency,
    label: addon.name,
    billingCycle: cycle,
  };
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
  {
    code: 'table_management',
    name: 'Table Management',
    shortDescription: 'Visual floor plans, reservations, waitlist, and table analytics.',
    longDescription:
      'Full table management suite: design your floor layout with drag-and-drop, accept online/phone reservations with SMS confirmations, ' +
      'manage walk-in waitlists with accurate wait times, and track table turnover and revenue per cover. ' +
      'Pricing follows your subscription billing period (monthly or yearly).',
    screenshotUrls: [],
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'uber_eats',
    name: 'Uber Eats Integration',
    shortDescription: 'Connect your restaurant to Uber Eats. Manage orders and sync rider updates directly in the POS.',
    longDescription:
      'Receive Uber Eats orders directly into your kitchen and cashier queues. Keeps status updates, item availability, and rider tracking synced automatically. ' +
      'Pricing follows your subscription billing period (monthly or yearly).',
    screenshotUrls: [],
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'accounting',
    name: 'Advanced Accounting Module',
    shortDescription: 'Double-entry bookkeeping, payroll management, creditors, debtors, and automated tax statements.',
    longDescription: 'Automates accounting records directly from checkout sales. Configure custom tax rates, run staff payroll, track debtor/creditor balances, and instantly export P&L reports, Cash Flow sheets, and Balance Sheets.',
    isActive: true,
    sortOrder: 4,
  },
  {
    code: 'dual_screen',
    name: 'Dual Screen Customer Terminal',
    shortDescription: 'Show order details, promotions, and scan-to-check-in on a customer-facing secondary display.',
    longDescription: 'Enable the secondary customer terminal screen to display items as they are added, present custom branding, run discount promotions, and allow guests to sign in or register via QR code/phone. Pricing follows your subscription billing period (monthly or yearly).',
    isActive: true,
    sortOrder: 5,
  },
  {
    code: 'whatsapp_integration',
    name: 'WhatsApp Business Integration',
    shortDescription: 'Sync menus to WhatsApp catalog, receive customer orders, send status updates, and support scheduled delivery/pickup.',
    longDescription: 'Manage customer ordering directly through WhatsApp. Supports automatic menu catalog sync, customer details acquisition, pickup/delivery scheduling, and status update notifications. Pricing follows your subscription cycle.',
    isActive: true,
    sortOrder: 6,
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

  const tenant = await Tenant.findById(tenantId).select('countryIso').lean();
  const priced = priceAddonForPlan(addon, plan, tenant?.countryIso);
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
  const tenant = await Tenant.findById(tenantId).select('countryIso').lean();
  const addon = await getAddonByCode('additional_store');
  const priced =
    addon && addon.isActive
      ? priceAddonForPlan(addon, plan, tenant?.countryIso)
      : { amount: 0, currency: isLocalMerchant(tenant?.countryIso) ? 'LKR' : 'USD' };
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
async function computeSubscriptionRenewalExpected(tenant, planOverride = null, options = {}) {
  const { excludeAddons = [] } = options;
  const excludeSet = new Set(
    (Array.isArray(excludeAddons) ? excludeAddons : [])
      .map(c => String(c).trim().toLowerCase())
  );

  const { resolveNextBillingPlan } = require('./resolveBillingPlan');
  const t = await Tenant.findById(tenant._id || tenant)
    .populate('assignedPlanId')
    .populate('pendingPlanId')
    .lean();
  if (!t) return { plan: null, addons: [], total: 0, currency: 'LKR' };

  const plan = planOverride || (await resolveNextBillingPlan(t));
  if (!plan) return { plan: null, addons: [], total: 0, currency: 'LKR' };

  const addons = [];
  let addonTotal = 0;
  const { isQrOrderingEffective, isLoyaltyEffective, isTableManagementEffective, isUberEatsEffective, isAccountingEffective, isDualScreenEffective, isWhatsappEffective } = require('./addonPeriod');
  const renewalRows = [
    { code: 'qr_ordering', label: 'QR Ordering', key: 'qrOrdering', check: isQrOrderingEffective },
    { code: 'loyalty', label: 'Loyalty program', key: 'loyalty', check: isLoyaltyEffective },
    { code: 'table_management', label: 'Table Management', key: 'tableManagement', check: isTableManagementEffective },
    { code: 'uber_eats', label: 'Uber Eats Integration', key: 'uberEats', check: isUberEatsEffective },
    { code: 'accounting', label: 'Advanced Accounting Module', key: 'accounting', check: isAccountingEffective },
    { code: 'dual_screen', label: 'Dual Screen Customer Terminal', key: 'dualScreen', check: isDualScreenEffective },
    { code: 'whatsapp_integration', label: 'WhatsApp Business Integration', key: 'whatsapp', check: isWhatsappEffective },
  ];
  for (const row of renewalRows) {
    if (excludeSet.has(row.code)) {
      continue;
    }
    if (plan && Array.isArray(plan.includedAddons) && plan.includedAddons.includes(row.code)) {
      continue;
    }
    if (!row.check(t)) continue;
    
    // If the merchant has scheduled to unsubscribe / cancel this addon at the period end,
    // do not charge or show it in the next billing cycle renewal breakdown.
    const entKey = row.key;
    const ent = t.paidAddons?.[entKey];
    if (ent?.cancelAtPeriodEnd) {
      continue;
    }

    const addonDef = await getAddonByCode(row.code);
    const priced =
      addonDef && addonDef.isActive ? priceAddonForPlan(addonDef, plan, t.countryIso) : { amount: 0 };
    const amount = Number(priced.amount) || 0;
    if (amount <= 0) continue;
    addons.push({
      code: row.code,
      label: row.label,
      amount,
    });
    addonTotal += amount;
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

  // Get all users for the tenant (inactive users are still billed until deleted)
  const allUsers = await User.find({ tenantId: t._id })
    .sort({ createdAt: 1 })
    .lean();

  const usersDetail = [];
  if (allUsers.length > 0) {
    const cycle = plan.billingCycle || 'monthly';

    // First user is free for seat, but check if they have extra store slots
    let firstUserExtraStoreSlots = 0;
    let firstUserExtraStoreCost = 0;
    if (allUsers[0].role !== 'merchant_admin') {
      firstUserExtraStoreSlots = Math.max(0, (allUsers[0].licensedStoreSlots || 1) - 1);
      if (firstUserExtraStoreSlots > 0) {
        const storePricing = await getRolePricing(allUsers[0].role, t.countryIso, 'extraStore');
        const extraStoreUnit = cycle === 'yearly' ? storePricing.yearlyAmount : storePricing.monthlyAmount;
        firstUserExtraStoreCost = extraStoreUnit * firstUserExtraStoreSlots;
      }
    }

    usersDetail.push({
      name: allUsers[0].name,
      email: allUsers[0].email,
      role: allUsers[0].role,
      isActive: allUsers[0].isActive !== false,
      cost: firstUserExtraStoreCost,
      isFree: firstUserExtraStoreCost <= 0,
      seatCost: 0,
      extraStoreSlots: firstUserExtraStoreSlots,
      extraStoreSlotsCost: firstUserExtraStoreCost,
    });

    if (allUsers.length > 1) {
      const billableUsers = allUsers.slice(1);
      const usersByRole = {};
      for (const u of billableUsers) {
        const r = u.role || 'cashier';
        usersByRole[r] = (usersByRole[r] || 0) + 1;
      }

      for (const [role, count] of Object.entries(usersByRole)) {
        const pricing = await getRolePricing(role, t.countryIso, 'userSeat');
        const unit = cycle === 'yearly' ? pricing.yearlyAmount : pricing.monthlyAmount;
        if (unit > 0) {
          const totalAmount = unit * count;
          const roleLabel = role
            .split('_')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          
          addons.push({
            code: `user_license_${role}`,
            label: count === 1 ? `${roleLabel} User Seat` : `${roleLabel} User Seats`,
            amount: totalAmount,
            quantity: count,
            unitAmount: unit,
            currency: pricing.currency,
          });
          addonTotal += totalAmount;
        }
      }

      for (const u of billableUsers) {
        const pricing = await getRolePricing(u.role, t.countryIso, 'userSeat');
        const seatUnit = cycle === 'yearly' ? pricing.yearlyAmount : pricing.monthlyAmount;
        
        let extraStoreUnit = 0;
        let extraStoreSlots = 0;
        if (u.role !== 'merchant_admin') {
          extraStoreSlots = Math.max(0, (u.licensedStoreSlots || 1) - 1);
          if (extraStoreSlots > 0) {
            const storePricing = await getRolePricing(u.role, t.countryIso, 'extraStore');
            extraStoreUnit = cycle === 'yearly' ? storePricing.yearlyAmount : storePricing.monthlyAmount;
          }
        }
        const userTotalCost = seatUnit + (extraStoreSlots * extraStoreUnit);

        usersDetail.push({
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive !== false,
          cost: userTotalCost,
          isFree: userTotalCost <= 0,
          seatCost: seatUnit,
          extraStoreSlots,
          extraStoreSlotsCost: extraStoreSlots * extraStoreUnit,
        });
      }
    }

    // Now calculate and add extra store slots for all users to addons list
    const extraStoreSlotsByRole = {};
    for (const u of allUsers) {
      if (u.role === 'merchant_admin') continue;
      const extraSlots = Math.max(0, (u.licensedStoreSlots || 1) - 1);
      if (extraSlots > 0) {
        extraStoreSlotsByRole[u.role] = (extraStoreSlotsByRole[u.role] || 0) + extraSlots;
      }
    }

    for (const [role, count] of Object.entries(extraStoreSlotsByRole)) {
      const pricing = await getRolePricing(role, t.countryIso, 'extraStore');
      const unit = cycle === 'yearly' ? pricing.yearlyAmount : pricing.monthlyAmount;
      if (unit > 0) {
        const totalAmount = unit * count;
        const roleLabel = role
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        
        addons.push({
          code: `user_extra_stores_${role}`,
          label: count === 1 ? `${roleLabel} Extra Store Slot` : `${roleLabel} Extra Store Slots`,
          amount: totalAmount,
          quantity: count,
          unitAmount: unit,
          currency: pricing.currency,
        });
        addonTotal += totalAmount;
      }
    }
  }

  // Get active stores details for the tenant
  const storesDetail = [];
  const activeStores = await Store.find({ tenantId: t._id, isActive: true })
    .sort({ createdAt: 1 })
    .lean();

  if (activeStores.length > 0) {
    storesDetail.push({
      name: activeStores[0].name,
      code: activeStores[0].code,
      city: activeStores[0].address?.city || '',
      cost: 0,
      isFree: true,
    });

    if (activeStores.length > 1) {
      const extraStores = activeStores.slice(1);
      const addon = await getAddonByCode('additional_store');
      const priced = addon && addon.isActive ? priceAddonForPlan(addon, plan, t.countryIso) : { amount: 0 };
      const unit = Number(priced.amount) || 0;

      for (const s of extraStores) {
        storesDetail.push({
          name: s.name,
          code: s.code,
          city: s.address?.city || '',
          cost: unit,
          isFree: unit <= 0,
        });
      }
    }
  }

  const base = Number(plan.amount) || 0;
  const currency = plan.currency || 'LKR';
  return {
    plan: {
      _id: plan._id,
      name: plan.name,
      code: plan.code,
      amount: base,
      currency,
      billingCycle: plan.billingCycle,
      isScheduledChange: Boolean(t.pendingPlanId),
    },
    addons,
    storesDetail,
    usersDetail,
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
