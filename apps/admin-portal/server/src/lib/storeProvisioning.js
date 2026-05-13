'use strict';

const Store = require('../models/Store');

/**
 * Human-readable address for the default store when approving an application.
 */
function formatStoreAddressFromApplication(biz) {
  if (!biz || typeof biz !== 'object') return '';
  const single = String(biz.address || '').trim();
  if (single) return single;
  const parts = [biz.street1, biz.street2, biz.city, biz.state, biz.zipCode, biz.country]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean);
  return parts.join(', ');
}

function deriveStoreCodeBase(cityTrim, slug) {
  const city = String(cityTrim || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (city.length >= 3) return city.slice(0, 4);
  const s = String(slug || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (s.length >= 3) return s.slice(0, 4);
  return 'MAIN';
}

/**
 * Unique per-tenant store code (uppercase). Uses city or tenant slug; falls back to MAIN.
 */
async function allocateStoreCode(tenantId, cityTrim, slug) {
  const base = deriveStoreCodeBase(cityTrim, slug);
  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base}${i}`.slice(0, 16);
    const exists = await Store.findOne({ tenantId, code: candidate }).select('_id').lean();
    if (!exists) return candidate;
  }
  throw new Error('Could not allocate a unique store code');
}

module.exports = {
  allocateStoreCode,
  formatStoreAddressFromApplication,
};
