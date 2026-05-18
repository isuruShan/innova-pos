import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function SubscriptionDueBanner() {
  const { isMerchantAdmin } = useAuth();

  const { data } = useQuery({
    queryKey: ['my-subscription-banner'],
    queryFn: async () => {
      const { data: payload } = await api.get('/subscriptions/my');
      return payload;
    },
    enabled: isMerchantAdmin,
    staleTime: 60_000,
  });

  if (!isMerchantAdmin || !data?.tenant) return null;

  const tenant = data.tenant;
  const subscriptions = data.subscriptions || [];
  const latest = subscriptions.length
    ? [...subscriptions].sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0]
    : null;

  const endIso =
    tenant.subscriptionStatus === 'trial'
      ? tenant.trialEndsAt
      : latest?.endDate;

  const days = daysUntil(endIso);
  if (days == null || days < 0 || days > 3) return null;

  const endLabel = new Date(endIso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
      role="alert"
    >
      <div className="flex items-start gap-2 text-amber-900 flex-1">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm">
          {days === 0
            ? `Your subscription is due today (${endLabel}).`
            : `Your subscription is due on ${endLabel} (in ${days} day${days === 1 ? '' : 's'}).`}
          {' '}
          Renew now to avoid losing access.
        </p>
      </div>
      <Link
        to="/subscription"
        className="shrink-0 text-sm font-semibold text-amber-900 underline hover:no-underline"
      >
        Go to Subscription
      </Link>
    </div>
  );
}