import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { Building2, Users, CreditCard, Clock, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import api from '../../api/axios';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: sub } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => { const { data } = await api.get('/subscriptions/my'); return data; },
  });

  const { data: staffTotal } = useQuery({
    queryKey: ['my-users-total'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { page: 1, limit: 1 } });
      const t = data?.total;
      return typeof t === 'number' ? t : (Array.isArray(data) ? data.length : 0);
    },
  });

  const tenant = sub?.tenant;
  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const isExpired = tenant?.subscriptionStatus === 'expired'
    || (tenant?.subscriptionStatus === 'trial' && trialDaysLeft === 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user?.name}</p>
      </div>

      {/* Subscription status banner */}
      {tenant && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          isExpired ? 'bg-red-50 border-red-200' :
          tenant.subscriptionStatus === 'trial' && trialDaysLeft <= 5 ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200'
        }`}>
          {isExpired ? (
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          ) : tenant.subscriptionStatus === 'trial' ? (
            <Clock size={18} className="text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`font-semibold text-sm ${
              isExpired ? 'text-red-700' : tenant.subscriptionStatus === 'trial' ? 'text-amber-700' : 'text-green-700'
            }`}>
              {isExpired ? 'Subscription expired' :
                tenant.subscriptionStatus === 'trial' ? `Free trial — ${trialDaysLeft} days remaining` :
                'Subscription active'}
            </p>
            {tenant.subscriptionStatus === 'trial' && !isExpired && (
              <p className="text-xs text-amber-600 mt-0.5">
                Trial ends {new Date(tenant.trialEndsAt).toLocaleDateString()}. Billing and receipts are available after the trial.
              </p>
            )}
            {isExpired && (
              <p className="text-xs text-red-600 mt-0.5">
                Please upload a payment receipt to reactivate your subscription.
              </p>
            )}
          </div>
          {(isExpired || tenant.subscriptionStatus !== 'active') && (
            <a href="/subscription" className="text-xs font-medium underline shrink-0 mt-0.5
              text-blue-600 hover:text-blue-800">
              View subscription
            </a>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Business name',
            value: tenant?.businessName || '—',
            icon: Building2,
            color: '#3e2723',
          },
          {
            label: 'Staff members',
            value: staffTotal ?? '—',
            icon: Users,
            color: '#0d9488',
          },
          {
            label: 'Subscription',
            value: tenant?.subscriptionStatus || '—',
            icon: CreditCard,
            color: '#ea580c',
            capitalize: true,
          },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: stat.color + '15' }}>
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
            </div>
            <p className={`text-lg font-bold text-gray-900 ${stat.capitalize ? 'capitalize' : ''}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Customize branding', href: '/branding', desc: 'Update logo, colors, business name' },
            { label: 'Manage users', href: '/users', desc: 'Add staff and admin accounts' },
            { label: 'Subscription & billing', href: '/subscription', desc: 'Upload payment receipts' },
            { label: 'Open POS', href: 'http://localhost:5173', external: true, desc: 'Launch the point of sale' },
          ].map(action => (
            <a key={action.label}
              href={action.href}
              target={action.external ? '_blank' : '_self'}
              rel={action.external ? 'noreferrer' : undefined}
              className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-brand-orange/40 hover:shadow-sm transition-all group">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-orange transition-colors">
                  {action.label}
                  {action.external && <ExternalLink size={11} className="inline ml-1 mb-0.5" />}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
