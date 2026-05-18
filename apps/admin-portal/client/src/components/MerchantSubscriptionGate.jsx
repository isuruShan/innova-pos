import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ALLOWED_PATHS = ['/subscription', '/login', '/forgot-password', '/reset-password'];

export default function MerchantSubscriptionGate({ children }) {
  const { user, isMerchantAdmin } = useAuth();
  const { pathname } = useLocation();

  if (!isMerchantAdmin || !user) return children;
  if (user.subscriptionActive !== false) return children;
  if (ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return children;
  }

  return <Navigate to="/subscription" replace state={{ subscriptionBlocked: true }} />;
}
