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
  const { getClientErrorPayload, createCorsMiddleware } = require('@innovapos/shared-middleware');
  const connectDB = require('./config/db');

  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  connectDB();

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false }));
  app.use(compression());

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [];
  const qrCors = createCorsMiddleware({ allowedOrigins, production: isProd });
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    return qrCors(req, res, next);
  });

  app.use(express.json({ limit: '2mb' }));

  app.use('/api/public/table', require('./routes/tableSession'));

  const clientDist = path.join(__dirname, '../../client/dist');
  const serveClient = isProd && fs.existsSync(clientDist);
  if (isProd && !serveClient) {
    console.warn(
      `[qr-order-server] NODE_ENV=production but ${clientDist} is missing — run "pnpm --filter @qr-order/client run build" (API only until dist exists).`,
    );
  }
  if (serveClient) {
    app.use(
      express.static(clientDist, {
        maxAge: '1y',
        setHeaders(res, filePath) {
          const p = String(filePath).replace(/\\/g, '/');
          if (p.endsWith('/index.html') || p.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      }),
    );
  }

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'qr-order-server', env: process.env.NODE_ENV, ts: new Date().toISOString() }),
  );

  if (serveClient) {
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error(err);
    const status = err.status || err.statusCode || 500;
    const st = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;
    res.status(st).json(getClientErrorPayload(err, st));
  });

  const PORT = parseInt(process.env.PORT, 10) || 5010;
  app.listen(PORT, () => {
    console.log(`[qr-order-server] listening on ${PORT}`);
  });
}

start();
