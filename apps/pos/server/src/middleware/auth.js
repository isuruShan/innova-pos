/**
 * Re-exports the shared middleware so existing route files that import from
 * '../middleware/auth' continue to work unchanged.
 */
const {
  authenticateJWT,
  authorize,
  tenantScope,
  requireActiveSubscription,
  sendRouteError,
} = require('@innovapos/shared-middleware');

module.exports = {
  protect: authenticateJWT,
  authorize,
  tenantScope,
  requireActiveSubscription,
  sendRouteError,
};
