const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/** Safe folder name per service (matches createLogger(service) id). */
function sanitizeServiceId(service) {
  return String(service || 'app')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app';
}

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const structuredFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  json()
);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, tenantId, userId, method, path: p, ...rest }) => {
    const ctx = [
      tenantId ? `tenant=${tenantId}` : null,
      userId ? `user=${userId}` : null,
      method && p ? `${method} ${p}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    const extra = Object.keys(rest).length
      ? ` ${JSON.stringify(rest)}`
      : '';
    return `${ts} [${level}]${ctx ? ` [${ctx}]` : ''} ${message}${extra}`;
  })
);

const dailyRotateTransport = (dirname, level, filename) =>
  new winston.transports.DailyRotateFile({
    dirname,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level,
    format: structuredFormat,
  });

/**
 * Winston logger with **per-service log files** under `LOG_DIR/<service>/`:
 *   `combined-YYYY-MM-DD.log`, `error-YYYY-MM-DD.log`
 * Optional env override (after dotenv / Secrets Manager):
 *   `LOG_SERVICE_ID` — folder name if you cannot change the `createLogger()` argument (default: derived from `service`).
 */
const createLogger = (service) => {
  const serviceId = sanitizeServiceId(process.env.LOG_SERVICE_ID || service);
  const serviceLogDir = path.join(LOG_DIR, serviceId);
  if (!fs.existsSync(serviceLogDir)) fs.mkdirSync(serviceLogDir, { recursive: true });

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    defaultMeta: { service: serviceId },
    transports: [
      dailyRotateTransport(serviceLogDir, 'info', 'combined'),
      dailyRotateTransport(serviceLogDir, 'error', 'error'),
    ],
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({ format: consoleFormat }));
  } else {
    logger.add(new winston.transports.Console({ format: structuredFormat }));
  }

  return logger;
};

/**
 * Build a child logger with request context.
 * Usage: const log = childLogger(logger, req);
 *        log.info('Order created', { orderId });
 */
const childLogger = (logger, req) =>
  logger.child({
    tenantId: req.tenantId || req.user?.tenantId || 'system',
    userId: req.user?.id || 'anonymous',
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

module.exports = { createLogger, childLogger };
