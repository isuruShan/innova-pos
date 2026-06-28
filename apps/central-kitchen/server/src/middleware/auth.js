const { authenticateJWT, authorize, tenantScope, sendRouteError } = require('@innovapos/shared-middleware');

// Rejects access for any role not explicitly permitted in the Central Kitchen app
const protect = (req, res, next) => {
  authenticateJWT(req, res, (err) => {
    if (err) return next(err);
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const allowedRoles = ['merchant_admin', 'commissary_operator', 'purchasing_officer', 'inventory_clerk'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access Denied: This application is restricted to Central Kitchen and Procurement roles.'
      });
    }
    
    next();
  });
};

module.exports = {
  protect,
  authorize,
  tenantScope,
  sendRouteError,
};
