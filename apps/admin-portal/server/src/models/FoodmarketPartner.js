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
    /** Logo image URL for display in order types */
    logoUrl: {
      type: String,
      default: '',
    },
    /** Logo storage key (for S3/Blob) */
    logoKey: {
      type: String,
      default: '',
    },
    /** Icon emoji fallback if no logo */
    icon: {
      type: String,
      default: '🛵',
    },
    /** Display color for badges */
    color: {
      type: String,
      default: '#10b981',
    },
  },
  { timestamps: true }
);

foodmarketPartnerSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('FoodmarketPartner', foodmarketPartnerSchema);
