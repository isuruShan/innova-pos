const mongoose = require('mongoose');

const changeHistoryEntrySchema = new mongoose.Schema({
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now },
  action: { type: String, enum: ['created', 'updated', 'approved', 'rejected'], required: true },
  previousValues: { type: mongoose.Schema.Types.Mixed },
  newValues: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, default: '' },
}, { _id: true });

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
    redemptionType: {
      type: String,
      enum: ['points', 'automatic'],
      default: 'points',
    },
    pointsCost: { type: Number, default: 0, min: 0 },
    rewardType: {
      type: String,
      enum: ['order_discount_amount', 'order_discount_percent', 'free_item', 'points_earning'],
      default: 'order_discount_amount',
    },
    pointsEarning: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    freeMenuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
    applicableItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
    applicableVariantIds: [{ type: mongoose.Schema.Types.ObjectId, default: null }],
    applicableCategories: [{ type: String }],
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minTierLevel: { type: Number, default: 1, min: 1 },
    foodmarketPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodmarketPartner',
      default: null,
      index: true,
    },
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
    changeHistory: [changeHistoryEntrySchema],
  },
  { timestamps: true }
);

loyaltyRewardSchema.index({ tenantId: 1, approvalStatus: 1 });
loyaltyRewardSchema.index({ tenantId: 1, storeId: 1, active: 1 });

loyaltyRewardSchema.pre('validate', function validatePointsVsRedemption() {
  const rt = this.redemptionType || 'points';
  if (rt === 'automatic') {
    this.pointsCost = 0;
  } else if (!this.pointsCost || this.pointsCost < 1) {
    throw new Error('Points cost must be at least 1 for point-redemption rewards');
  }
});

module.exports = mongoose.model('LoyaltyReward', loyaltyRewardSchema);
