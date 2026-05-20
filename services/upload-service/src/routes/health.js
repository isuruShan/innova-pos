'use strict';

const express = require('express');
const { resolveStorageProvider } = require('@innovapos/object-storage');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'upload-service',
    env: process.env.NODE_ENV,
    storageProvider: resolveStorageProvider(),
    ts: new Date().toISOString(),
  });
});

/** Tests managed identity → blob (same path as menu upload). */
router.get('/storage', async (req, res) => {
  const logger = req.app.locals.logger;
  const provider = resolveStorageProvider();
  if (!provider) {
    return res.status(503).json({
      ok: false,
      message:
        'Storage not configured. Set STORAGE_PROVIDER=azure and AZURE_STORAGE_ACCOUNT_NAME in Key Vault.',
    });
  }

  if (provider === 'aws') {
    return res.json({
      ok: true,
      provider: 'aws',
      bucket: process.env.AWS_S3_BUCKET || null,
      message: 'AWS configured (no live probe in /health/storage)',
    });
  }

  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const container =
    process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.AZURE_STORAGE_CONTAINER || 'uploads';

  const t0 = Date.now();
  try {
    const azure = require('@innovapos/object-storage/providers/azure');
    await azure.warmupAzureStorage();
    const warmupMs = Date.now() - t0;
    res.json({
      ok: true,
      provider: 'azure',
      account,
      container,
      warmupMs,
    });
  } catch (err) {
    logger?.warn?.('Storage health check failed', { error: err.message });
    res.status(503).json({
      ok: false,
      provider: 'azure',
      account,
      container,
      message: err.message,
      hint:
        'Assign VM managed identity: Storage Blob Data Contributor + Storage Blob Delegator on the storage account.',
      elapsedMs: Date.now() - t0,
    });
  }
});

module.exports = router;
