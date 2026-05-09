const mongoose = require('mongoose');

const paymentReceiptSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LKR' },
    bankReference: { type: String, required: true, trim: true },
    bankName: { type: String, default: '', trim: true },
    paymentDate: { type: Date, required: true },
    receiptFileUrl: { type: String, default: '' },
    receiptFileKey: { type: String, default: '' },
    notes: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, default: '' },

    // After verification
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    subscriptionExtended: { type: Boolean, default: false },
    extensionDays: { type: Number, default: 0 },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentReceiptSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentReceipt', paymentReceiptSchema);
