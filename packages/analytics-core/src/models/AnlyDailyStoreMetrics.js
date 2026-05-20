'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    dateKey: { type: String, required: true, trim: true },
    orderCount: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    itemQty: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

schema.index({ tenantId: 1, storeId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.models.AnlyDailyStoreMetrics
  || mongoose.model('AnlyDailyStoreMetrics', schema, 'anly_daily_store_metrics');
