'use strict';

const mongoose = require('mongoose');

/**
 * Captures each table occupancy session for analytics.
 * Created when a table is seated, updated when cleared.
 */
const tableSessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', required: true, index: true },
  tableLabel: { type: String, default: '' },
  
  // Session timing
  seatedAt: { type: Date, required: true, index: true },
  clearedAt: { type: Date, default: null },
  durationMinutes: { type: Number, default: null },
  
  // Party info
  partySize: { type: Number, default: null, min: 1 },
  source: { 
    type: String, 
    enum: ['walk_in', 'reservation', 'waitlist', 'qr_order'], 
    default: 'walk_in' 
  },
  
  // Revenue data (denormalized for fast queries)
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderTotal: { type: Number, default: 0 },
  revenuePerCover: { type: Number, default: 0 },
  itemCount: { type: Number, default: 0 },
  
  // Reservation/waitlist reference
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
  waitlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Waitlist', default: null },
  
  // Day parts for aggregation
  dayOfWeek: { type: Number, min: 0, max: 6 },  // 0=Sunday
  hourOfDay: { type: Number, min: 0, max: 23 },
  dayPart: { 
    type: String, 
    enum: ['breakfast', 'lunch', 'dinner', 'late_night'], 
    default: 'lunch' 
  },
  
  // Service quality indicators
  firstItemOrderedMinutes: { type: Number, default: null },  // Time from seating to first order
  lastItemServedMinutes: { type: Number, default: null },    // Time from seating to last item served
  paymentCollectedMinutes: { type: Number, default: null },  // Time from seating to payment
  
  // Server (if tracked)
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  serverName: { type: String, default: '' },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    index: true,
  },
  
}, { timestamps: true });

tableSessionSchema.index({ tenantId: 1, storeId: 1, seatedAt: -1 });
tableSessionSchema.index({ tenantId: 1, storeId: 1, tableId: 1, seatedAt: -1 });
tableSessionSchema.index({ tenantId: 1, storeId: 1, status: 1 });

/**
 * Helper to determine day part from hour
 */
tableSessionSchema.statics.getDayPart = function (hour) {
  if (hour >= 6 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 22) return 'dinner';
  return 'late_night';
};

/**
 * Pre-save to auto-calculate day parts
 */
tableSessionSchema.pre('save', function (next) {
  if (this.seatedAt) {
    const d = new Date(this.seatedAt);
    this.dayOfWeek = d.getDay();
    this.hourOfDay = d.getHours();
    this.dayPart = this.constructor.getDayPart(this.hourOfDay);
  }
  if (this.clearedAt && this.seatedAt) {
    this.durationMinutes = Math.round(
      (new Date(this.clearedAt) - new Date(this.seatedAt)) / 60000
    );
  }
  if (this.orderTotal && this.partySize && this.partySize > 0) {
    this.revenuePerCover = Math.round((this.orderTotal / this.partySize) * 100) / 100;
  }
  next();
});

module.exports = mongoose.model('TableSession', tableSessionSchema);
