const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { protect } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3002';

// Memory storage — buffer passed to upload service
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

/**
 * POST /api/upload
 * Proxies the file to the upload-service.
 * Accepts: multipart/form-data with field `image` (legacy) or `file` + optional `type`
 */
router.post('/', protect, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'upload.webp',
      contentType: req.file.mimetype,
    });
    form.append('type', req.body.type || 'menu');

    const token = req.headers.authorization;
    const response = await axios.post(`${UPLOAD_SERVICE_URL}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: token,
      },
      timeout: 30000,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    res.status(status).json({ message });
  }
});

/**
 * POST /api/upload/presign — get a fresh pre-signed URL for an existing S3 key
 */
router.post('/presign', protect, async (req, res) => {
  try {
    const token = req.headers.authorization;
    const response = await axios.post(`${UPLOAD_SERVICE_URL}/upload/presign`, req.body, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ message: err.response?.data?.message || err.message });
  }
});

module.exports = router;
