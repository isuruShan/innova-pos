const mongoose = require('mongoose');

/**
 * Goods Receipt Note (GRN) for receiving stock from purchase orders
 * Also handles Goods Returns for rejected/damaged items
 */
const goodsReceiptItemSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
  itemName: { type: String, required: true },
  unit: { type: String, required: true },
  orderedQty: { type: Number, default: 0, min: 0 },
  receivedQty: { type: Number, default: 0, min: 0 },
  acceptedQty: { type: Number, default: 0, min: 0 },
  rejectedQty: { type: Number, default: 0, min: 0 },
  unitPrice: { type: Number, default: 0, min: 0 },
  rejectionReason: { type: String, default: '', trim: true },
}, { _id: false });

const goodsReceiptSchema = new mongoose.Schema(
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
    receiptNumber: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['receipt', 'return'],
      default: 'receipt',
      index: true,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    items: [goodsReceiptItemSchema],
    status: {
      type: String,
      enum: ['draft', 'confirmed'],
      default: 'draft',
      index: true,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    receiptDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    returnReason: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

goodsReceiptSchema.index({ tenantId: 1, storeId: 1, type: 1, createdAt: -1 });
goodsReceiptSchema.index({ tenantId: 1, purchaseOrderId: 1 });
goodsReceiptSchema.index({ tenantId: 1, supplierId: 1 });

module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);
