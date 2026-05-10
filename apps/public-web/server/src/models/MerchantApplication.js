const mongoose = require('mongoose');

const merchantApplicationSchema = new mongoose.Schema(
  {
    personal: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      countryDialCode: { type: String, default: '', trim: true },
      mobileNational: { type: String, default: '', trim: true },
      mobile: { type: String, default: '', trim: true },
      mobileE164: { type: String, default: '', trim: true, index: true },
    },

    business: {
      name: { type: String, required: true, trim: true },
      ownerName: { type: String, default: '', trim: true },
      ownerNames: { type: String, default: '', trim: true },
      street1: { type: String, default: '', trim: true },
      street2: { type: String, default: '', trim: true },
      zipCode: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      country: { type: String, default: '', trim: true },
      address: { type: String, default: '', trim: true },
      isRegistered: { type: Boolean, default: false },
      registrationNumber: { type: String, default: '', trim: true },
      brDocumentUrl: { type: String, default: '' },
      brDocumentKey: { type: String, default: '' },
      brDocumentMimeType: { type: String, default: '' },
    },

    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

merchantApplicationSchema.index({ createdAt: -1 });
merchantApplicationSchema.index({ 'personal.email': 1 });
merchantApplicationSchema.index({ 'personal.mobileE164': 1 });

/** Explicit collection matches admin-portal-server (shared queue) */
module.exports = mongoose.model('MerchantApplication', merchantApplicationSchema, 'merchantapplications');
