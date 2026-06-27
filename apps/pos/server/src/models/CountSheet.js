const mongoose = require('mongoose');

const countSheetItemSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const countSheetSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    storageAreas: [{
      type: String,
    }],
    items: [countSheetItemSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

countSheetSchema.index({ tenantId: 1, storeId: 1, name: 1 });

module.exports = mongoose.model('CountSheet', countSheetSchema);
