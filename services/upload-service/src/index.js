const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Package .env first; then repo-root .env so INTERNAL_SERVICE_KEY works if only defined once at monorepo root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!String(process.env.INTERNAL_SERVICE_KEY || '').trim()) {
  const rootEnv = path.join(__dirname, '..', '..', '..', '.env');
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
}

async function start() {
  try {
    const { loadSecretsEnvOrExit } = require('@innovapos/runtime-env');
    await loadSecretsEnvOrExit();
  } catch (e) {
    console.error('[runtime-env] Failed to load secrets:', e.message);
    process.exit(1);
  }

  const express = require('express');
const helmet = require('helmet');
const { createLogger } = require('@innovapos/logger');
const { getClientErrorPayload, createCorsMiddleware } = require('@innovapos/shared-middleware');

const app = express();
const logger = createLogger('upload-service');
app.locals.logger = logger;

// Trust proxy
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

app.use(express.json({ limit: '1mb' }));

app.use('/upload', require('./routes/upload'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'upload-service', ts: new Date().toISOString() })
);

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  const raw = err.status || err.statusCode || 500;
  const st = Number.isFinite(raw) && raw >= 400 && raw < 600 ? raw : 500;
  res.status(st).json(getClientErrorPayload(err, st));
});

  const PORT = parseInt(process.env.PORT, 10) || 3002;
  const server = app.listen(PORT, '0.0.0.0', () => {
    const { resolveStorageProvider } = require('@innovapos/object-storage');
    const storage = resolveStorageProvider();
    logger.info(`Upload service running on :${PORT}`, { storage });
    if (!String(process.env.INTERNAL_SERVICE_KEY || '').trim()) {
      logger.warn(
        'INTERNAL_SERVICE_KEY is unset — server-to-server uploads will get 401. Set it in services/upload-service/.env or repo-root .env (must match public-web-server).',
      );
    }
  });

  server.requestTimeout = parseInt(process.env.UPLOAD_HTTP_TIMEOUT_MS || '300000', 10) || 300000;
  server.headersTimeout = server.requestTimeout + 60000;

  const { resolveStorageProvider } = require('@innovapos/object-storage');
  if (resolveStorageProvider() === 'azure') {
    require('@innovapos/object-storage/providers/azure')
      .warmupAzureStorage()
      .then(() => logger.info('Azure storage warmup complete'))
      .catch((e) => logger.warn('Azure storage warmup failed', { error: e.message }));
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
