const mongoose = require('mongoose');

const loyaltyRewardSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    pointsCost: { type: Number, required: true, min: 1 },
    rewardType: {
      type: String,
      enum: ['order_discount_amount', 'order_discount_percent', 'free_item'],
      default: 'order_discount_amount',
    },
    /** Fixed discount amount in currency */
    discountAmount: { type: Number, default: 0, min: 0 },
    /** Percent off order */
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    freeMenuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
    /** Optional: only members at or above this tier level may redeem */
    minTierLevel: { type: Number, default: 1, min: 1 },
    active: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

loyaltyRewardSchema.index({ tenantId: 1, approvalStatus: 1 });
loyaltyRewardSchema.index({ tenantId: 1, storeId: 1, active: 1 });

module.exports = mongoose.model('LoyaltyReward', loyaltyRewardSchema);
