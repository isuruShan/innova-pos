import { LogOut, CreditCard } from 'lucide-react';
import { adminPath } from '@innovapos/app-urls';
import { useAuth } from '../context/AuthContext';

export default function SubscriptionBlocked() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
          <CreditCard size={22} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Subscription inactive</h1>
        <p className="text-sm text-gray-600">
          {user?.role === 'merchant_admin'
            ? 'Your merchant subscription is inactive. Renew in the admin portal to restore POS access.'
            : 'Your organization’s subscription is inactive. Ask your administrator to renew in the admin portal.'}
        </p>
        {user?.role === 'merchant_admin' && (
          <a
            href={adminPath('/subscription')}
            className="inline-flex items-center justify-center w-full py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            Open Subscription in admin portal
          </a>
        )}
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
