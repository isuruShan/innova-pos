'use strict';

let redisClient;

/**
 * Shared Redis connection for rate-limit stores. Each `getRateLimitStore` call returns a **new**
 * `RedisStore` instance (required by express-rate-limit v8 — stores must not be shared across limiters).
 *
 * Set RATE_LIMIT_REDIS_URL or REDIS_URL. If unset or connection fails, returns undefined (memory store).
 *
 * @param {{ error?: Function; warn?: Function; info?: Function } | null} [logger]
 * @param {{ prefix?: string }} [options] Redis key prefix; must differ for each limiter in the same process.
 */
async function getRateLimitStore(logger, options = {}) {
  const url = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();
  if (!url) return undefined;

  try {
    if (!redisClient) {
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
    redisClient = undefined;
    return undefined;
  }
}

module.exports = { getRateLimitStore };
