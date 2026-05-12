'use strict';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * JSON body for error responses. In production, 5xx never includes internal error text.
 *
 * @param {unknown} err
 * @param {number} httpStatus
 * @returns {{ message: string }}
 */
function getClientErrorPayload(err, httpStatus) {
  if (httpStatus >= 500 && isProduction()) {
    return { message: 'Internal server error' };
  }
  const raw =
    err && typeof err === 'object' && 'message' in err && err.message != null
      ? String(err.message).trim()
      : '';
  if (raw) return { message: raw };
  return { message: httpStatus >= 500 ? 'Internal server error' : 'Bad request' };
}

/**
 * @param {unknown} logger
 * @param {unknown} err
 * @param {Record<string, unknown>} [meta]
 */
function logRouteError(logger, err, meta = {}) {
  if (!logger || typeof logger.error !== 'function') return;
  const msg = err && typeof err === 'object' && err.message != null ? String(err.message) : String(err);
  const stack = err && typeof err === 'object' && err.stack ? err.stack : undefined;
  logger.error(meta.label || 'Route error', { ...meta, error: msg, stack });
}

/**
 * Standard catch-handler: log 5xx server-side, send safe client payload.
 *
 * @param {import('express').Response} res
 * @param {unknown} err
 * @param {{ req?: import('express').Request; status?: number; label?: string; logger?: unknown; skipLog?: boolean }} [options]
 */
function sendRouteError(res, err, options = {}) {
  const fromErr =
    err && typeof err === 'object' && (err.status || err.statusCode)
      ? Number(err.status || err.statusCode)
      : undefined;
  const rawStatus = options.status ?? fromErr ?? 500;
  const st = Number.isFinite(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const logger = options.logger ?? options.req?.app?.locals?.logger;
  if (st >= 500 && !options.skipLog) {
    logRouteError(logger, err, {
      path: options.req?.path,
      method: options.req?.method,
      label: options.label,
    });
  }
  return res.status(st).json(getClientErrorPayload(err, st));
}

module.exports = {
  getClientErrorPayload,
  logRouteError,
  sendRouteError,
};
