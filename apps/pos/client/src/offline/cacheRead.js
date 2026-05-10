import { setCacheEntry, getCacheRow } from './idb.js';
import { GET_CACHE_MAX_AGE_MS } from './constants.js';
import { cacheKeyForRequest, normalizeApiPath } from './http.js';

function pathOnly(config) {
  return normalizeApiPath(config).split('?')[0];
}

export function shouldCacheSuccessfulGet(config) {
  if ((config.method || 'get').toLowerCase() !== 'get') return false;
  const p = pathOnly(config);
  return (
    p.endsWith('/menu') ||
    p.endsWith('/stores') ||
    p.endsWith('/orders') ||
    p.endsWith('/settings') ||
    p.includes('/tenant-settings') ||
    p.includes('/promotions') ||
    p.includes('/categories') ||
    p.includes('/reports/day-end') ||
    p.includes('/users') ||
    p.includes('/suppliers') ||
    p.includes('/inventory')
  );
}

export async function cacheSuccessfulGetResponse(res) {
  const cfg = res.config;
  if (!shouldCacheSuccessfulGet(cfg)) return;
  const key = cacheKeyForRequest(cfg);
  await setCacheEntry(key, res.data);
}

export async function readCachedGet(config) {
  const key = cacheKeyForRequest(config);
  const row = await getCacheRow(key);
  if (!row?.value) return null;
  const age = Date.now() - (row.storedAt || 0);
  if (age > GET_CACHE_MAX_AGE_MS) return null;
  return row.value;
}
