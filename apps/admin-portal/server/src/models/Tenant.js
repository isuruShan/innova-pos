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
    suspensionReason: {
      type: String,
      enum: ['', 'superadmin', 'payment_overdue', 'trial_ended', 'cancelled', 'other'],
      default: '',
    },
    pendingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
    pendingPlanEffectiveAt: { type: Date, default: null },
    pendingPlanPaymentReceived: { type: Boolean, default: false },
    assignedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null, index: true },
    planLocked: { type: Boolean, default: false },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    trialEndsAt: { type: Date, default: null },
    adminCount: { type: Number, default: 0, min: 0, max: 2 },

    /** ISO-style country code for billing region; LK = local plans, others = international catalogue */
    countryIso: { type: String, default: 'LK', uppercase: true, trim: true, index: true },

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

    /**
     * Paid feature add-ons (e.g. guest QR ordering). Activated after successful payment + verification.
     * `amountPerCycle` is snapshot at activation for billing transparency.
     * Supports 7-day trial period before requiring payment.
     */
    paidAddons: {
      qrOrdering: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      },
      loyalty: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      },
      tableManagement: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
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
      dualScreen: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      },
      whatsapp: {
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
      modifierGroups: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      },
      advancedInventory: {
        active: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null },
        amountPerCycle: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: '', trim: true, uppercase: true },
        periodEndsAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        trialActivatedAt: { type: Date, default: null },
        trialEndsAt: { type: Date, default: null },
        billingCycle: { type: String, enum: ['', 'monthly', 'yearly'], default: '' },
      },
    },

    // Branding — managed via admin portal
    settings: {
      primaryColor: { type: String, default: '#1a1a2e' },
      accentColor: { type: String, default: '#e94560' },
      sidebarColor: { type: String, default: '#16213e' },
      textColor: { type: String, default: '#ffffff' },
      logoUrl: { type: String, default: '' },
      logoKey: { type: String, default: '' },
      customerTerminalBgUrl: { type: String, default: '' },
      customerTerminalBgKey: { type: String, default: '' },
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
