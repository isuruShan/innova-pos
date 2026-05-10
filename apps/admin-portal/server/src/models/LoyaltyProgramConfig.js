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
    pointsRetentionDays: { type: Number, default: null, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyProgramConfig', loyaltyProgramConfigSchema);
