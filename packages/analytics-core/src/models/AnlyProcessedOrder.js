'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.models.AnlyProcessedOrder
  || mongoose.model('AnlyProcessedOrder', schema, 'anly_processed_orders');
