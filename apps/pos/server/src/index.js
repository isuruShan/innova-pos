require('dotenv').config();

async function start() {
  try {
    const { loadAwsSecretsManagerEnv } = require('@innovapos/runtime-env');
    await loadAwsSecretsManagerEnv();
  } catch (e) {
    console.error('[runtime-env] Failed to load AWS Secrets Manager:', e.message);
    process.exit(1);
  }

  const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createLogger, childLogger } = require('@innovapos/logger');
const { getRateLimitStore, getClientErrorPayload, createCorsMiddleware } = require('@innovapos/shared-middleware');
const connectDB = require('./config/db');

const app = express();
const logger = createLogger('pos-server');
app.locals.logger = logger;

const isProd = process.env.NODE_ENV === 'production';

/** In development, SPA polling (orders, reports, notifications) from one IP blows past limits quickly, especially with a shared Redis store. Production keeps limits unless DISABLE_RATE_LIMIT=1. */
const skipHttpRateLimit =
  process.env.DISABLE_RATE_LIMIT === '1' ||
  process.env.DISABLE_RATE_LIMIT === 'true' ||
  !isProd;

const limiterStoreApi = await getRateLimitStore(logger, { prefix: 'rl:pos:api' });
const limiterStoreAuth = await getRateLimitStore(logger, { prefix: 'rl:pos:auth' });
const apiLimiterOpts = limiterStoreApi ? { store: limiterStoreApi } : {};
const authLimiterOpts = limiterStoreAuth ? { store: limiterStoreAuth } : {};

const { initNotificationBus } = require('./lib/notificationBus');
await initNotificationBus(logger);

connectDB(logger);

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false }));
app.use(compression());

// HTTP request logging via Winston
app.use((req, res, next) => {
  const reqStartMs = Date.now();
  res.on('finish', () => {
    const log = childLogger(logger, req);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[level](`${req.method} ${req.path} ${res.statusCode}`, { ms: Date.now() - reqStartMs });
  });
  next();
});

/** Built SPA: serve before API stack. Still requires apps/pos/client/dist (run Vite build on EC2). */
const clientDist = path.join(__dirname, '../../client/dist');
const serveClientStatic = isProd && fs.existsSync(clientDist);
if (serveClientStatic) {
  app.use(express.static(clientDist, { maxAge: '1y' }));
} else if (isProd) {
  logger.warn(
    'POS client dist missing at apps/pos/client/dist — run: cd apps/pos/client && pnpm run build (UI and /assets will fail until built)',
  );
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

/** CORS only for /api — avoids 500 on /assets when dist is missing or Origin checks misbehave; browsers still send Origin on module scripts. */
const posCors = createCorsMiddleware({ allowedOrigins, production: isProd });
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  return posCors(req, res, next);
});

const apiLimiter = rateLimit({
  ...apiLimiterOpts,
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 500),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — please try again later.' },
  skip: (req) =>
    skipHttpRateLimit ||
    (req.method === 'GET' && req.path === '/notifications/stream'),
});

const authLimiter = rateLimit({
  ...authLimiterOpts,
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts — please try again later.' },
  skip: () => skipHttpRateLimit,
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/tables',     require('./routes/tables'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/suppliers',  require('./routes/suppliers'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/upload',           require('./routes/upload'));
app.use('/api/settings',         require('./routes/settings'));
app.use('/api/tenant-settings',  require('./routes/tenantSettings'));
app.use('/api/stores',           require('./routes/stores'));
app.use('/api/cashier-sessions', require('./routes/cashier-sessions'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'pos-server', env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

if (serveClientStatic) {
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  const status = err.status || err.statusCode || 500;
  const st = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;
  res.status(st).json(getClientErrorPayload(err, st));
});

const PORT = parseInt(process.env.PORT, 10) || 5000;
app.listen(PORT, '0.0.0.0', () =>
  logger.info(`POS server running on :${PORT}`)
);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
