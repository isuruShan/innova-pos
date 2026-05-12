'use strict';

let redisClient;
let storeSingleton;

/**
 * Shared Redis-backed store for express-rate-limit (multiple Node processes/containers).
 * Set RATE_LIMIT_REDIS_URL or REDIS_URL. If unset or connection fails, returns undefined (memory store).
 *
 * @param {{ error?: Function; warn?: Function; info?: Function } | null} [logger]
 */
async function getRateLimitStore(logger) {
  const url = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();
  if (!url) return undefined;
  if (storeSingleton) return storeSingleton;
  try {
    const { RedisStore } = require('rate-limit-redis');
    const { createClient } = require('redis');
    redisClient = createClient({ url });
    redisClient.on('error', (err) => {
      const msg = err && err.message ? err.message : String(err);
      if (logger && typeof logger.error === 'function') {
        logger.error('[rate-limit-redis] client error', { error: msg });
      } else {
        console.error('[rate-limit-redis] client error', msg);
      }
    });
    await redisClient.connect();
    storeSingleton = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
    if (logger && typeof logger.info === 'function') {
      logger.info('Rate limiting: using Redis store');
    }
    return storeSingleton;
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (logger && typeof logger.warn === 'function') {
      logger.warn('[rate-limit-redis] disabled, using in-memory store', { error: msg });
    } else {
      console.warn('[rate-limit-redis] disabled, using in-memory store', msg);
    }
    return undefined;
  }
}

module.exports = { getRateLimitStore };
