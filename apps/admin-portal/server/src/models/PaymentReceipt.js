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
    requestedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null, index: true },
    requestedPlanCode: { type: String, default: '', trim: true },
    expectedAmount: { type: Number, default: 0, min: 0 },
    amountMatchesExpected: { type: Boolean, default: false },
    /** subscription renewal vs paid feature add-on */
    receiptKind: {
      type: String,
      enum: ['subscription', 'addon', 'store', 'user_license'],
      default: 'subscription',
      index: true,
    },
    /** When receiptKind is addon — e.g. qr_ordering */
    addonCode: { type: String, default: '', trim: true, lowercase: true },
    /** create_user | assign_stores */
    userLicenseAction: { type: String, default: '', trim: true, lowercase: true },
    userLicensePayload: { type: mongoose.Schema.Types.Mixed, default: null },

    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'stripe', 'paypal'],
      default: 'bank_transfer',
    },
    bankReference: { type: String, required: true, trim: true },
    stripeSessionId: { type: String, default: '', index: true },
    paypalOrderId: { type: String, default: '', index: true },
    externalPaymentId: { type: String, default: '' },
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

    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    subscriptionExtended: { type: Boolean, default: false },
    extensionDays: { type: Number, default: 0 },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },

    paymentBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    billingPeriodStart: { type: Date, default: null },
    billingPeriodEnd: { type: Date, default: null },

    /** Add-on codes excluded during checkout bundling */
    excludeAddons: { type: [String], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentReceiptSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentReceipt', paymentReceiptSchema);
