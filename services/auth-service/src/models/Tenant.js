const mongoose = require('mongoose');

// Subscription schema for detailed subscription management
const subscriptionSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['active', 'trial', 'suspended', 'past_due', 'cancelled'],
    default: 'trial',
  },
  plan: {
    type: String,
    enum: ['starter', 'professional', 'enterprise'],
    default: 'professional',
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  trialEndDate: { type: Date },
  lastPaymentDate: { type: Date },
  nextBillingDate: { type: Date },
  autoRenew: { type: Boolean, default: true },
  
  // Payment details
  amountDue: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'annual',
  },

  // Warning banner tracking (for 4-day expiry warning)
  expiryWarningShownAt: { type: Date },
  expiryWarningDismissedBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dismissedAt: { type: Date }
  }],

  // Suspension details
  suspendedAt: { type: Date },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null = auto-suspended
  suspensionReason: {
    type: String,
    enum: ['payment_failure', 'expired_subscription', 'manual_suspension', 'policy_violation'],
  },
  suspensionNotes: { type: String },
  autoSuspended: { type: Boolean, default: false },
}, { _id: false });

// Feature flags based on plan
const featuresSchema = new mongoose.Schema({
  maxUsers: { type: Number, default: 5 },
  maxLocations: { type: Number, default: 1 },
  analyticsEnabled: { type: Boolean, default: true },
  loyaltyEnabled: { type: Boolean, default: true },
  multiLocationEnabled: { type: Boolean, default: false },
  apiAccess: { type: Boolean, default: false },
}, { _id: false });

const tenantSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'cancelled'],
      default: 'pending',
    },
    
    // Legacy fields - keep for backward compatibility, prefer subscription.status
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'cancelled'],
      default: 'trial',
    },
    assignedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null, index: true },
    planLocked: { type: Boolean, default: false },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    trialEndsAt: { type: Date, default: null },
    adminCount: { type: Number, default: 0, min: 0, max: 2 },

    // New detailed subscription management
    subscription: subscriptionSchema,
    
    // Feature flags
    features: featuresSchema,

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
