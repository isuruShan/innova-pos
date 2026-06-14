const mongoose = require('mongoose');

const scheduledBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    userTypes: {
      type: [String],
      enum: ['cashier', 'manager', 'merchant_admin', 'superadmin'],
      default: ['cashier', 'manager', 'merchant_admin'],
    },
    platforms: {
      type: [String],
      enum: ['pos_portal', 'admin_portal'],
      default: ['pos_portal', 'admin_portal'],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    showForTrialOnly: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduledBanner', scheduledBannerSchema);
