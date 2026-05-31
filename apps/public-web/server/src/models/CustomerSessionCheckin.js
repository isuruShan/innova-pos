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

// Auto-delete check-in sessions after 2 hours (7200 seconds)
// Increased from 30 minutes to give customers more time to complete registration
// especially when there are network delays or nginx timeouts
customerSessionCheckinSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

module.exports = mongoose.model('CustomerSessionCheckin', customerSessionCheckinSchema);
