const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { authenticateJWT } = require('@innovapos/shared-middleware');
const { serviceOrJwt } = require('../middleware/serviceOrJwt');
const { uploadToS3, getPresignedUrl, deleteFromS3 } = require('../s3');
const { childLogger } = require('@innovapos/logger');
const { isOptimizableImageMime, optimizeImageToWebp } = require('../imageOptimize');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const ALLOWED_DOC_TYPES = ['application/pdf'];
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10) * 1024 * 1024;
const MAX_DOC_SIZE = parseInt(process.env.MAX_DOC_SIZE_MB || '10', 10) * 1024 * 1024;

const UPLOAD_TYPES = {
  menu: { folder: 'menu', allowed: ALLOWED_IMAGE_TYPES, maxSize: MAX_IMAGE_SIZE },
  profile: { folder: 'profiles', allowed: ALLOWED_IMAGE_TYPES, maxSize: MAX_IMAGE_SIZE },
  logo: { folder: 'logos', allowed: ALLOWED_IMAGE_TYPES, maxSize: MAX_IMAGE_SIZE },
  receipt: { folder: 'receipts', allowed: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES], maxSize: MAX_DOC_SIZE },
  /** Business registration: images only (optimized to WebP on server) */
  'br-document': { folder: 'br-documents', allowed: ALLOWED_IMAGE_TYPES, maxSize: MAX_DOC_SIZE },
};

// Memory storage — we may replace buffer with optimized WebP before S3
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_DOC_SIZE },
  fileFilter: (_req, file, cb) => {
    const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];
    if (allAllowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

/**
 * POST /upload
 * Body: multipart/form-data with fields:
 *   - file: the file
 *   - type: one of menu | profile | logo | receipt | br-document
 * Images are resized (max edge) and converted to WebP before S3. PDFs (receipt type only) pass through unchanged.
 */
router.post('/', serviceOrJwt, upload.single('file'), async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadType = req.body.type || 'menu';
    const config = UPLOAD_TYPES[uploadType];
    if (!config) {
      return res.status(400).json({ message: `Invalid upload type. Allowed: ${Object.keys(UPLOAD_TYPES).join(', ')}` });
    }

    if (!config.allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ message: `File type ${req.file.mimetype} not allowed for ${uploadType}` });
    }

    if (req.file.size > config.maxSize) {
      return res.status(400).json({ message: `File too large. Max ${config.maxSize / 1024 / 1024}MB` });
    }

    const tenantId = req.user.role === 'superadmin' ? 'system' : (req.tenantId || 'system');

    let uploadBuffer = req.file.buffer;
    let uploadMime = req.file.mimetype;
    let uploadSize = req.file.size;

    const isPdf = req.file.mimetype === 'application/pdf';

    if (isPdf) {
      if (!config.allowed.includes('application/pdf')) {
        return res.status(400).json({ message: 'PDF uploads are not allowed for this document type' });
      }
    } else if (isOptimizableImageMime(req.file.mimetype)) {
      try {
        const optimized = await optimizeImageToWebp(uploadBuffer);
        uploadBuffer = optimized.buffer;
        uploadMime = optimized.mimeType;
        uploadSize = uploadBuffer.length;
        if (uploadSize > config.maxSize) {
          return res.status(400).json({
            message: `After optimization the file still exceeds max ${config.maxSize / 1024 / 1024}MB — try a smaller image.`,
          });
        }
      } catch (optErr) {
        logger.error('Image optimization failed', { error: optErr.message });
        return res.status(400).json({ message: 'Could not process image. Use JPEG, PNG, or WebP.' });
      }
    } else {
      return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}` });
    }

    const extMap = {
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    const ext = extMap[uploadMime] || 'bin';
    const key = `tenants/${tenantId}/${config.folder}/${uuidv4()}.${ext}`;

    await uploadToS3(uploadBuffer, key, uploadMime);
    const url = await getPresignedUrl(key, 3600);

    logger.info('File uploaded', { key, size: uploadSize, type: uploadType, mimeType: uploadMime });

    res.status(201).json({
      key,
      url,
      size: uploadSize,
      mimeType: uploadMime,
    });
  } catch (err) {
    logger.error('Upload failed', { error: err.message });
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /upload/presign
 */
router.post('/presign', serviceOrJwt, async (req, res) => {
  const { key, expiresIn = 3600 } = req.body;
  if (!key) return res.status(400).json({ message: 'key is required' });

  const isService = req.headers['x-service-key'] && req.headers['x-service-key'] === process.env.INTERNAL_SERVICE_KEY;

  if (!isService && req.user.role !== 'superadmin') {
    const tenantId = req.tenantId;
    if (tenantId && !key.startsWith(`tenants/${tenantId}/`) && !key.startsWith('tenants/system/')) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }
  }

  try {
    const url = await getPresignedUrl(key, Math.min(expiresIn, 86400));
    res.json({ url, expiresIn });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /upload
 */
router.delete('/', authenticateJWT, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ message: 'key is required' });

  if (req.user.role !== 'superadmin') {
    const tenantId = req.tenantId;
    if (tenantId && !key.startsWith(`tenants/${tenantId}/`)) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }
  }

  try {
    await deleteFromS3(key);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
