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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createLogger } = require('@innovapos/logger');
const { getRateLimitStore, getClientErrorPayload, createCorsMiddleware } = require('@innovapos/shared-middleware');
const connectDB = require('./config/db');

const app = express();
const logger = createLogger('auth-service');
app.locals.logger = logger;

const limiterStore = await getRateLimitStore(logger);
const limiterOpts = limiterStore ? { store: limiterStore } : {};

connectDB(logger);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: false }));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

app.use(
  createCorsMiddleware({
    allowedOrigins,
    production: process.env.NODE_ENV === 'production',
  }),
);

// Auth-specific rate limiter
app.use(
  '/auth/login',
  rateLimit({
    ...limiterOpts,
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many login attempts — please try again later.' },
  }),
);

app.use(
  '/auth/forgot-password',
  rateLimit({
    ...limiterOpts,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Too many requests' },
  }),
);

app.use(rateLimit({ ...limiterOpts, windowMs: 15 * 60 * 1000, max: 500 }));

app.use(express.json({ limit: '2mb' }));

app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'auth-service', ts: new Date().toISOString() })
);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  const raw = err.status || err.statusCode || 500;
  const st = Number.isFinite(raw) && raw >= 400 && raw < 600 ? raw : 500;
  res.status(st).json(getClientErrorPayload(err, st));
});

const PORT = parseInt(process.env.PORT, 10) || 3001;
app.listen(PORT, '0.0.0.0', () =>
  logger.info(`Auth service running on :${PORT}`)
);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
