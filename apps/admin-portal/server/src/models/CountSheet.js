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
    storeType: {
      type: String,
      enum: ['Store', 'CentralKitchen'],
      default: 'Store',
      required: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'storeType',
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
countSheetSchema.index({ tenantId: 1, storeId: 1, isActive: 1 });

countSheetSchema.pre('save', async function (next) {
  if (this.isModified('storeId') && this.storeId) {
    const Store = mongoose.model('Store');
    const store = await Store.findById(this.storeId).select('_id');
    this.storeType = store ? 'Store' : 'CentralKitchen';
  }
  next();
});

module.exports = mongoose.model('CountSheet', countSheetSchema);
