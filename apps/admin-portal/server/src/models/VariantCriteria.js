const mongoose = require('mongoose');

const variantCriteriaSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    values: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

variantCriteriaSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('VariantCriteria', variantCriteriaSchema);
