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
    /** Single-line bullets for public pricing cards (admin-managed). */
    featureLines: { type: [String], default: [] },
    /** Sri Lanka vs international pricing catalogues */
    planAudience: { type: String, enum: ['local', 'international'], default: 'local', index: true },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    /** Optional ribbon above the plan card (public pricing / marketing). */
    planTagShow: { type: Boolean, default: false },
    planTagText: { type: String, default: '', trim: true },
    planTagTextColor: { type: String, default: '#ffffff', trim: true },
    planTagBgMode: { type: String, enum: ['solid', 'gradient'], default: 'solid' },
    planTagSolidColor: { type: String, default: '#fa7237', trim: true },
    planTagGradFrom: { type: String, default: '#fa7237', trim: true },
    planTagGradTo: { type: String, default: '#233d4d', trim: true },
    planTagGradAngle: { type: Number, default: 135, min: 0, max: 360 },
    /** Card surface; default = built-in featured vs plain styling */
    planCardBgMode: { type: String, enum: ['default', 'solid', 'gradient'], default: 'default' },
    planCardSolidColor: { type: String, default: '#ffffff', trim: true },
    planCardGradFrom: { type: String, default: '#ffffff', trim: true },
    planCardGradTo: { type: String, default: '#f1f5f9', trim: true },
    planCardGradAngle: { type: Number, default: 145, min: 0, max: 360 },
    /** When card uses custom solid/gradient: true = light text (dark backgrounds) */
    planCardUseLightText: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ isActive: 1, isPublic: 1 });
subscriptionPlanSchema.index({ isDefault: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
