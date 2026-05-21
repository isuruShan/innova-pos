'use strict';

const UserLicensePricing = require('../models/UserLicensePricing');
const { isLocalMerchant } = require('../utils/merchantRegion');

const DEFAULT_ROWS = [
  { role: 'merchant_admin', sortOrder: 0 },
  { role: 'manager', sortOrder: 1 },
  { role: 'cashier', sortOrder: 2 },
  { role: 'kitchen', sortOrder: 3 },
];

async function ensureDefaultUserLicensePricing() {
  for (const row of DEFAULT_ROWS) {
    const existing = await UserLicensePricing.findOne({ role: row.role });
    if (!existing) {
      await UserLicensePricing.create({ ...row, currency: 'LKR', internationalCurrency: 'USD' });
    }
  }
}

function pickAmounts(doc, countryIso, kind) {
  const local = isLocalMerchant(countryIso);
  if (kind === 'userSeat') {
    return {
      monthly: local ? doc.userSeatMonthlyAmount : doc.internationalUserSeatMonthlyAmount,
      yearly: local ? doc.userSeatYearlyAmount : doc.internationalUserSeatYearlyAmount,
      currency: local ? doc.currency : doc.internationalCurrency,
      label: `${doc.role} user seat`,
    };
  }
  return {
    monthly: local ? doc.extraStoreMonthlyAmount : doc.internationalExtraStoreMonthlyAmount,
    yearly: local ? doc.extraStoreYearlyAmount : doc.internationalExtraStoreYearlyAmount,
    currency: local ? doc.currency : doc.internationalCurrency,
    label: `Extra store (${doc.role})`,
  };
}

/**
 * Price object compatible with computeProratedAddonCharge.
 */
async function getRolePricing(role, countryIso, kind) {
  await ensureDefaultUserLicensePricing();
  const doc = await UserLicensePricing.findOne({ role: String(role).toLowerCase(), isActive: true }).lean();
  if (!doc) {
    const cur = isLocalMerchant(countryIso) ? 'LKR' : 'USD';
    return { monthlyAmount: 0, yearlyAmount: 0, currency: cur, name: kind === 'userSeat' ? 'User seat' : 'Extra store' };
  }
  const picked = pickAmounts(doc, countryIso, kind);
  return {
    monthlyAmount: Number(picked.monthly) || 0,
    yearlyAmount: Number(picked.yearly) || 0,
    currency: picked.currency || (isLocalMerchant(countryIso) ? 'LKR' : 'USD'),
    name: picked.label,
  };
}

module.exports = {
  ensureDefaultUserLicensePricing,
  getRolePricing,
  pickAmounts,
};
