import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Subscription Guard Hook for Admin Portal
 * 
 * Checks tenant subscription status and blocks access if suspended/expired/cancelled
 * Exception: Merchant admins can access /subscription page even when suspended
 * Super admins always have full access
 * 
 * Usage:
 *   const ProtectedPage = () => {
 *     useSubscriptionGuard();
 *     return <div>Content</div>;
 *   };
 */
export const useSubscriptionGuard = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user || !tenant) {
      return; // Auth system will handle redirect
    }

    // Super admins always have access
    if (user.role === 'superadmin') {
      return;
    }

    const subscriptionStatus = tenant.subscription?.status;
    const blockedStatuses = ['suspended', 'past_due', 'cancelled'];

    // Check if subscription is blocked
    if (blockedStatuses.includes(subscriptionStatus)) {
      const isSubscriptionPage = 
        location.pathname === '/subscription' ||
        location.pathname.startsWith('/subscription/');

      // Merchant admins can access subscription page to renew
      if (user.role === 'merchant_admin' && isSubscriptionPage) {
        return; // Allow access
      }

      // All other access is blocked - redirect to subscription expired page
      navigate('/subscription-expired', { 
        replace: true,
        state: {
          from: location.pathname,
          subscriptionStatus,
          canRenew: user.role === 'merchant_admin'
        }
      });
    }
  }, [user, tenant, navigate, location.pathname]);
};

/**
 * Get warning info for expiry banner (4 days before expiry)
 * Returns null if no warning needed
 */
export const useExpiryWarning = () => {
  const { tenant } = useAuth();

  if (!tenant?.subscription) {
    return null;
  }

  const sub = tenant.subscription;
  const now = new Date();
  const endDate = new Date(sub.endDate);
  const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  // Show warning if 4 days or less until expiry and subscription is active
  if (sub.status === 'active' && daysUntilExpiry <= 4 && daysUntilExpiry > 0) {
    return {
      showWarning: true,
      daysLeft: daysUntilExpiry,
      expiryDate: endDate
    };
  }

  return null;
};
