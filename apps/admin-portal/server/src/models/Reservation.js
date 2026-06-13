'use strict';

const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  
  // Guest info
  guestName: { type: String, required: true, trim: true, maxlength: 100 },
  guestPhone: { type: String, required: true, trim: true, maxlength: 20 },
  guestEmail: { type: String, default: '', trim: true, lowercase: true, maxlength: 100 },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  
  // Reservation details
  reservationTime: { type: Date, required: true, index: true },
  partySize: { type: Number, required: true, min: 1, max: 50 },
  duration: { type: Number, default: 90, min: 15, max: 480 },  // Expected minutes
  
  // Table assignment
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', default: null },
  tableLabel: { type: String, default: '' },
  zonePreference: { type: String, default: '', maxlength: 50 },  // "outdoor", "window", etc.
  
  // Status workflow
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'reminded', 'arrived', 'seated', 'completed', 'no_show', 'cancelled'],
    default: 'pending',
    index: true,
  },
  
  // Notifications
  confirmationSentAt: { type: Date, default: null },
  reminderSentAt: { type: Date, default: null },
  reminderScheduledFor: { type: Date, default: null },
  
  // Source & notes
  source: { type: String, enum: ['phone', 'walk_in', 'website', 'google', 'api'], default: 'phone' },
  specialRequests: { type: String, default: '', maxlength: 500 },
  internalNotes: { type: String, default: '', maxlength: 500 },
  
  // Deposit (optional)
  depositAmount: { type: Number, default: 0, min: 0 },
  depositPaid: { type: Boolean, default: false },
  depositPaymentId: { type: String, default: '' },
  
  // Timestamps
  arrivedAt: { type: Date, default: null },
  seatedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: '', maxlength: 200 },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

reservationSchema.index({ tenantId: 1, storeId: 1, reservationTime: 1 });
reservationSchema.index({ tenantId: 1, guestPhone: 1 });
reservationSchema.index({ tenantId: 1, storeId: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
