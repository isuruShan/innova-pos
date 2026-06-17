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
const connectDB = require('./config/db');

const app = express();
const logger = createLogger('public-web-server');
app.locals.logger = logger;

connectDB(logger);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: false }));

const publicClientDist = path.join(__dirname, '../../client/dist');
const servePublicStatic = process.env.NODE_ENV === 'production' && fs.existsSync(publicClientDist);
if (servePublicStatic) {
  app.use(express.static(publicClientDist, { maxAge: '1y' }));
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

app.use(
  createCorsMiddleware({
    allowedOrigins,
    production: process.env.NODE_ENV === 'production',
  }),
);

app.use(express.json({ limit: '2mb' }));

app.use('/api/applications', require('./routes/applications'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/customer-checkin', require('./routes/customerCheckin'));

// Log POS_URL configuration for customer registration SSE
const posUrl = process.env.POS_URL || 'http://localhost:5000';
logger.info(`[customer-checkin] Will trigger POS server at: ${posUrl}`);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'public-web-server', ts: new Date().toISOString() })
);

if (servePublicStatic) {
  let cachedIndexHtml = null;
  app.get('/{*path}', (req, res) => {
    const indexPath = path.join(publicClientDist, 'index.html');
    try {
      if (!cachedIndexHtml || process.env.NODE_ENV !== 'production') {
        cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
      }
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const origin = `${protocol}://${host}`;
      
      const dynamicHtml = cachedIndexHtml.replace(/https:\/\/cafinity\.io/g, origin);
      res.send(dynamicHtml);
    } catch (err) {
      logger.error('Failed to dynamically serve index.html, falling back to static sendFile', { error: err.message });
      res.sendFile(indexPath);
    }
  });
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
