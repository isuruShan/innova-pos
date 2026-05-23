import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader, Building2, ClipboardList, Receipt, Store, ArrowRight, CheckCircle, AlertCircle, Coins, ExternalLink } from 'lucide-react';
import api from '../../api/axios';
import { formatMoney } from '../../components/billing/ProrationBreakdown';

export default function SuperAdminDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['superadmin-dashboard-stats'],
    queryFn: () => api.get('/subscriptions/superadmin/dashboard-stats').then((r) => r.data),
    refetchInterval: 30000, // Refetch every 30 seconds to keep stats fresh
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader size={16} className="animate-spin text-brand-orange" />
          Loading platform dashboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-start gap-2 max-w-2xl mx-auto my-12 animate-fade-in">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Failed to load dashboard data</p>
          <p className="text-xs text-red-700 mt-1">{error.response?.data?.message || error.message}</p>
        </div>
      </div>
    );
  }

  const {
    pendingAppsCount = 0,
    pendingPaymentsCount = 0,
    totalMerchants = 0,
    totalStores = 0,
    revenue = {},
    recentApps = [],
    recentPayments = [],
  } = stats || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Platform Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">Real-time indicators of applications, payments, and system scales.</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Applications */}
        <Link
          to="/applications"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-orange/40 hover:shadow-sm transition-all duration-200 group block relative overflow-hidden"
        >
          {pendingAppsCount > 0 && (
            <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-full translate-x-8 -translate-y-8 -z-0 opacity-40 group-hover:bg-rose-100/50 transition-colors" />
          )}
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending Applications</p>
              <p className="text-2xl font-extrabold text-gray-900">{pendingAppsCount}</p>
            </div>
            <div className={`p-2.5 rounded-lg shrink-0 ${pendingAppsCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-gray-400'}`}>
              <ClipboardList size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 font-semibold group-hover:text-brand-orange transition-colors">
            <span>Review Applications</span>
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 2: Pending Payments */}
        <Link
          to="/payments"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-orange/40 hover:shadow-sm transition-all duration-200 group block relative overflow-hidden"
        >
          {pendingPaymentsCount > 0 && (
            <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-full translate-x-8 -translate-y-8 -z-0 opacity-40 group-hover:bg-amber-100/50 transition-colors" />
          )}
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending Payments</p>
              <p className="text-2xl font-extrabold text-gray-900">{pendingPaymentsCount}</p>
            </div>
            <div className={`p-2.5 rounded-lg shrink-0 ${pendingPaymentsCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
              <Receipt size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 font-semibold group-hover:text-brand-orange transition-colors">
            <span>Verify Payments</span>
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 3: Active Merchants */}
        <Link
          to="/merchants"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-orange/40 hover:shadow-sm transition-all duration-200 group block relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Active Merchants</p>
              <p className="text-2xl font-extrabold text-gray-900">{totalMerchants}</p>
            </div>
            <div className="p-2.5 bg-gray-50 text-gray-500 rounded-lg shrink-0 group-hover:bg-gray-100">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 font-semibold group-hover:text-brand-orange transition-colors">
            <span>Manage Merchants</span>
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Card 4: Active Stores */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Active Store Outlets</p>
              <p className="text-2xl font-extrabold text-gray-900">{totalStores}</p>
            </div>
            <div className="p-2.5 bg-gray-50 text-gray-500 rounded-lg shrink-0">
              <Store size={18} />
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-450">Across all tenant networks</p>
        </div>
      </div>

      {/* Platform Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Action Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Pending Applications */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <ClipboardList size={16} className="text-gray-400" />
                Recent Pending Applications
              </h3>
              {pendingAppsCount > 5 && (
                <Link to="/applications" className="text-xs text-brand-orange hover:underline font-semibold flex items-center gap-0.5">
                  View all ({pendingAppsCount})
                </Link>
              )}
            </div>
            {recentApps.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-1.5">
                <CheckCircle size={28} className="mx-auto text-green-500" />
                <p className="font-medium text-gray-500">All merchant applications reviewed!</p>
                <p className="text-gray-450">New signups will appear here as they are submitted.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-150">
                {recentApps.map((app) => (
                  <div key={app._id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{app.businessName}</p>
                      <p className="text-xs text-gray-550 mt-0.5">
                        Owner: {app.ownerName} · Email: {app.ownerEmail}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Submitted: {new Date(app.createdAt).toLocaleDateString()} at {new Date(app.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Link
                      to={`/applications/${app._id}`}
                      className="text-xs font-semibold text-brand-orange border border-brand-orange/20 hover:border-brand-orange bg-white hover:bg-brand-orange/5 px-2.5 py-1 rounded-md transition-colors flex items-center gap-0.5"
                    >
                      Review <ExternalLink size={10} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Pending Payment Approvals */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Receipt size={16} className="text-gray-400" />
                Recent Pending Payments
              </h3>
              {pendingPaymentsCount > 5 && (
                <Link to="/payments" className="text-xs text-brand-orange hover:underline font-semibold flex items-center gap-0.5">
                  View all ({pendingPaymentsCount})
                </Link>
              )}
            </div>
            {recentPayments.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-1.5">
                <CheckCircle size={28} className="mx-auto text-green-500" />
                <p className="font-medium text-gray-500">All payment approvals completed!</p>
                <p className="text-gray-450">Pending transfers or receipt uploads will show here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-150">
                {recentPayments.map((p) => {
                  const isAddon = p.receiptKind === 'addon' || p.addonCode || p.receiptKind === 'store' || p.receiptKind === 'user_license';
                  return (
                    <div key={p._id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">
                            {p.currency} {Number(p.amount).toLocaleString()}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            isAddon ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}>
                            {p.receiptKind === 'user_license' ? 'User Seat' : p.receiptKind === 'store' ? 'Store Location' : p.receiptKind === 'addon' ? 'Add-on' : 'Subscription'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-550 mt-1">
                          Merchant: <span className="font-medium text-gray-700">{p.tenantId?.businessName || '—'}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Bank Ref: <span className="font-mono">{p.bankReference}</span> · Submitted: {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Link
                        to="/payments"
                        className="text-xs font-semibold text-brand-orange border border-brand-orange/20 hover:border-brand-orange bg-white hover:bg-brand-orange/5 px-2.5 py-1 rounded-md transition-colors"
                      >
                        Verify
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Platform Metrics & Revenue */}
        <div className="space-y-6">
          {/* Revenue Volume */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
              <Coins size={16} className="text-gray-400" />
              Verified Platform Revenue
            </h3>
            
            {Object.keys(revenue).length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No verified payments processed yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(revenue).map(([curr, amt]) => (
                  <div key={curr} className="flex justify-between items-center bg-gray-50 border border-gray-150 rounded-lg p-3">
                    <span className="text-xs text-gray-500 font-bold uppercase">{curr} Volume</span>
                    <span className="text-base font-extrabold text-gray-900 tabular-nums">
                      {formatMoney(curr, amt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Setup Guides / System info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">
              System Settings Shortcuts
            </h3>
            <div className="space-y-2">
              <Link to="/payment-setup" className="flex items-center justify-between text-xs text-gray-600 hover:text-brand-orange hover:underline font-medium p-1 rounded hover:bg-gray-50 transition-colors">
                <span>Configure Stripe/PayPal Credentials</span>
                <ArrowRight size={10} />
              </Link>
              <Link to="/plans" className="flex items-center justify-between text-xs text-gray-600 hover:text-brand-orange hover:underline font-medium p-1 rounded hover:bg-gray-50 transition-colors">
                <span>Create & Edit Subscription Plans</span>
                <ArrowRight size={10} />
              </Link>
              <Link to="/paid-addons" className="flex items-center justify-between text-xs text-gray-600 hover:text-brand-orange hover:underline font-medium p-1 rounded hover:bg-gray-50 transition-colors">
                <span>Manage Available Platform Add-ons</span>
                <ArrowRight size={10} />
              </Link>
              <Link to="/uber-setup" className="flex items-center justify-between text-xs text-gray-600 hover:text-brand-orange hover:underline font-medium p-1 rounded hover:bg-gray-50 transition-colors">
                <span>Platform Uber Eats Settings</span>
                <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
