const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    branch: { type: String, default: '', trim: true },
    swiftCode: { type: String, default: '', trim: true },
    instructions: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    imageUrl: { type: String, default: '', trim: true },
    imageKey: { type: String, default: '', trim: true },
  },
  { _id: true },
);

const platformPaymentSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'default', unique: true },
    bankAccounts: { type: [bankAccountSchema], default: [] },
    stripe: {
      enabled: { type: Boolean, default: false },
      publishableKey: { type: String, default: '' },
      secretKey: { type: String, default: '', select: false },
      webhookSecret: { type: String, default: '', select: false },
      secretKeySet: { type: Boolean, default: false },
      webhookSecretSet: { type: Boolean, default: false },
      imageUrl: { type: String, default: '', trim: true },
      imageKey: { type: String, default: '', trim: true },
    },
    paypal: {
      enabled: { type: Boolean, default: false },
      clientId: { type: String, default: '' },
      clientSecret: { type: String, default: '', select: false },
      clientSecretSet: { type: Boolean, default: false },
      mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
      imageUrl: { type: String, default: '', trim: true },
      imageKey: { type: String, default: '', trim: true },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PlatformPaymentSettings', platformPaymentSettingsSchema);
