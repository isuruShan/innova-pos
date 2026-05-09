const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['trial', 'monthly', 'yearly', 'quarterly', 'custom'],
      default: 'trial',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Admin override fields
    extendedByAdmin: { type: Boolean, default: false },
    extensionNote: { type: String, default: '' },
    extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    extendedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

subscriptionSchema.index({ tenantId: 1, endDate: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
