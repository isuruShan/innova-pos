const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * Verifies the Bearer JWT and attaches req.user and req.tenantId.
 * JWT payload shape: { id, name, email, role, tenantId, subscriptionActive, profileImage }
 */
const authenticateJWT = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.tenantId = decoded.tenantId || null;
    next();
  } catch {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Role-based access guard.
 * Usage: router.get('/admin', authenticateJWT, authorize('manager', 'merchant_admin'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access forbidden: insufficient role' });
  }
  next();
};

/**
 * Ensures the authenticated user belongs to the tenant being accessed.
 * Superadmins bypass this check.
 */
const tenantScope = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'superadmin') return next();
  if (!req.tenantId) {
    return res.status(403).json({ message: 'No tenant context in token' });
  }
  next();
};

/**
 * Blocks POS access if the tenant subscription has expired.
 * Superadmins and merchant_admins bypass (so they can still log in to fix things).
 */
const requireActiveSubscription = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const bypassRoles = ['superadmin', 'merchant_admin'];
  if (bypassRoles.includes(req.user.role)) return next();
  if (req.user.subscriptionActive === false) {
    return res.status(402).json({
      message: 'Subscription expired. Please renew to continue.',
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }
  next();
};

/**
 * Emits an audit event to the audit-service.
 * Fire-and-forget — does not block the response.
 */
const emitAudit = async ({
  req,
  action,
  resource,
  resourceId,
  changes = null,
}) => {
  const AUDIT_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:3004';
  try {
    await axios.post(
      `${AUDIT_URL}/audit`,
      {
        tenantId: req.tenantId || req.user?.tenantId || null,
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        action,
        resource,
        resourceId: resourceId ? String(resourceId) : null,
        changes,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null,
        serviceSource: process.env.SERVICE_NAME || 'unknown',
      },
      { timeout: 3000 }
    );
  } catch {
    // Audit logging is best-effort — never fail the main request
  }
};

module.exports = {
  authenticateJWT,
  authorize,
  tenantScope,
  requireActiveSubscription,
  emitAudit,
};
