'use strict';

const axios = require('axios');
const FormData = require('form-data');
const { resolveUploadProxyTimeoutMs } = require('@innovapos/shared-middleware');

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_SERVICE_KEY = String(process.env.INTERNAL_SERVICE_KEY || '').trim();

/**
 * Upload a buffer to the upload-service (prefers internal service key).
 * @param {{ buffer: Buffer, filename: string, mimetype: string, type: string, authorization?: string }} opts
 */
async function proxyUploadToService(opts) {
  const form = new FormData();
  form.append('file', opts.buffer, {
    filename: opts.filename,
    contentType: opts.mimetype,
  });
  form.append('type', opts.type);

  const headers = { ...form.getHeaders() };
  if (INTERNAL_SERVICE_KEY) {
    headers['x-service-key'] = INTERNAL_SERVICE_KEY;
  } else if (opts.authorization) {
    headers.Authorization = opts.authorization;
  }

  try {
    const uploadRes = await axios.post(`${UPLOAD_SERVICE_URL}/upload`, form, {
      headers,
      timeout: resolveUploadProxyTimeoutMs(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return uploadRes.data;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    const detail = body?.message || err.message || 'Upload failed';
    const hint =
      status === 401
        ? 'Set INTERNAL_SERVICE_KEY in admin-portal and upload-service .env (same value).'
        : err.code === 'ECONNREFUSED'
          ? 'Upload service is not running.'
          : '';
    const e = new Error(hint ? `${detail} ${hint}` : detail);
    e.status = status || 502;
    throw e;
  }
}

module.exports = { proxyUploadToService };
