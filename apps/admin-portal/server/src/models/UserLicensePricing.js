const mongoose = require('mongoose');

const STAFF_ROLES = ['merchant_admin', 'manager', 'cashier', 'kitchen'];

const userLicensePricingSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: STAFF_ROLES,
      lowercase: true,
      trim: true,
    },
    /** Sri Lanka — per billing cycle */
    userSeatMonthlyAmount: { type: Number, default: 0, min: 0 },
    userSeatYearlyAmount: { type: Number, default: 0, min: 0 },
    extraStoreMonthlyAmount: { type: Number, default: 0, min: 0 },
    extraStoreYearlyAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'LKR', trim: true, uppercase: true },
    /** Outside Sri Lanka (USD) */
    internationalUserSeatMonthlyAmount: { type: Number, default: 0, min: 0 },
    internationalUserSeatYearlyAmount: { type: Number, default: 0, min: 0 },
    internationalExtraStoreMonthlyAmount: { type: Number, default: 0, min: 0 },
    internationalExtraStoreYearlyAmount: { type: Number, default: 0, min: 0 },
    internationalCurrency: { type: String, default: 'USD', trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('UserLicensePricing', userLicensePricingSchema);
module.exports.STAFF_ROLES = STAFF_ROLES;
