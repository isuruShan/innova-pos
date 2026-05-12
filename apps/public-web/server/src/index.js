const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Package .env first; then repo-root .env so INTERNAL_SERVICE_KEY is found when defined only once at monorepo root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!String(process.env.INTERNAL_SERVICE_KEY || '').trim()) {
  const rootEnv = path.join(__dirname, '..', '..', '..', '..', '.env');
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
}

async function start() {
  try {
    const { loadAwsSecretsManagerEnv } = require('@innovapos/runtime-env');
    await loadAwsSecretsManagerEnv();
  } catch (e) {
    console.error('[runtime-env] Failed to load AWS Secrets Manager:', e.message);
    process.exit(1);
  }

  const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createLogger } = require('@innovapos/logger');
const { getRateLimitStore, getClientErrorPayload } = require('@innovapos/shared-middleware');
const connectDB = require('./config/db');

const app = express();
const logger = createLogger('public-web-server');
app.locals.logger = logger;

const limiterStore = await getRateLimitStore(logger);
const limiterOpts = limiterStore ? { store: limiterStore } : {};

connectDB(logger);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed')))
    : true,
  credentials: true,
}));

app.use(rateLimit({ ...limiterOpts, windowMs: 15 * 60 * 1000, max: 200 }));
app.use(express.json({ limit: '2mb' }));

const contactRouter = require('./routes/contact');
contactRouter.initContactRateLimit(limiterStore);

app.use('/applications', require('./routes/applications'));
app.use('/plans', require('./routes/plans'));
app.use('/newsletter', require('./routes/newsletter'));
app.use('/contact', contactRouter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'public-web-server', ts: new Date().toISOString() })
);

if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const clientDist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1y' }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  const raw = err.status || err.statusCode || 500;
  const st = Number.isFinite(raw) && raw >= 400 && raw < 600 ? raw : 500;
  res.status(st).json(getClientErrorPayload(err, st));
});

const PORT = parseInt(process.env.PORT, 10) || 5002;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Public web server running on :${PORT}`);
  if (!String(process.env.INTERNAL_SERVICE_KEY || '').trim()) {
    logger.warn(
      'INTERNAL_SERVICE_KEY is unset — BR uploads to upload-service will return 401. Set the same value in apps/public-web/server/.env, services/upload-service/.env, or repo-root .env'
    );
  }
});
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
