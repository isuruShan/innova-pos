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
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { createLogger } = require('@innovapos/logger');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

const app = express();
const logger = createLogger('audit-service');
app.locals.logger = logger;

mongoose.connect(getMongoConnectionString()).then(() => {
  logger.info('MongoDB connected');
}).catch(err => {
  logger.error('MongoDB connection error', { error: err.message });
  process.exit(1);
});

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: false })); // Audit service is internal-only
app.use(express.json({ limit: '2mb' }));

app.use('/audit', require('./routes/audit'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'audit-service', ts: new Date().toISOString() })
);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3004;
app.listen(PORT, '0.0.0.0', () =>
  logger.info(`Audit service running on :${PORT}`)
);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
