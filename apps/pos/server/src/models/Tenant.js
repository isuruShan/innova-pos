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

    paidAddons: {
      qrOrdering: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
      },
      loyalty: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
      },
      tableManagement: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
      },
      uberEats: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'LKR', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
        autoAccept: { type: Boolean, default: false },
        defaultPrepTime: { type: Number, default: 15 },
        stores: [{
          storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
          uberStoreId: { type: String, default: '', trim: true },
          accessToken: { type: String, default: '' },
          refreshToken: { type: String, default: '' },
          tokenExpiresAt: { type: Date, default: null },
          isConnected: { type: Boolean, default: false },
          connectedAt: { type: Date, default: null },
        }],
        webhookSecret: { type: String, default: '' },
      },
      accounting: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'LKR', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      },
    },

    adminCount: { type: Number, default: 0, min: 0, max: 2 },

    // Branding — managed via admin portal
    settings: {
      primaryColor: { type: String, default: '#1a1a2e' },
      accentColor: { type: String, default: '#e94560' },
      logoUrl: { type: String, default: '' },
      logoKey: { type: String, default: '' },
      paymentMethods: { type: [String], default: ['cash'] },
    },

    googleBusinessProfileId: { type: String, default: '' },
    smsGatewayAllowed: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);
