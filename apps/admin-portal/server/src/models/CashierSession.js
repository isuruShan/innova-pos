const mongoose = require('mongoose');

const cashierSessionSchema = new mongoose.Schema(
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
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    openingCashBalance: { type: Number, required: true, min: 0 },
    openedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    closedAt: { type: Date },
    closingCountedCash: { type: Number },
    expectedCashInDrawer: { type: Number },
    cashSalesDuringSession: { type: Number },
    varianceAmount: { type: Number },
    varianceNotes: { type: String, default: '', trim: true },
    cashMovements: {
      type: [
        {
          kind: { type: String, enum: ['cash_in', 'cash_out'], required: true },
          amount: { type: Number, required: true, min: 0 },
          notes: { type: String, default: '', trim: true, maxlength: 2000 },
          createdAt: { type: Date, default: Date.now },
          createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
      ],
      default: [],
    },
    sessionCloseBreakdown: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

cashierSessionSchema.index({ tenantId: 1, storeId: 1, cashierId: 1, status: 1 });
cashierSessionSchema.index({ tenantId: 1, storeId: 1, closedAt: -1 });

module.exports = mongoose.model('CashierSession', cashierSessionSchema);
