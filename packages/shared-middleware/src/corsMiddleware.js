'use strict';

const cors = require('cors');

/**
 * True when the browser Origin targets this same host:port as the request (SPA + static on one server).
 * Uses URL parsing so we do not rely on req.protocol (can be wrong behind some proxies).
 *
 * @param {import('express').Request} req
 * @param {string} origin
 */
function originMatchesRequestHost(req, origin) {
  const host = req.get('host');
  if (!host || !origin) return false;
  try {
    const u = new URL(origin);
    return u.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Express CORS middleware.
 * - **Development:** reflect any origin (same as `cors({ origin: true })`).
 * - **Production:** allow `CORS_ORIGIN` list **plus** same-origin (`Origin` host matches `Host` header).
 *
 * @param {{ allowedOrigins?: string[], production?: boolean }} opts
 */
function createCorsMiddleware(opts = {}) {
  const production = Boolean(opts.production);
  const list = Array.isArray(opts.allowedOrigins) ? opts.allowedOrigins : [];

  if (!production) {
    return cors({ origin: true, credentials: true });
  }

  return (req, res, next) =>
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (list.includes(origin)) return cb(null, true);
        if (originMatchesRequestHost(req, origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })(req, res, next);
}

module.exports = { createCorsMiddleware };
