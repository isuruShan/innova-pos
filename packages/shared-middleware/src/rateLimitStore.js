'use strict';

let redisClient;
let redisVerified = false;

function isRateLimitDisabled() {
  return (
    process.env.DISABLE_RATE_LIMIT === '1' ||
    process.env.DISABLE_RATE_LIMIT === 'true'
  );
}

/** Production HTTP rate limits unless DISABLE_RATE_LIMIT or non-production NODE_ENV. */
function shouldUseHttpRateLimit(isProd = process.env.NODE_ENV === 'production') {
  return Boolean(isProd) && !isRateLimitDisabled();
}

/**
 * Shared Redis connection for rate-limit stores. Each call returns a **new** RedisStore instance
 * (required by express-rate-limit v8 — never reuse the same store object on two limiters).
 *
 * Set RATE_LIMIT_REDIS_URL or REDIS_URL (include password if Redis requires AUTH).
 * Returns undefined when rate limits are disabled, URL unset, or Redis is unavailable.
 */
async function getRateLimitStore(logger, options = {}) {
  if (isRateLimitDisabled()) return undefined;

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

module.exports = {
  getRateLimitStore,
  isRateLimitDisabled,
  shouldUseHttpRateLimit,
};
