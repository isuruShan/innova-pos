const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['superadmin', 'merchant_admin', 'manager', 'cashier', 'kitchen', 'steward', 'inventory_clerk', 'commissary_operator', 'purchasing_officer'];

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
    licensedStoreSlots: { type: Number, default: 1, min: 1 },
    defaultStoreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    profileImage: { type: String, default: '' },
    profileImageKey: { type: String, default: '' },

    isActive: { type: Boolean, default: true },
    isTemporaryPassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },

    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    /** Optional 4–8 digit PIN for approving returns (hashed). Managers only. */
    managerApprovalPin: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fcmTokens: [{ type: String, index: true }],
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('managerApprovalPin')) {
    const pin = String(this.managerApprovalPin || '').trim();
    if (!pin) {
      this.managerApprovalPin = '';
    } else {
      this.managerApprovalPin = await bcrypt.hash(pin, 10);
    }
  }
});

userSchema.methods.compareApprovalPin = function (plain) {
  const pin = String(this.managerApprovalPin || '');
  if (!pin) return Promise.resolve(false);
  return bcrypt.compare(String(plain || ''), pin);
};

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.index({ tenantId: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
