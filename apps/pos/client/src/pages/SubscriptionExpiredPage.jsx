import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SubscriptionExpiredPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  
  const subscriptionStatus = location.state?.subscriptionStatus || tenant?.subscription?.status || 'suspended';
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
      return 'We were unable to process your last payment. Please contact your administrator to restore access.';
    }
    if (suspensionReason === 'expired_subscription') {
      return 'Your subscription period has ended. Please contact your administrator to renew.';
    }
    if (suspensionReason === 'manual_suspension') {
      return 'Your account has been temporarily suspended. Please contact your administrator for assistance.';
    }
    if (suspensionReason === 'policy_violation') {
      return 'Your account has been suspended. Please contact your administrator.';
    }
    return 'Your subscription is not active. Please contact your administrator to renew.';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Cafinity POS" className="h-14 w-auto mx-auto mb-5 rounded-xl shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Cafinity POS</h1>
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

          {user && tenant && (
            <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-semibold">Business:</span> {tenant?.businessName || 'N/A'}
              </p>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-semibold">User:</span> {user.email}
              </p>
              <p className="text-sm text-gray-300">
                <span className="font-semibold">Status:</span>{' '}
                <span className="capitalize text-red-400">{subscriptionStatus}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
              <Mail size={20} className="mx-auto mb-2 text-yellow-400" />
              <p className="text-sm text-yellow-200 mb-2">
                Please contact your merchant administrator to renew your subscription.
              </p>
              <p className="text-xs text-yellow-300/70">
                Only merchant admins can manage subscriptions via the Admin Portal.
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 text-gray-200 text-sm font-semibold hover:bg-white/5 transition-all"
            >
              <Home size={16} />
              Return to Home
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-gray-400">
              Need help?{' '}
              <a href="mailto:support@cafinity.io" className="text-blue-400 hover:underline">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
