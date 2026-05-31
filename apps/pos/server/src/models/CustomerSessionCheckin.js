const mongoose = require('mongoose');

const customerSessionCheckinSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    birthday: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending_otp', 'completed', 'placed', 'pending'],
      default: 'pending',
    },
    otp: {
      type: String,
      default: '',
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    customerName: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Auto-delete check-in sessions after 30 minutes (1800 seconds)
customerSessionCheckinSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });

module.exports = mongoose.model('CustomerSessionCheckin', customerSessionCheckinSchema);
