'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    lastSyncedAt: { type: Date, default: null },
    lastOrderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    backfillCompletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('AnlySyncState', schema, 'anly_sync_state');
