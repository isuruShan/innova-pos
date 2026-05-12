'use strict';

const cors = require('cors');

/**
 * Express CORS middleware.
 * - **Development:** reflect any origin (same as `cors({ origin: true })`).
 * - **Production:** allow `CORS_ORIGIN` list **plus** same-origin requests where
 *   `Origin` matches `req.protocol` + `Host` (needed when the SPA and API are served
 *   from the same process, e.g. `http://IP:5000` loading `/assets/*`).
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
        const host = req.get('host');
        if (host && origin === `${req.protocol}://${host}`) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })(req, res, next);
}

module.exports = { createCorsMiddleware };
