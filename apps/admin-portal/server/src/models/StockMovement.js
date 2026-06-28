const mongoose = require('mongoose');

/**
 * Stock movement audit log (shared with POS)
 * This model mirrors the POS StockMovement model for admin portal access
 */
const stockMovementSchema = new mongoose.Schema(
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
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventorySession',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['adjustment', 'grn', 'goods_return', 'waste', 'opening'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousQty: {
      type: Number,
      required: true,
    },
    newQty: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    goodsReceiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

stockMovementSchema.index({ tenantId: 1, storeId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, inventoryItemId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, sessionId: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
