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
    sourceStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    targetStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
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

stockTransferSchema.index({ tenantId: 1, sourceStoreId: 1 });
stockTransferSchema.index({ tenantId: 1, targetStoreId: 1 });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
