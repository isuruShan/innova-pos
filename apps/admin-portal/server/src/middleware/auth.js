const { authenticateJWT, authorize, tenantScope, sendRouteError } = require('@innovapos/shared-middleware');

module.exports = {
  protect: authenticateJWT,
  authorize,
  tenantScope,
  sendRouteError,
};
