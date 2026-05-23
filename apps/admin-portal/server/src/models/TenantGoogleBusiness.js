const mongoose = require('mongoose');

const tenantGoogleBusinessSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    accessToken: { type: String, default: '' },      // Encrypted at rest
    refreshToken: { type: String, default: '' },     // Encrypted at rest
    tokenExpiresAt: { type: Date, default: null },
    gbpAccountName: { type: String, default: '', trim: true },   // e.g. "accounts/12345"
    gbpLocationName: { type: String, default: '', trim: true },  // e.g. "accounts/12345/locations/67890"
    gbpPlaceId: { type: String, default: '', trim: true },       // for the "View on Google Maps" link
    gbpStatus: {
      type: String,
      enum: ['connected', 'pending_verification', 'verified', 'error'],
      default: 'connected',
    },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TenantGoogleBusiness', tenantGoogleBusinessSchema);
