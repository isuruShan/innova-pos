import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CreditCard, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SubscriptionExpiredPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  
  const subscriptionStatus = location.state?.subscriptionStatus || tenant?.subscription?.status || 'suspended';
  const canRenew = location.state?.canRenew ?? (user?.role === 'merchantadmin');
  const suspensionReason = tenant?.subscription?.suspensionReason;

  const getStatusMessage = () => {
    switch (subscriptionStatus) {
      case 'suspended':
        return 'Your subscription has been suspended';
      case 'past_due':
        return 'Your subscription payment is past due';
      case 'cancelled':
        return 'Your subscription has been cancelled';
      default:
        return 'Access restricted';
    }
  };

  const getDetailedMessage = () => {
    if (suspensionReason === 'payment_failure') {
      return 'We were unable to process your last payment. Please update your payment information to restore access.';
    }
    if (suspensionReason === 'expired_subscription') {
      return 'Your subscription period has ended. Please renew to continue using Cafinity services.';
    }
    if (suspensionReason === 'manual_suspension') {
      return 'Your account has been temporarily suspended. Please contact support for assistance.';
    }
    if (suspensionReason === 'policy_violation') {
      return 'Your account has been suspended due to a policy violation. Please contact support.';
    }
    return 'Your subscription is not active. Please renew to continue using Cafinity services.';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-brown-deep">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-2.png" alt="Cafinity" className="h-14 w-auto mx-auto mb-5 rounded-xl shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Cafinity Admin</h1>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {getStatusMessage()}
            </h2>
            <p className="text-gray-300 text-sm">
              {getDetailedMessage()}
            </p>
          </div>

          {user && (
            <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-semibold">Business:</span> {tenant?.businessName || 'N/A'}
              </p>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-semibold">Account:</span> {user.email}
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-semibold">Status:</span>{' '}
                <span className="capitalize text-red-400">{subscriptionStatus}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            {canRenew && (
              <button
                onClick={() => navigate('/subscription')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover"
              >
                <CreditCard size={16} />
                Manage Subscription
              </button>
            )}

            {!canRenew && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
                <Mail size={20} className="mx-auto mb-2 text-yellow-400" />
                <p className="text-sm text-yellow-200">
                  Only merchant administrators can manage subscriptions. Please contact your admin to renew.
                </p>
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl border border-white/20 text-gray-200 text-sm font-semibold hover:bg-white/5 transition-all"
            >
              Return to Home
            </button>
          </div>

          {suspensionReason === 'policy_violation' && (
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-gray-400">
                Need help?{' '}
                <a href="mailto:support@cafinity.io" className="text-brand-teal hover:underline">
                  Contact Support
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
