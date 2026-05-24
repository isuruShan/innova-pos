const axios = require('axios');

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_SERVICE_KEY = String(process.env.INTERNAL_SERVICE_KEY || '').trim();

async function presignObjectKey(key, expiresIn = 86400) {
  if (!key || !INTERNAL_SERVICE_KEY) return '';
  try {
    const { data } = await axios.post(
      `${UPLOAD_SERVICE_URL}/upload/presign`,
      { key, expiresIn },
      {
        headers: {
          'x-service-key': INTERNAL_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );
    return data?.url || '';
  } catch {
    return '';
  }
}

/**
 * Batch presign multiple S3 keys in a single HTTP call.
 * Returns an object mapping keys to their presigned URLs.
 * @param {string[]} keys - Array of S3 object keys to presign
 * @param {number} expiresIn - URL expiration time in seconds (default: 86400 = 24h)
 * @returns {Promise<Record<string, string>>} Map of key -> presigned URL
 */
async function presignObjectKeys(keys, expiresIn = 86400) {
  if (!keys?.length || !INTERNAL_SERVICE_KEY) return {};
  try {
    const { data } = await axios.post(
      `${UPLOAD_SERVICE_URL}/upload/presign-batch`,
      { keys, expiresIn },
      {
        headers: {
          'x-service-key': INTERNAL_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );
    return data?.urls || {};
  } catch {
    return {};
  }
}

module.exports = { presignObjectKey, presignObjectKeys };
