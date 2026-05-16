'use strict';

let redisClient;
let redisVerified = false;

/**
 * Shared Redis connection for rate-limit stores. Each `getRateLimitStore` call returns a **new**
 * `RedisStore` instance (required by express-rate-limit v8 — stores must not be shared across limiters).
 *
 * Set RATE_LIMIT_REDIS_URL or REDIS_URL (must include password if Redis requires AUTH).
 * If unset or connection fails, returns undefined (memory store).
 *
 * @param {{ error?: Function; warn?: Function; info?: Function } | null} [logger]
 * @param {{ prefix?: string }} [options] Redis key prefix; must differ for each limiter in the same process.
 */
async function getRateLimitStore(logger, options = {}) {
  const url = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();
  if (!url) return undefined;

  try {
    if (!redisClient || !redisVerified) {
      const { createClient } = require('redis');
      if (redisClient && !redisVerified) {
        try {
          await redisClient.quit();
        } catch (_) { /* ignore */ }
        redisClient = undefined;
      }
      redisClient = createClient({ url });
      redisClient.on('error', (err) => {
        const msg = err && err.message ? err.message : String(err);
        redisVerified = false;
        if (logger && typeof logger.error === 'function') {
          logger.error('[rate-limit-redis] client error', { error: msg });
        } else {
          console.error('[rate-limit-redis] client error', msg);
        }
      });
      await redisClient.connect();
      await redisClient.ping();
      redisVerified = true;
      if (logger && typeof logger.info === 'function') {
        logger.info('Rate limiting: using Redis store');
      }
    }

    const { RedisStore } = require('rate-limit-redis');
    let prefix = options.prefix != null ? String(options.prefix) : 'rl:';
    if (!prefix.endsWith(':')) prefix = `${prefix}:`;

    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix,
    });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (logger && typeof logger.warn === 'function') {
      logger.warn('[rate-limit-redis] disabled, using in-memory store', { error: msg });
    } else {
      console.warn('[rate-limit-redis] disabled, using in-memory store', msg);
    }
    redisVerified = false;
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (_) { /* ignore */ }
    }
    redisClient = undefined;
    return undefined;
  }
}

module.exports = { getRateLimitStore };
