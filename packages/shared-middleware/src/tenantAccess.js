'use strict';

const CACHE_TTL_SEC = 1800; // 30 minutes
const tenantStatusMemoryCache = new Map(); // tenantId -> { active, expiresAt }

let redisClient = null;
let redisInitAttempted = false;

function getRedis() {
  return null;
}

/** Invalidation helper exported for superadmin status/plan edits. */
async function invalidateTenantSubscriptionCache(tenantId) {
  if (!tenantId) return;
  const tKey = String(tenantId);
  tenantStatusMemoryCache.delete(tKey);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`tenant:sub_active:${tKey}`);
    } catch (e) {
      // ignore
    }
  }
}

/** Queries tenant status and expiration details directly from DB / cache. */
async function getSubscriptionActiveFromDb(tenantId) {
  if (!tenantId) return true;
  const tKey = String(tenantId);
  const now = Date.now();

  // 1. Check local memory cache
  const localCached = tenantStatusMemoryCache.get(tKey);
  if (localCached && localCached.expiresAt > now) {
    return localCached.active;
  }

  // 2. Check Redis cache
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(`tenant:sub_active:${tKey}`);
      if (raw !== null) {
        const active = raw === 'true';
        tenantStatusMemoryCache.set(tKey, {
          active,
          expiresAt: now + CACHE_TTL_SEC * 1000,
        });
        return active;
      }
    } catch (e) {
      // fallback
    }
  }

  // 3. Fallback to database lookup
  try {
    const mongoose = require('mongoose');
    const Tenant = mongoose.models.Tenant || mongoose.model('Tenant');
    if (!Tenant) return true;

    const tenant = await Tenant.findById(tenantId)
      .select('subscriptionStatus trialEndsAt status temporaryActivationUntil')
      .lean();

    let active = false;
    if (tenant) {
      if (tenant.temporaryActivationUntil && new Date() <= new Date(tenant.temporaryActivationUntil)) {
        active = true;
      } else if (tenant.status === 'active') {
        if (tenant.subscriptionStatus === 'active') {
          active = true;
        } else if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date() <= new Date(tenant.trialEndsAt)) {
          active = true;
        }
      }
    }

    // Cache results
    tenantStatusMemoryCache.set(tKey, {
      active,
      expiresAt: now + CACHE_TTL_SEC * 1000,
    });

    if (redis) {
      try {
        await redis.set(`tenant:sub_active:${tKey}`, String(active), 'EX', CACHE_TTL_SEC);
      } catch (e) {
        // ignore
      }
    }

    return active;
  } catch (err) {
    console.error('Error in getSubscriptionActiveFromDb:', err);
    return true; // Fallback to true to prevent complete lockout during db failures
  }
}

/**
 * Merchant portal access when subscription is inactive / tenant suspended.
 * Allows only subscription self-service routes (+ auth profile is handled separately).
 */
function isSubscriptionServiceRoute(req) {
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/forgot') || path.startsWith('/api/auth/reset')) {
    return true;
  }
  if (path.startsWith('/api/auth/me')) return true;
  if (path.startsWith('/api/subscriptions')) return true;
  if (path.startsWith('/api/subscriptions/checkout')) return true;
  if (path.startsWith('/api/plans/for-subscription')) return true;
  if (path.startsWith('/api/platform-payments/merchant-options')) return true;
  if (path.startsWith('/api/subscriptions/webhooks')) return true;
  if (path.startsWith('/api/platform-contact/public')) return true;
  if (path === '/api/health') return true;
  return false;
}

async function requireTenantServiceWhenInactive(req, res, next) {
  if (!req.user) return next();
  if (req.user.role === 'superadmin') return next();

  const subscriptionActive = await getSubscriptionActiveFromDb(req.tenantId || req.user.tenantId);
  if (!subscriptionActive) {
    if (req.user.role === 'merchant_admin' && isSubscriptionServiceRoute(req)) {
      return next();
    }
    return res.status(402).json({
      message: 'Your subscription is inactive. Renew on the Subscription page to restore access.',
      code: 'SUBSCRIPTION_INACTIVE',
    });
  }
  return next();
}

/** POS: block staff when subscription inactive. */
async function requireActiveSubscriptionForPos(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'superadmin') return next();

  const subscriptionActive = await getSubscriptionActiveFromDb(req.tenantId || req.user.tenantId);
  if (!subscriptionActive) {
    return res.status(402).json({
      message: 'Subscription inactive. Contact your administrator to renew.',
      code: 'SUBSCRIPTION_INACTIVE',
    });
  }
  return next();
}

/** Admin Portal: block non-admins when subscription inactive. */
async function requireActiveSubscription(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role === 'superadmin') return next();

  const subscriptionActive = await getSubscriptionActiveFromDb(req.tenantId || req.user.tenantId);
  if (!subscriptionActive) {
    return res.status(402).json({
      message: 'Subscription inactive. Renew your subscription in the admin portal.',
      code: 'SUBSCRIPTION_INACTIVE',
    });
  }
  next();
}

module.exports = {
  isSubscriptionServiceRoute,
  requireTenantServiceWhenInactive,
  requireActiveSubscriptionForPos,
  requireActiveSubscription,
  invalidateTenantSubscriptionCache,
};
