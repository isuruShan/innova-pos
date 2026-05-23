const mongoose = require('mongoose');

const platformUberSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'default', unique: true },
    clientId: { type: String, default: '', trim: true },
    clientSecret: { type: String, default: '', select: false },       // Encrypted at rest
    clientSecretSet: { type: Boolean, default: false },
    redirectUri: { type: String, default: '', trim: true },
    environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformUberSettings', platformUberSettingsSchema);
