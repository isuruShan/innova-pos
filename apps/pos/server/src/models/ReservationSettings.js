'use strict';

const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0=Sunday
  openTime: { type: String, required: true },  // "11:00"
  closeTime: { type: String, required: true }, // "22:00"
  slotDurationMinutes: { type: Number, default: 15, min: 5, max: 60 },
  maxPartySizePerSlot: { type: Number, default: null }, // null = unlimited
}, { _id: false });

const reservationSettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  
  // General settings
  enabled: { type: Boolean, default: true },
  maxPartySize: { type: Number, default: 12, min: 1, max: 50 },
  minLeadTimeMinutes: { type: Number, default: 60, min: 0, max: 1440 },     // Min advance booking
  maxLeadTimeDays: { type: Number, default: 30, min: 1, max: 365 },         // Max advance booking
  defaultDurationMinutes: { type: Number, default: 90, min: 15, max: 480 },
  bufferMinutes: { type: Number, default: 15, min: 0, max: 60 },            // Between reservations
  
  // Time slots per day
  timeSlots: [timeSlotSchema],
  
  // Confirmation settings
  requireConfirmation: { type: Boolean, default: true },
  autoConfirmOnline: { type: Boolean, default: false },
  confirmationMessage: { 
    type: String, 
    default: 'Your reservation is confirmed for {time} on {date}. Reply CANCEL to cancel.',
    maxlength: 500,
  },
  
  // Reminder settings
  sendReminder: { type: Boolean, default: true },
  reminderHoursBefore: { type: Number, default: 24, min: 1, max: 72 },
  reminderMessage: { 
    type: String, 
    default: 'Reminder: Your reservation is tomorrow at {time}. Reply CANCEL to cancel.',
    maxlength: 500,
  },
  
  // No-show policy
  noShowGracePeriodMinutes: { type: Number, default: 15, min: 5, max: 60 },
  
  // Deposit settings (future)
  requireDeposit: { type: Boolean, default: false },
  depositAmount: { type: Number, default: 0, min: 0 },
  depositCurrency: { type: String, default: 'LKR', uppercase: true },
  
  // Waitlist settings
  waitlistEnabled: { type: Boolean, default: true },
  waitlistMaxSize: { type: Number, default: 50, min: 1, max: 200 },
  waitlistNotifyWhenReady: { type: Boolean, default: true },
  waitlistNotifyMessage: { 
    type: String, 
    default: 'Hi {name}! Your table is ready at {store}. Please check in within 10 minutes.',
    maxlength: 500,
  },
  
  // Average table turn time for wait estimates (auto-calculated or manual)
  avgTurnTimeMinutes: { type: Number, default: 60, min: 15, max: 240 },
  
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

reservationSettingsSchema.index({ tenantId: 1, storeId: 1 }, { unique: true });

module.exports = mongoose.model('ReservationSettings', reservationSettingsSchema);
