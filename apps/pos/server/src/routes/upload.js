const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { protect } = require('../middleware/auth');
const { resolveUploadProxyTimeoutMs } = require('@innovapos/shared-middleware');

const router = express.Router();

function resolveUploadServiceUrl() {
  const raw = String(process.env.UPLOAD_SERVICE_URL || 'http://127.0.0.1:3002').trim();
  try {
    const u = new URL(raw);
    if (u.hostname === 'localhost') u.hostname = '127.0.0.1';
    return u.toString().replace(/\/$/, '');
  } catch {
    return 'http://127.0.0.1:3002';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/webp', 'image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (webp/jpeg/png) and PDFs are allowed'));
    }
  },
});

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

function pickUploadedFile(req) {
  return req.files?.image?.[0] || req.files?.file?.[0] || req.file || null;
}

/** Long-running uploads (Azure blob + SAS can exceed 30s on small VMs). */
function extendUploadTimeouts(req, res, next) {
  const ms = resolveUploadProxyTimeoutMs();
  req.setTimeout(ms);
  res.setTimeout(ms);
  if (req.socket) req.socket.setTimeout(ms);
  next();
}

/**
 * POST /api/upload
 * Proxies the file to the upload-service.
 * Accepts: multipart/form-data with field `image` (legacy) or `file` + optional `type`
 */
router.post('/', protect, extendUploadTimeouts, uploadFields, async (req, res) => {
  const file = pickUploadedFile(req);
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  const uploadTimeoutMs = resolveUploadProxyTimeoutMs();
  const uploadServiceUrl = resolveUploadServiceUrl();

  try {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'upload.webp',
      contentType: file.mimetype,
    });
    form.append('type', req.body.type || 'menu');

    const token = req.headers.authorization;
    const response = await axios.post(`${uploadServiceUrl}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: token,
      },
      timeout: uploadTimeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    let message = err.response?.data?.message || err.message;
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      message = `Upload service unreachable at ${uploadServiceUrl}. Run: pm2 logs upload-service — and curl http://127.0.0.1:3002/health`;
    } else if (String(message).includes('timeout')) {
      message = `${message} (POS→${uploadServiceUrl}). Often Azure credential/storage: run node scripts/verify-upload-chain.js on the VM.`;
    }
    res.status(status).json({ message });
  }
});

/**
 * POST /api/upload/presign — get a fresh pre-signed URL for an existing S3 key
 */
router.post('/presign', protect, async (req, res) => {
  try {
    const token = req.headers.authorization;
    const response = await axios.post(`${resolveUploadServiceUrl()}/upload/presign`, req.body, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      timeout: resolveUploadProxyTimeoutMs(),
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ message: err.response?.data?.message || err.message });
  }
});

module.exports = router;
