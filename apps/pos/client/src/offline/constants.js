/** Prefix for Mongo-invalid temp ids created while offline */
export const OFFLINE_ORDER_PREFIX = 'offline:';

export function tempOrderId(clientRequestId) {
  return `${OFFLINE_ORDER_PREFIX}${clientRequestId}`;
}

/** Cache TTL for GET responses (ms) */
export const GET_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h
