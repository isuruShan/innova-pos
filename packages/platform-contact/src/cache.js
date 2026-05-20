'use strict';

const CACHE_KEY = 'platform:contact:v1';
const DEFAULT_TTL_SEC = 300;

let redisClient = null;
let redisInitAttempted = false;
const memoryCache = { value: null, expiresAt: 0 };

function getRedis() {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return null;
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redisClient.on('error', () => {});
    redisClient.connect().catch(() => {});
    return redisClient;
  } catch {
    return null;
  }
}

async function getCachedContact() {
  const now = Date.now();
  if (memoryCache.value && memoryCache.expiresAt > now) {
    return memoryCache.value;
  }

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryCache.value = parsed;
        memoryCache.expiresAt = now + DEFAULT_TTL_SEC * 1000;
        return parsed;
      }
    } catch {
      /* fall through to DB */
    }
  }
  return null;
}

async function setCachedContact(doc) {
  const payload = doc && typeof doc === 'object' ? doc : null;
  const ttl = parseInt(process.env.PLATFORM_CONTACT_CACHE_TTL_SEC || String(DEFAULT_TTL_SEC), 10) || DEFAULT_TTL_SEC;
  memoryCache.value = payload;
  memoryCache.expiresAt = Date.now() + ttl * 1000;

  const redis = getRedis();
  if (!redis || !payload) return;
  try {
    await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', ttl);
  } catch {
    /* memory cache still valid */
  }
}

async function invalidateContactCache() {
  memoryCache.value = null;
  memoryCache.expiresAt = 0;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

module.exports = {
  CACHE_KEY,
  getCachedContact,
  setCachedContact,
  invalidateContactCache,
};
