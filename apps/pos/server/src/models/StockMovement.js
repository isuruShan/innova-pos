const mongoose = require('mongoose');

/**
 * Audit log for all inventory stock movements.
 * Tracks every change to inventory quantities with full context.
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
    /** Session ID if this movement was part of an adjustment session */
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventorySession',
      default: null,
      index: true,
    },
    /** Type of movement */
    type: {
      type: String,
      enum: ['adjustment', 'grn', 'goods_return', 'waste', 'opening', 'sale', 'consumption'],
      required: true,
      index: true,
    },
    /** Quantity change (+/-) */
    quantity: {
      type: Number,
      required: true,
    },
    /** Stock level before this movement */
    previousQty: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Stock level after this movement */
    newQty: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Reason for the movement */
    reason: {
      type: String,
      enum: [
        'count_correction',
        'damage',
        'expiry',
        'theft',
        'spillage',
        'received',
        'returned',
        'opening_balance',
        'sale',
        'consumption',
        'processing_loss',
        'other',
      ],
      required: true,
    },
    /** Additional notes */
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    /** Reference to PurchaseOrder if type is 'grn' */
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    /** Reference to GoodsReceipt if type is 'grn' or 'goods_return' */
    goodsReceiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      default: null,
    },
    /** Reference to Order if type is 'sale' or 'consumption' */
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    /** User who made this change */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

stockMovementSchema.index({ tenantId: 1, inventoryItemId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, storeId: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, sessionId: 1 });
stockMovementSchema.index({ orderId: 1, type: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
