const mongoose = require('mongoose');

const cashierDraftSchema = new mongoose.Schema(
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
    activeDraftId: {
      type: String,
      required: true,
    },
    drafts: {
      type: Array,
      default: [],
    },
    updatedAtMs: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

cashierDraftSchema.index({ tenantId: 1, storeId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CashierDraft', cashierDraftSchema);
