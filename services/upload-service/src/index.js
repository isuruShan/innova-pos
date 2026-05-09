const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Package .env first; then repo-root .env so INTERNAL_SERVICE_KEY works if only defined once at monorepo root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!String(process.env.INTERNAL_SERVICE_KEY || '').trim()) {
  const rootEnv = path.join(__dirname, '..', '..', '..', '.env');
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createLogger } = require('@innovapos/logger');

const app = express();
const logger = createLogger('upload-service');
app.locals.logger = logger;

// Trust proxy
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error(`CORS: origin ${origin} not allowed`));
        }
      : true,
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many upload requests' },
  })
);

app.use(express.json({ limit: '1mb' }));

app.use('/upload', require('./routes/upload'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'upload-service', ts: new Date().toISOString() })
);

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message,
  });
});

const PORT = parseInt(process.env.PORT, 10) || 3002;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Upload service running on :${PORT}`);
  if (!String(process.env.INTERNAL_SERVICE_KEY || '').trim()) {
    logger.warn(
      'INTERNAL_SERVICE_KEY is unset — server-to-server uploads will get 401. Set it in services/upload-service/.env or repo-root .env (must match public-web-server).'
    );
  }
});
