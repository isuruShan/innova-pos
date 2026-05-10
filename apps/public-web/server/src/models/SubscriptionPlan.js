const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly', 'custom'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LKR', trim: true, uppercase: true },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    description: { type: String, default: '', trim: true },
    featureLines: { type: [String], default: [] },
    planAudience: { type: String, enum: ['local', 'international'], default: 'local', index: true },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    planTagShow: { type: Boolean, default: false },
    planTagText: { type: String, default: '', trim: true },
    planTagTextColor: { type: String, default: '#ffffff', trim: true },
    planTagBgMode: { type: String, enum: ['solid', 'gradient'], default: 'solid' },
    planTagSolidColor: { type: String, default: '#fa7237', trim: true },
    planTagGradFrom: { type: String, default: '#fa7237', trim: true },
    planTagGradTo: { type: String, default: '#233d4d', trim: true },
    planTagGradAngle: { type: Number, default: 135, min: 0, max: 360 },
    planCardBgMode: { type: String, enum: ['default', 'solid', 'gradient'], default: 'default' },
    planCardSolidColor: { type: String, default: '#ffffff', trim: true },
    planCardGradFrom: { type: String, default: '#ffffff', trim: true },
    planCardGradTo: { type: String, default: '#f1f5f9', trim: true },
    planCardGradAngle: { type: Number, default: 145, min: 0, max: 360 },
    planCardUseLightText: { type: Boolean, default: false },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ isActive: 1, isPublic: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
