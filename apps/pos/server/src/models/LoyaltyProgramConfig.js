const mongoose = require('mongoose');

/** One document per tenant — earn rules + reward redemption toggle */
const loyaltyProgramConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    /** Spend this much currency (same unit as order totals) to trigger earning block */
    spendPerEarnBlock: { type: Number, default: 100, min: 1 },
    /** Points earned per earn block */
    pointsPerEarnBlock: { type: Number, default: 1, min: 0 },
    isEnabled: { type: Boolean, default: true },
    /** Days without loyalty activity before customer is flagged for admin review (null/0 = off) */
    pointsRetentionDays: { type: Number, default: null, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyProgramConfig', loyaltyProgramConfigSchema);
