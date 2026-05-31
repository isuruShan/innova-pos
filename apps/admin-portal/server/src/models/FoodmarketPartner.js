const mongoose = require('mongoose');

const foodmarketPartnerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    commissionType: {
      type: String,
      enum: ['flat', 'percentage', 'both'],
      required: true,
      default: 'percentage',
    },
    commissionFlat: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

foodmarketPartnerSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('FoodmarketPartner', foodmarketPartnerSchema);
