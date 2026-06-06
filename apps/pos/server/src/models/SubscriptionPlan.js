const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    monthlyPrice: { type: Number, default: 0 },
    yearlyPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'LKR' },
    isActive: { type: Boolean, default: true },
    isTrialPlan: { type: Boolean, default: false },
    includedAddons: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
