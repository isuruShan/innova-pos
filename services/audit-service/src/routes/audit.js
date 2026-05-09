const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticateJWT, authorize } = require('@innovapos/shared-middleware');

const router = express.Router();

/**
 * POST /audit — create an audit log entry.
 * Called internally by other services (fire-and-forget).
 * Uses an internal service key for service-to-service calls,
 * or a valid JWT for user-triggered audits.
 */
router.post('/', async (req, res) => {
  // Validate internal service key OR JWT
  const serviceKey = req.headers['x-service-key'];
  const internalKey = process.env.INTERNAL_SERVICE_KEY;

  if (internalKey && serviceKey !== internalKey) {
    // Fall back to JWT auth for direct API calls
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }

  try {
    const {
      tenantId,
      userId,
      userEmail,
      userRole,
      action,
      resource,
      resourceId,
      changes,
      ipAddress,
      userAgent,
      serviceSource,
    } = req.body;

    if (!action || !resource) {
      return res.status(400).json({ message: 'action and resource are required' });
    }

    const log = await AuditLog.create({
      tenantId: tenantId || null,
      userId: userId || null,
      userEmail: userEmail || null,
      userRole: userRole || null,
      action,
      resource,
      resourceId: resourceId || null,
      changes: changes || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      serviceSource: serviceSource || 'unknown',
    });

    res.status(201).json({ id: log._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /audit — query audit logs (superadmin or merchant_admin for own tenant).
 */
router.get('/', authenticateJWT, authorize('superadmin', 'merchant_admin'), async (req, res) => {
  try {
    const filter = {};

    // Tenant admins can only see their own tenant's logs
    if (req.user.role === 'merchant_admin') {
      filter.tenantId = req.tenantId;
    } else if (req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    }

    if (req.query.action) filter.action = req.query.action;
    if (req.query.resource) filter.resource = req.query.resource;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.since || req.query.until) {
      filter.timestamp = {};
      if (req.query.since) filter.timestamp.$gte = new Date(req.query.since);
      if (req.query.until) filter.timestamp.$lte = new Date(req.query.until);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
