const mongoose = require('mongoose');

/**
 * Purchase Order for requesting stock from suppliers
 */
const purchaseOrderItemSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
  itemName: { type: String, required: true },
  unit: { type: String, required: true },
  orderedQty: { type: Number, required: true, min: 0 },
  receivedQty: { type: Number, default: 0, min: 0 },
  unitPrice: { type: Number, default: 0, min: 0 },
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema(
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
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    items: [purchaseOrderItemSchema],
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expectedDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ tenantId: 1, storeId: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
