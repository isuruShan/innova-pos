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

module.exports = { presignObjectKey };
