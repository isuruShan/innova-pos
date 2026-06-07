'use strict';

const aws = require('./providers/aws');
const azure = require('./providers/azure');

/**
 * STORAGE_PROVIDER=azure | aws
 * Auto: AZURE_STORAGE_ACCOUNT_NAME → azure; AWS_S3_BUCKET → aws
 */
function resolveStorageProvider() {
  const explicit = String(process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'azure' || explicit === 'aws') return explicit;
  const cloud = String(
    process.env.CLOUD_PROVIDER || process.env.SECRETS_PROVIDER || '',
  ).toLowerCase();
  const hasAzure = String(process.env.AZURE_STORAGE_ACCOUNT_NAME || '').trim();
  const hasAws = String(process.env.AWS_S3_BUCKET || '').trim();
  if (cloud === 'azure' && hasAzure) return 'azure';
  if (hasAzure) return 'azure';
  if (hasAws) return 'aws';
  return null;
}

function getProvider() {
  const name = resolveStorageProvider();
  if (name === 'azure') return { name, impl: azure };
  if (name === 'aws') return { name, impl: aws };
  throw new Error(
    'Object storage not configured. Set STORAGE_PROVIDER=azure|aws and AZURE_STORAGE_ACCOUNT_NAME or AWS_S3_BUCKET.',
  );
}

async function uploadObject(buffer, key, mimeType) {
  const { impl } = getProvider();
  return impl.uploadObject(buffer, key, mimeType);
}

async function getPresignedUrl(key, expiresInSeconds = 86400) {
  const { impl } = getProvider();
  return impl.getPresignedUrl(key, expiresInSeconds);
}

async function deleteObject(key) {
  const { impl } = getProvider();
  return impl.deleteObject(key);
}

module.exports = {
  resolveStorageProvider,
  uploadObject,
  getPresignedUrl,
  deleteObject,
};
