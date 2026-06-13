import imageCompression from 'browser-image-compression';

/**
 * Compression presets for different upload contexts.
 */
const PRESETS = {
  menu: { maxSizeMB: 0.5, maxWidthOrHeight: 800, quality: 0.85 },
  profile: { maxSizeMB: 0.3, maxWidthOrHeight: 400, quality: 0.85 },
  logo: { maxSizeMB: 0.3, maxWidthOrHeight: 600, quality: 0.9 },
  receipt: null,         // PDFs and receipt images skip compression
  'br-document': null,   // PDFs skip compression
  default: { maxSizeMB: 1, maxWidthOrHeight: 1200, quality: 0.85 },
};

/**
 * Convert an image File/Blob to WebP format using the Canvas API.
 * Falls back to the original blob if the browser does not support WebP encoding.
 */
const convertToWebP = (blob, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);

      canvas.toBlob(
        (webpBlob) => {
          if (!webpBlob) {
            // Browser doesn't support webp encoding — return original
            resolve(blob);
          } else {
            resolve(webpBlob);
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for WebP conversion'));
    };

    img.src = url;
  });

/**
 * Optimise and convert an image file to WebP before uploading.
 *
 * @param {File} file          - The raw File from an <input type="file">
 * @param {string} type        - Upload type: 'menu' | 'profile' | 'logo' | 'receipt' | 'br-document'
 * @param {function} onProgress - Optional callback: (percent: number) => void
 * @returns {Promise<File>}     - Optimised WebP File ready for upload
 */
export const optimizeImage = async (file, type = 'default', onProgress) => {
  const isPDF = file.type === 'application/pdf';

  // PDFs skip compression — return as-is
  if (isPDF) return file;

  const preset = PRESETS[type] || PRESETS.default;

  // Step 1: Compress with browser-image-compression
  const compressOptions = {
    ...preset,
    useWebWorker: true,
    onProgress,
    fileType: 'image/webp',
  };

  let compressed;
  try {
    compressed = await imageCompression(file, compressOptions);
  } catch {
    // If compression fails, try just converting to WebP
    compressed = file;
  }

  // Step 2: Convert to WebP via Canvas (handles cases where library output isn't webp)
  if (compressed.type !== 'image/webp') {
    const webpBlob = await convertToWebP(compressed, preset.quality);
    const name = file.name.replace(/\.[^.]+$/, '.webp');
    return new File([webpBlob], name, { type: 'image/webp' });
  }

  const name = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([compressed], name, { type: 'image/webp' });
};

/**
 * Read a file as a base64 data URL for local preview before upload.
 */
export const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
