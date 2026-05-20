'use strict';

const mongoose = require('mongoose');

/** Match orders / anly rows for a tenant and optional store (same rules as POS store scope). */
function buildAnalyticsStoreMatch(tenantId, storeId) {
  const match = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  if (storeId) {
    match.storeId = new mongoose.Types.ObjectId(storeId);
  }
  return match;
}

module.exports = { buildAnalyticsStoreMatch };
