const { authenticateJWT } = require('@innovapos/shared-middleware');

/**
 * Allows INTERNAL_SERVICE_KEY via x-service-key header (server-to-server),
 * otherwise requires JWT.
 */
function serviceOrJwt(req, res, next) {
  const key = String(req.headers['x-service-key'] ?? '').trim();
  const secret = String(process.env.INTERNAL_SERVICE_KEY ?? '').trim();
  if (secret.length > 0 && key.length > 0 && key === secret) {
    req.user = {
      id: null,
      role: 'superadmin',
      tenantId: null,
      email: 'service@internal',
    };
    req.tenantId = null;
    return next();
  }
  return authenticateJWT(req, res, next);
}

module.exports = { serviceOrJwt };
