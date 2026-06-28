const mongoose = require('mongoose');

const inventoryCountSessionItemSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    theoreticalQty: {
      type: Number,
      default: 0,
    },
    countedQty: {
      type: Number,
      default: null, // Null indicates not counted yet
    },
    costPrice: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const inventoryCountSessionSchema = new mongoose.Schema(
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
    countSheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CountSheet',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'cancelled'],
      default: 'active',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [inventoryCountSessionItemSchema],
    notes: {
      type: String,
      default: '',
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

inventoryCountSessionSchema.index({ tenantId: 1, storeId: 1, status: 1 });
inventoryCountSessionSchema.index({ tenantId: 1, storeId: 1, userId: 1 });

inventoryCountSessionSchema.pre('save', async function (next) {
  if (this.isModified('storeId') && this.storeId) {
    const Store = mongoose.model('Store');
    const store = await Store.findById(this.storeId).select('_id');
    this.storeType = store ? 'Store' : 'CentralKitchen';
  }
  next();
});

module.exports = mongoose.model('InventoryCountSession', inventoryCountSessionSchema);
