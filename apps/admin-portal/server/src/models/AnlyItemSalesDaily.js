'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    dateKey: { type: String, required: true, trim: true },
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    itemName: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },
    qty: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

schema.index({ tenantId: 1, storeId: 1, dateKey: 1, menuItemId: 1 }, { unique: true });
schema.index({ tenantId: 1, storeId: 1, dateKey: 1 });

module.exports = mongoose.model('AnlyItemSalesDaily', schema, 'anly_item_sales_daily');
