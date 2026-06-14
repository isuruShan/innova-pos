const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['superadmin', 'merchant_admin', 'manager', 'cashier', 'kitchen'];

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    storeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Store' }],
    defaultStoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    /** Paid store slots for this user (1 included; extra stores billed per assignment). */
    licensedStoreSlots: { type: Number, default: 1, min: 1 },
    profileImage: { type: String, default: '' },
    profileImageKey: { type: String, default: '' },
    managerApprovalPin: { type: String, default: '' },

    isActive: { type: Boolean, default: true },
    isTemporaryPassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },

    // Password reset
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // Tracking
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Firebase Cloud Messaging push notification tokens (one per registered browser/device)
    fcmTokens: [{ type: String, index: true }],

    preferences: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('managerApprovalPin') && this.managerApprovalPin) {
    this.managerApprovalPin = await bcrypt.hash(this.managerApprovalPin, 10);
  }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.compareApprovalPin = function (plain) {
  if (!this.managerApprovalPin) return Promise.resolve(false);
  return bcrypt.compare(String(plain), this.managerApprovalPin);
};

// Compound index: email must be unique per tenant
// (same email could exist in different tenants in theory, but for simplicity we keep global uniqueness)
userSchema.index({ tenantId: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
