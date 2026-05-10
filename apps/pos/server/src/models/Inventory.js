const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    itemName: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    minThreshold: { type: Number, required: true, min: 0 },
    suppliers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
    lastUpdated: { type: Date, default: Date.now },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

inventorySchema.index({ tenantId: 1, itemName: 1 });
inventorySchema.index({ tenantId: 1, storeId: 1, itemName: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
