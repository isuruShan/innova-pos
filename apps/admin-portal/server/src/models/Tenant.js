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
    assignedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null, index: true },
    planLocked: { type: Boolean, default: false },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    trialEndsAt: { type: Date, default: null },
    adminCount: { type: Number, default: 0, min: 0, max: 2 },

    /** ISO-style country code for billing region; LK = local plans, others = international catalogue */
    countryIso: { type: String, default: 'LK', uppercase: true, trim: true, index: true },

    // Branding — managed via admin portal
    settings: {
      primaryColor: { type: String, default: '#1a1a2e' },
      accentColor: { type: String, default: '#e94560' },
      sidebarColor: { type: String, default: '#16213e' },
      textColor: { type: String, default: '#ffffff' },
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
