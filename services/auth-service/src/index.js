require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createLogger } = require('@innovapos/logger');
const connectDB = require('./config/db');

const app = express();
const logger = createLogger('auth-service');
app.locals.logger = logger;

connectDB(logger);

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

// Auth-specific rate limiter
app.use(
  '/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many login attempts — please try again later.' },
  })
);

app.use(
  '/auth/forgot-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { message: 'Too many requests' } })
);

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.use(express.json({ limit: '2mb' }));

app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'auth-service', ts: new Date().toISOString() })
);

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

const PORT = parseInt(process.env.PORT, 10) || 3001;
app.listen(PORT, '0.0.0.0', () =>
  logger.info(`Auth service running on :${PORT}`)
);
