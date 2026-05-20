import api from './axios.js';

/** Browser timeout for /api/upload (must be ≥ server UPLOAD_PROXY_TIMEOUT_MS). */
export const UPLOAD_CLIENT_TIMEOUT_MS = 300_000;

/**
 * POST multipart upload with extended timeout (menu images, profile photos).
 * @param {FormData} formData
 * @param {{ onUploadProgress?: (e: { loaded: number; total?: number }) => void }} [opts]
 */
export function postUpload(formData, opts = {}) {
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_CLIENT_TIMEOUT_MS,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    ...opts,
  });
}
