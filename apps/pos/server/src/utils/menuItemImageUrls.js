const { presignObjectKey } = require('./s3Runtime');

/**
 * Collect S3 keys from legacy single image + gallery `images[]`.
 * @param {import('mongoose').LeanDocument<any>[]} items
 */
function collectMenuImageKeys(items) {
  const keys = new Set();
  for (const i of items || []) {
    if (i.imageKey) keys.add(String(i.imageKey));
    for (const img of i.images || []) {
      if (img && img.key) keys.add(String(img.key));
    }
  }
  return [...keys];
}

/**
 * Presign keys and merge fresh URLs onto menu items (POS + public QR).
 * @param {import('mongoose').LeanDocument<any>[]} items
 */
async function attachFreshMenuImageUrls(items) {
  if (!items?.length) return items;
  const keys = collectMenuImageKeys(items);
  if (!keys.length) return items;

  const urlPairs = await Promise.all(keys.map(async (key) => [key, await presignObjectKey(key, 86400)]));
  const urlByKey = Object.fromEntries(urlPairs.filter(([, url]) => Boolean(url)));

  return items.map((item) => {
    const next = { ...item };
    if (next.imageKey && urlByKey[next.imageKey]) next.image = urlByKey[next.imageKey];
    if (Array.isArray(next.images) && next.images.length) {
      next.images = next.images.map((img) => ({
        url: img?.key && urlByKey[img.key] ? urlByKey[img.key] : String(img?.url || ''),
        key: img?.key ? String(img.key) : '',
      }));
    }
    return next;
  });
}

/**
 * Normalize gallery + legacy primary image from request body.
 * @param {Record<string, unknown>} body
 */
function normalizeMenuItemImages(body) {
  const raw = body?.images;
  let images = [];
  if (Array.isArray(raw)) {
    images = raw
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        url: String(x.url || '').trim(),
        key: String(x.key || '').trim(),
      }))
      .filter((x) => x.url || x.key);
  }
  if (!images.length && (body?.image || body?.imageKey)) {
    images = [
      {
        url: String(body.image || '').trim(),
        key: String(body.imageKey || '').trim(),
      },
    ].filter((x) => x.url || x.key);
  }
  const first = images[0] || { url: '', key: '' };
  return {
    images,
    image: first.key ? '' : first.url,
    imageKey: first.key || '',
  };
}

module.exports = {
  attachFreshMenuImageUrls,
  normalizeMenuItemImages,
};
