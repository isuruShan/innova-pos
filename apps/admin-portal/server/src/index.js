const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createLogger } = require('@innovapos/logger');
const connectDB = require('./config/db');
const { getMailConfigurationIssue } = require('@innovapos/mail-transport');

const app = express();
const logger = createLogger('admin-portal-server');
app.locals.logger = logger;

connectDB(logger);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed')))
    : true,
  credentials: true,
}));

app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',            require('./routes/auth'));
app.use('/api/applications',    require('./routes/applications'));
app.use('/api/tenants',         require('./routes/tenants'));
app.use('/api/subscriptions',   require('./routes/subscriptions'));
app.use('/api/tenant-settings', require('./routes/tenantSettings'));
app.use('/api/users',           require('./routes/users'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'admin-portal-server', ts: new Date().toISOString() })
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
  logger.error('Unhandled error', { error: err.message, path: req.path });
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = parseInt(process.env.PORT, 10) || 5001;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Admin portal server running on :${PORT}`);
  const mailIssue = getMailConfigurationIssue();
  if (mailIssue) {
    logger.warn(`Outbound email not configured: ${mailIssue}`);
  }
});
