const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'promotion_pending',
        'promotion_approved',
        'promotion_rejected',
        'reward_pending',
        'reward_approved',
        'reward_rejected',
        'loyalty_retention_review',
        'loyalty_points_adjusted',
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    readAt: { type: Date, default: null },
    meta: {
      resourceType: { type: String, default: '' },
      resourceId: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ tenantId: 1, userId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
