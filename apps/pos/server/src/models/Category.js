const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Category name unique per tenant
categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
