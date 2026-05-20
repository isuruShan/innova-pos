'use strict';

const { presignObjectKey } = require('../utils/s3Runtime');

/** Resolve stored paths/keys to browser URLs (presign S3 keys, pass through http(s) and site paths). */
async function resolveMediaUrl(urlOrKey) {
  const raw = String(urlOrKey || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
  return presignObjectKey(raw, 86400);
}

async function resolveMediaUrls(urls) {
  const list = Array.isArray(urls) ? urls : [];
  return Promise.all(list.map((u) => resolveMediaUrl(u)));
}

module.exports = { resolveMediaUrl, resolveMediaUrls };
