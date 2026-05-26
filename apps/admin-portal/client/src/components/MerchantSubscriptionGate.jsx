import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SubscriptionBlockedPopup from './SubscriptionBlockedPopup';

const ALLOWED_PATHS = ['/subscription', '/profile', '/login', '/forgot-password', '/reset-password'];

export default function MerchantSubscriptionGate({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user || user.role === 'superadmin') return children;
  if (user.subscriptionActive !== false) return children;

  // If merchant admin, allow self-service paths
  if (user.role === 'merchant_admin') {
    if (ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return children;
    }
    return <Navigate to="/subscription" replace state={{ subscriptionBlocked: true }} />;
  }

  // Other staff roles see the strict blocking overlay popup
  return <SubscriptionBlockedPopup />;
}
