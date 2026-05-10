const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    name: { type: String, default: '', trim: true },
    birthday: { type: Date, default: null },
    mobile: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    /** Lifetime loyalty points (accrued on completed orders) */
    lifetimePoints: { type: Number, default: 0, min: 0 },
    /** Last earn/redeem/order-with-customer activity (for retention policy) */
    lastLoyaltyActivityAt: { type: Date, default: null },
    /** When set, tier perks use this level instead of points-derived tier */
    loyaltyTierOverrideLevel: { type: Number, default: null, min: 1 },
    retentionStatus: {
      type: String,
      enum: ['ok', 'pending_review'],
      default: 'ok',
      index: true,
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

customerSchema.index({ tenantId: 1, email: 1 });
customerSchema.index({ tenantId: 1, mobile: 1 });
customerSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);
