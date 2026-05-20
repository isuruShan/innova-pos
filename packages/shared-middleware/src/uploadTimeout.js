'use strict';

/** Axios timeout for server → upload-service (image optimize + blob upload + SAS). */
function resolveUploadProxyTimeoutMs() {
  const n = parseInt(process.env.UPLOAD_PROXY_TIMEOUT_MS || '120000', 10);
  return Number.isFinite(n) && n > 0 ? n : 120000;
}

module.exports = { resolveUploadProxyTimeoutMs };
