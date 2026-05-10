const mongoose = require('mongoose');

const loyaltyTierSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    /** Display order (1 = entry level) */
    level: { type: Number, required: true, min: 1 },
    /** Minimum lifetime points required to reach this tier */
    minLifetimePoints: { type: Number, required: true, min: 0, default: 0 },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

loyaltyTierSchema.index({ tenantId: 1, minLifetimePoints: 1 });

module.exports = mongoose.model('LoyaltyTier', loyaltyTierSchema);
