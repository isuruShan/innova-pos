const mongoose = require('mongoose');

const inventoryCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Inventory Category name unique per tenant/store
inventoryCategorySchema.index({ tenantId: 1, storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('InventoryCategory', inventoryCategorySchema);
