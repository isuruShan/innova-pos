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
    profileImage: { type: String, default: '' },
    profileImageKey: { type: String, default: '' },

    isActive: { type: Boolean, default: true },
    isTemporaryPassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },

    // Password reset
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // Tracking
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Compound index: email must be unique per tenant
// (same email could exist in different tenants in theory, but for simplicity we keep global uniqueness)
userSchema.index({ tenantId: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
