const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
  const jwt = require('jsonwebtoken');
  const {
    getClientErrorPayload,
    createCorsMiddleware,
    requireTenantServiceWhenInactive,
  } = require('@innovapos/shared-middleware');
  const connectDB = require('./config/db');

  const app = express();
  const logger = createLogger('central-kitchen-server');
  app.locals.logger = logger;

  connectDB(logger);

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false }));

  const fs = require('fs');
  const ckClientDist = path.join(__dirname, '../../client/dist');
  const serveCkStatic = process.env.NODE_ENV === 'production' && fs.existsSync(ckClientDist);
  if (serveCkStatic) {
    app.use(express.static(ckClientDist, { maxAge: '1y' }));
  }

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [];

  const ckCors = createCorsMiddleware({
    allowedOrigins,
    production: process.env.NODE_ENV === 'production',
  });
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    return ckCors(req, res, next);
  });

  app.use(express.json({ limit: '10mb' }));

  function attachUserIfToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      req.user = decoded;
      req.tenantId = decoded.tenantId || null;
    } catch {
      /* route handlers return 401 when auth required */
    }
    return next();
  }

  app.use('/api', attachUserIfToken, requireTenantServiceWhenInactive);

  // Administrative path to get relative imports from admin-portal routes
  const ADMIN_ROUTES = '../../../admin-portal/server/src/routes';

  // Mount local routes
  app.use('/api/central-kitchen', require('./routes/centralKitchen'));
  app.use('/api/variance-analytics', require('./routes/varianceAnalytics'));

  // Mount relative admin-portal routes
  app.use('/api/auth',            require(`${ADMIN_ROUTES}/auth`));
  app.use('/api/tenants',         require(`${ADMIN_ROUTES}/tenants`));
  app.use('/api/tenant-settings', require(`${ADMIN_ROUTES}/tenantSettings`));
  app.use('/api/users',           require(`${ADMIN_ROUTES}/users`));
  app.use('/api/stores',          require(`${ADMIN_ROUTES}/stores`));
  app.use('/api/inventory',       require(`${ADMIN_ROUTES}/inventory`));
  app.use('/api/inventory',       require(`${ADMIN_ROUTES}/audit`));
  app.use('/api/inventory-categories', require(`${ADMIN_ROUTES}/inventoryCategories`));
  app.use('/api/stock-movements', require(`${ADMIN_ROUTES}/stockMovements`));
  app.use('/api/suppliers',       require(`${ADMIN_ROUTES}/suppliers`));
  app.use('/api/purchase-orders', require(`${ADMIN_ROUTES}/purchaseOrders`));
  app.use('/api/goods-receipts',  require(`${ADMIN_ROUTES}/goodsReceipts`));
  app.use('/api/wastage',         require(`${ADMIN_ROUTES}/wastage`));
  app.use('/api/advanced-inventory', require(`${ADMIN_ROUTES}/advancedInventory`));
  app.use('/api/reports',         require(`${ADMIN_ROUTES}/reports`));

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'central-kitchen-server', ts: new Date().toISOString() })
  );

  if (serveCkStatic) {
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(ckClientDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    logger.error('Unhandled error', { error: err.message, path: req.path, stack: err.stack });
    const raw = err.status || err.statusCode || 500;
    const st = Number.isFinite(raw) && raw >= 400 && raw < 600 ? raw : 500;
    res.status(st).json(getClientErrorPayload(err, st));
  });

  const PORT = parseInt(process.env.PORT, 10) || 5005;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Central Kitchen server running on :${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
