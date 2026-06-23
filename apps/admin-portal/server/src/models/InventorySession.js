const mongoose = require('mongoose');

/**
 * Inventory adjustment session tracking (shared with POS)
 * This model mirrors the POS InventorySession model for admin portal access
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
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'cancelled'],
      default: 'active',
      index: true,
    },
    adjustments: [
      {
        inventoryItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Inventory',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        notes: {
          type: String,
          default: '',
          trim: true,
        }
      }
    ],
    adjustmentCount: {
      type: Number,
      default: 0,
    },
    totalQuantityChanged: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

inventorySessionSchema.index({ tenantId: 1, storeId: 1, status: 1 });
inventorySessionSchema.index({ tenantId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('InventorySession', inventorySessionSchema);
