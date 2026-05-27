/**
 * Subscription Check Middleware
 * 
 * Blocks access when tenant subscription is suspended/expired/past_due/cancelled
 * Exception: Merchant admins can access subscription management endpoints even when suspended
 * Super admins always have access (for support)
 * 
 * Usage:
 *   router.get('/api/orders', protect, tenantScope, subscriptionCheck, getOrders);
 */

const subscriptionCheck = async (req, res, next) => {
  try {
    const user = req.user;
    const tenant = req.tenant;

    if (!user || !tenant) {
      return res.status(401).json({
        success: false,
        error: 'authentication_required',
        message: 'User or tenant not found'
      });
    }

    // Super admins can always access (for support purposes)
    if (user.role === 'superadmin') {
      return next();
    }

    // Check subscription status
    const status = tenant.subscription?.status;
    const blockedStatuses = ['suspended', 'past_due', 'cancelled'];

    if (blockedStatuses.includes(status)) {
      // Check if user is accessing subscription/billing endpoints
      const isSubscriptionEndpoint = 
        req.path.includes('/api/subscription') || 
        req.path.includes('/api/billing') ||
        req.path.includes('/api/payment') ||
        req.path.includes('/api/plans'); // Allow viewing plans

      // Merchant admins can access subscription endpoints only
      if (user.role === 'merchantadmin' && isSubscriptionEndpoint) {
        return next();
      }

      // All other access is blocked
      return res.status(403).json({
        success: false,
        error: 'subscription_required',
        message: 'Your subscription has expired or been suspended. Please contact your administrator.',
        subscriptionStatus: status,
        suspensionReason: tenant.subscription?.suspensionReason,
        canRenew: user.role === 'merchantadmin',
        renewUrl: user.role === 'merchantadmin' ? '/subscription' : null
      });
    }

    // Subscription is active - allow access
    next();
  } catch (error) {
    console.error('[subscriptionCheck] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'subscription_check_failed',
      message: 'Unable to verify subscription status'
    });
  }
};

/**
 * Middleware specifically for merchant admin subscription page access
 * Allows access even when subscription is suspended
 * Only merchant admins and super admins can access
 */
const allowSubscriptionPageAccess = (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'authentication_required',
      message: 'Authentication required'
    });
  }

  // Only merchant admins and super admins can access subscription management
  if (!['merchantadmin', 'superadmin'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      error: 'insufficient_permissions',
      message: 'Only administrators can manage subscriptions'
    });
  }

  next();
};

/**
 * Check if warning banner should be shown (4 days or less before expiry)
 * Adds warningInfo to request if applicable
 */
const checkExpiryWarning = (req, res, next) => {
  const tenant = req.tenant;
  
  if (!tenant?.subscription) {
    return next();
  }

  const sub = tenant.subscription;
  const now = new Date();
  const endDate = new Date(sub.endDate);
  const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  // Show warning if 4 days or less until expiry and subscription is active
  if (sub.status === 'active' && daysUntilExpiry <= 4 && daysUntilExpiry > 0) {
    req.warningInfo = {
      showWarning: true,
      daysLeft: daysUntilExpiry,
      expiryDate: endDate
    };
  }

  next();
};

module.exports = {
  subscriptionCheck,
  allowSubscriptionPageAccess,
  checkExpiryWarning
};
