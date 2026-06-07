const mongoose = require('mongoose');

/**
 * Tracks end-of-day wastage reports or custom direct spillage/expiry events.
 */
const wastageReportSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    type: {
      type: String,
      enum: ['end_of_day', 'spill_expiry_damage'],
      default: 'spill_expiry_damage',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    items: [
      {
        itemType: {
          type: String,
          enum: ['inventory', 'menu'],
          default: 'inventory',
          required: true,
        },
        inventoryItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Inventory',
          required: false,
        },
        menuItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
          required: false,
        },
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        reason: {
          type: String,
          enum: ['expiry', 'damage', 'spillage', 'other'],
          required: true,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

wastageReportSchema.index({ tenantId: 1, storeId: 1, date: -1 });

module.exports = mongoose.model('WastageReport', wastageReportSchema);
