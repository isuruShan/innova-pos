const mongoose = require('mongoose');

const loyaltyProgramConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    spendPerEarnBlock: { type: Number, default: 100, min: 1 },
    pointsPerEarnBlock: { type: Number, default: 1, min: 0 },
    isEnabled: { type: Boolean, default: true },
    /** @deprecated use pointsRetentionMode */
    pointsRetentionDays: { type: Number, default: null, min: 0 },
    pointsRetentionMode: {
      type: String,
      enum: ['none', 'monthly', 'quarterly', 'yearly'],
      default: 'none',
    },
    pointsRetentionStartDate: { type: Date, default: null },
    retentionDowngradeToLevel1: { type: Boolean, default: false },
    pointsRetentionLastProcessedEnd: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyProgramConfig', loyaltyProgramConfigSchema);
