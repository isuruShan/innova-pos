const sharp = require('sharp');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isOptimizableImageMime(mime) {
  return IMAGE_MIMES.has(mime);
}

/**
 * Resize (max edge), auto-orient from EXIF, encode as WebP.
 * @returns {{ buffer: Buffer, mimeType: 'image/webp' }}
 */
async function optimizeImageToWebp(inputBuffer) {
  const maxDim = parseInt(process.env.UPLOAD_MAX_IMAGE_DIMENSION || '2048', 10);
  const quality = parseInt(process.env.WEBP_QUALITY || '82', 10);

  let img = sharp(inputBuffer).rotate();
  const meta = await img.metadata();

  if (meta.width && meta.height && (meta.width > maxDim || meta.height > maxDim)) {
    img = sharp(inputBuffer)
      .rotate()
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
  }

  const buffer = await img.webp({ quality, effort: 4 }).toBuffer();
  return { buffer, mimeType: 'image/webp' };
}

module.exports = { isOptimizableImageMime, optimizeImageToWebp, IMAGE_MIMES };
