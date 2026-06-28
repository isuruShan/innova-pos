const mongoose = require('mongoose');

const stockTransferItemSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    qtySent: {
      type: Number,
      required: true,
      min: 0,
    },
    qtyReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const stockTransferSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    sourceStoreType: {
      type: String,
      enum: ['Store', 'CentralKitchen'],
      default: 'Store',
      required: true,
    },
    sourceStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'sourceStoreType',
      required: true,
      index: true,
    },
    targetStoreType: {
      type: String,
      enum: ['Store', 'CentralKitchen'],
      default: 'Store',
      required: true,
    },
    targetStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'targetStoreType',
      required: true,
      index: true,
    },
    transferNumber: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'shipped', 'received', 'rejected'],
      default: 'pending',
      index: true,
    },
    items: [stockTransferItemSchema],
    shippedAt: {
      type: Date,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

stockTransferSchema.index({ tenantId: 1, sourceStoreId: 1, status: 1 });
stockTransferSchema.index({ tenantId: 1, targetStoreId: 1, status: 1 });
stockTransferSchema.index({ transferNumber: 1 }, { sparse: true });

stockTransferSchema.pre('save', async function (next) {
  if (this.isModified('sourceStoreId') && this.sourceStoreId) {
    const Store = mongoose.model('Store');
    const store = await Store.findById(this.sourceStoreId).select('_id');
    this.sourceStoreType = store ? 'Store' : 'CentralKitchen';
  }
  if (this.isModified('targetStoreId') && this.targetStoreId) {
    const Store = mongoose.model('Store');
    const store = await Store.findById(this.targetStoreId).select('_id');
    this.targetStoreType = store ? 'Store' : 'CentralKitchen';
  }
  next();
});

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
