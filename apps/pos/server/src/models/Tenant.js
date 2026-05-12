const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'cancelled'],
      default: 'pending',
    },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'cancelled'],
      default: 'trial',
    },
    trialEndsAt: { type: Date, default: null },

    /** One-day activation override after subscription expiry (set by superadmin). */
    temporaryActivationUntil: { type: Date, default: null },
    temporaryActivationRequestedAt: { type: Date, default: null },
    temporaryActivationRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    temporaryActivationExpiryEndDate: { type: Date, default: null },
    temporaryActivationUsedForEndDate: { type: Date, default: null },

    /** Prevent duplicate reminder emails for the same expiry end date. */
    subscriptionExpiryReminderSentForEndDate: { type: Date, default: null },
    /** Prevent duplicate deactivation emails/notifications for the same expiry end date. */
    subscriptionDeactivationNotifiedForEndDate: { type: Date, default: null },
    adminCount: { type: Number, default: 0, min: 0, max: 2 },

    // Branding — managed via admin portal
    settings: {
      primaryColor: { type: String, default: '#1a1a2e' },
      accentColor: { type: String, default: '#e94560' },
      logoUrl: { type: String, default: '' },
      logoKey: { type: String, default: '' },
      paymentMethods: { type: [String], default: ['cash'] },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);
