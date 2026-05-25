const mongoose = require('mongoose');

/**
 * Tracks inventory adjustment sessions by managers.
 * Provides accountability and audit trail for manual stock changes.
 */
const inventorySessionSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true,
    },
    /** Number of adjustments made in this session */
    adjustmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Sum of absolute quantity changes */
    totalQuantityChanged: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Summary notes when closing session */
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    /** Merchant admin who reviewed this session */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    /** Whether merchant admin has been notified */
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure only one active session per user+store at a time
inventorySessionSchema.index(
  { tenantId: 1, storeId: 1, userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

inventorySessionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('InventorySession', inventorySessionSchema);
