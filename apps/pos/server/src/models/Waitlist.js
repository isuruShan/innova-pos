'use strict';

const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  
  // Guest info
  guestName: { type: String, required: true, trim: true, maxlength: 100 },
  guestPhone: { type: String, required: true, trim: true, maxlength: 20 },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  
  // Party details
  partySize: { type: Number, required: true, min: 1, max: 50 },
  zonePreference: { type: String, default: '', maxlength: 50 },
  
  // Queue position
  position: { type: Number, required: true, min: 1 },
  estimatedWaitMinutes: { type: Number, default: null },
  quotedWaitMinutes: { type: Number, default: null },  // What we told the guest
  
  // Status
  status: {
    type: String,
    enum: ['waiting', 'notified', 'ready', 'seated', 'left', 'no_show'],
    default: 'waiting',
    index: true,
  },
  
  // Notifications
  notifiedAt: { type: Date, default: null },
  notificationMethod: { type: String, enum: ['sms', 'call', 'pager', 'none'], default: 'sms' },
  
  // Timestamps
  joinedAt: { type: Date, default: Date.now },
  seatedAt: { type: Date, default: null },
  leftAt: { type: Date, default: null },
  
  // Optional assigned table when ready
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', default: null },
  tableLabel: { type: String, default: '' },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

waitlistSchema.index({ tenantId: 1, storeId: 1, status: 1, position: 1 });

// Auto-calculate position when saving new entry
waitlistSchema.pre('save', async function (next) {
  if (this.isNew && !this.position) {
    const lastEntry = await this.constructor
      .findOne({
        tenantId: this.tenantId,
        storeId: this.storeId,
        status: 'waiting',
      })
      .sort({ position: -1 })
      .select('position')
      .lean();
    this.position = (lastEntry?.position || 0) + 1;
  }
  next();
});

module.exports = mongoose.model('Waitlist', waitlistSchema);
