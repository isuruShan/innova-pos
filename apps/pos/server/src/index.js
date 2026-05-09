require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createLogger, childLogger } = require('@innovapos/logger');
const connectDB = require('./config/db');

const app = express();
const logger = createLogger('pos-server');
app.locals.logger = logger;

const isProd = process.env.NODE_ENV === 'production';

connectDB(logger);

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());

// HTTP request logging via Winston
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const log = childLogger(logger, req);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[level](`${req.method} ${req.path} ${res.statusCode}`, { ms: Date.now() - start });
  });
  next();
});

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: isProd
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error(`CORS: origin ${origin} not allowed`));
        }
      : true,
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts — please try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/suppliers',  require('./routes/suppliers'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/upload',           require('./routes/upload'));
app.use('/api/settings',         require('./routes/settings'));
app.use('/api/tenant-settings',  require('./routes/tenantSettings'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'pos-server', env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

if (isProd) {
  const path = require('path');
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
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: isProd && status === 500 ? 'Internal server error' : err.message,
  });
});

const PORT = parseInt(process.env.PORT, 10) || 5000;
app.listen(PORT, '0.0.0.0', () =>
  logger.info(`POS server running on :${PORT}`)
);
