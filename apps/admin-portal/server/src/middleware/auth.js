const { authenticateJWT, authorize, tenantScope } = require('@innovapos/shared-middleware');

module.exports = {
  protect: authenticateJWT,
  authorize,
  tenantScope,
};
