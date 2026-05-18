'use strict';

/**
 * Merchant portal access when subscription is inactive / tenant suspended.
 * Allows only subscription self-service routes (+ auth profile is handled separately).
 */
function isSubscriptionServiceRoute(req) {
  const path = String(req.path || req.originalUrl || '').split('?')[0];
  if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/forgot') || path.startsWith('/api/auth/reset')) {
    return true;
  }
  if (path.startsWith('/api/auth/me')) return true;
  if (path.startsWith('/api/subscriptions')) return true;
  if (path.startsWith('/api/subscriptions/checkout')) return true;
  if (path.startsWith('/api/plans/for-subscription')) return true;
  if (path.startsWith('/api/platform-payments/merchant-options')) return true;
  if (path.startsWith('/api/subscriptions/webhooks')) return true;
  if (path === '/api/health') return true;
  return false;
}

function requireTenantServiceWhenInactive(req, res, next) {
  if (!req.user) return next();
  if (req.user.role === 'superadmin') return next();
  if (req.user.subscriptionActive !== false) return next();
  if (isSubscriptionServiceRoute(req)) return next();
  return res.status(402).json({
    message: 'Your subscription is inactive. Renew on the Subscription page to restore access.',
    code: 'SUBSCRIPTION_INACTIVE',
  });
}

/** POS: block staff when subscription inactive (merchant_admin included). */
function requireActiveSubscriptionForPos(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'superadmin') return next();
  if (req.user.subscriptionActive === false) {
    return res.status(402).json({
      message: 'Subscription inactive. Contact your administrator to renew.',
      code: 'SUBSCRIPTION_INACTIVE',
    });
  }
  return next();
}

module.exports = {
  isSubscriptionServiceRoute,
  requireTenantServiceWhenInactive,
  requireActiveSubscriptionForPos,
};
