import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Key, Wallet } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import { unwrapPagedList } from '../../utils/unwrapPagedList';

export default function MerchantWorkspacePage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [storeForm, setStoreForm] = useState({
    name: '',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    phone: '',
    paymentMethods: ['cash'],
  });
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_workspace_admins');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });
  const [activeTab, setActiveTab] = useState('current');

  const { data: breakdowns, isLoading: breakdownsLoading } = useQuery({
    queryKey: ['tenant-billing-breakdowns', id],
    queryFn: async () => {
      const { data } = await api.get(`/tenants/${id}/billing-breakdowns`);
      return data;
    },
    enabled: Boolean(id),
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-workspace', id],
    queryFn: async () => {
      const { data } = await api.get(`/tenants/${id}`);
      return data;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['workspace-plans'],
    queryFn: async () => {
      const { data } = await api.get('/plans', { params: { status: 'active' } });
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: storesList } = useQuery({
    queryKey: ['workspace-stores', id],
    queryFn: async () => {
      const { data } = await api.get('/stores', { params: { tenantId: id, page: 1, limit: 200 } });
      return unwrapPagedList(data);
    },
  });
  const stores = storesList?.items || [];

  const { data: adminsList } = useQuery({
    queryKey: ['workspace-admins', id],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { tenantId: id, role: 'merchant_admin', page: 1, limit: 50 } });
      return unwrapPagedList(data);
    },
  });
  const admins = (adminsList?.items || []).filter((u) => u.role === 'merchant_admin');

  const cashierRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }, []);

  const { data: cashierSessionsList, isLoading: cashierSessionsLoading } = useQuery({
    queryKey: ['workspace-cashier-sessions', id, cashierRange.from, cashierRange.to],
    queryFn: async () => {
      const { data } = await api.get('/cashier-sessions', {
        params: {
          tenantId: id,
          from: `${cashierRange.from}T00:00:00`,
          until: `${cashierRange.to}T23:59:59`,
          page: 1,
          limit: 100,
        },
        headers: { 'x-store-id': 'all' },
      });
      return unwrapPagedList(data);
    },
    enabled: Boolean(id),
  });
  const cashierSessions = cashierSessionsList?.items || [];

  const assignPlanMutation = useMutation({
    mutationFn: ({ planId, planLocked }) => api.put(`/tenants/${id}/plan`, { planId, planLocked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-workspace', id] }),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/tenants/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-workspace', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const activateOneDayMutation = useMutation({
    mutationFn: () => api.post(`/tenants/${id}/temporary-activation/activate-one-day`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-workspace', id] });
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: (payload) => api.post('/stores', { ...payload, tenantId: id }),
    onSuccess: () => {
      setStoreForm({
        name: '',
        address: {
          street1: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        phone: '',
        paymentMethods: ['cash'],
      });
      queryClient.invalidateQueries({ queryKey: ['workspace-stores', id] });
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: ({ storeId, payload }) => api.put(`/stores/${storeId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-stores', id] }),
  });

  const resetAdminPasswordMutation = useMutation({
    mutationFn: (userId) => api.post(`/users/${userId}/reset-password`),
  });

  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_workspace_admins', mode);
  };

  if (tenantLoading) return <div className="py-10 text-sm text-gray-500">Loading merchant workspace...</div>;
  if (!tenant) return <div className="py-10 text-sm text-gray-500">Merchant not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/merchants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} />
        Back to merchants
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-brown-deep flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{tenant.businessName}</h2>
              <p className="text-xs text-gray-500">{tenant.slug}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => statusMutation.mutate(tenant.status === 'active' ? 'suspended' : 'active')}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {tenant.status === 'active' ? 'Suspend' : 'Activate'}
            </button>

            {tenant.subscriptionStatus === 'expired' && tenant.temporaryActivationRequestedAt && (
              <button
                onClick={() => activateOneDayMutation.mutate()}
                className="px-3 py-1.5 text-xs rounded-lg border border-brand-orange text-brand-orange hover:bg-brand-orange/5 disabled:opacity-60"
                disabled={activateOneDayMutation.isPending}
              >
                Activate 1 day
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Subscription Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Status</span>
            <span className="text-base font-bold capitalize text-gray-800">{tenant.subscriptionStatus}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Trial Ends At</span>
            <span className="text-base font-bold text-gray-800 font-mono">
              {tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Next Plan Change</span>
            <span className="text-base font-bold text-gray-800">
              {tenant.pendingPlanId ? (
                <span>
                  {tenant.pendingPlanId.name} on{' '}
                  <span className="font-mono text-xs text-gray-500">
                    {new Date(tenant.pendingPlanEffectiveAt).toLocaleDateString()}
                  </span>
                </span>
              ) : (
                'None Scheduled'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Plan Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-900">Plan Assignment</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            defaultValue={tenant.assignedPlanId?._id || ''}
            onChange={(e) => {
              if (!e.target.value) return;
              assignPlanMutation.mutate({ planId: e.target.value, planLocked: Boolean(tenant.planLocked) });
            }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Assign plan...</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>{p.name} ({p.currency} {Number(p.amount).toLocaleString()})</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!tenant.assignedPlanId?._id) return;
              assignPlanMutation.mutate({ planId: tenant.assignedPlanId._id, planLocked: !tenant.planLocked });
            }}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {tenant.planLocked ? 'Unlock plan' : 'Lock plan'}
          </button>
        </div>
      </div>

      {/* Billing Cycle Breakdowns Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="font-semibold text-gray-900">Payment Breakdowns</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'current' ? 'bg-brand-teal text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Current Cycle
            </button>
            <button
              onClick={() => setActiveTab('next')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'next' ? 'bg-brand-teal text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Next Cycle
            </button>
          </div>
        </div>

        {breakdownsLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading breakdowns...</div>
        ) : activeTab === 'current' ? (
          <BillingBreakdownPanel breakdown={breakdowns?.currentCycle} />
        ) : (
          <BillingBreakdownPanel breakdown={breakdowns?.nextCycle} />
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Stores</h3>
          <p className="text-sm text-gray-500 mt-0.5">{stores.length} branch{stores.length === 1 ? '' : 'es'} configured</p>
        </div>
        <Link
          to={`/merchants/${id}/stores`}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:opacity-90"
        >
          Manage stores
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Wallet size={18} className="text-brand-teal shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900">Cashier sessions (POS)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Last 14 days · Same data as POS manager reports; read-only here.
            </p>
          </div>
        </div>
        {cashierSessionsLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading sessions…</p>
        ) : !cashierSessions.length ? (
          <p className="p-4 text-sm text-gray-500">No cashier sessions in the last 14 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Store', 'Cashier', 'Opened', 'Closed', 'Variance', 'Notes', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cashierSessions.map((row) => {
                  const cashier = row.cashierId;
                  const store = row.storeId;
                  const cashierName = typeof cashier === 'object' && cashier?.name ? cashier.name : '—';
                  const storeName = typeof store === 'object' && store?.name ? store.name : '—';
                  const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
                  const money = (n) => {
                    const sym = 'Rs.';
                    return `${sym} ${Number(n ?? 0).toFixed(2)}`;
                  };
                  return (
                    <tr key={row._id}>
                      <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{storeName}</td>
                      <td className="px-4 py-2 text-gray-800 whitespace-nowrap">{cashierName}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{fmt(row.openedAt)}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{row.closedAt ? fmt(row.closedAt) : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-800">
                        {row.varianceAmount != null ? money(row.varianceAmount) : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-600 max-w-[180px] truncate" title={row.varianceNotes || ''}>
                        {row.varianceNotes || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${row.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Merchant Admin Accounts</h3>
          <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
        </div>
        {viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {admins.map((admin) => (
              <div key={admin._id} className="rounded-xl border border-gray-200 p-4">
                <p className="font-medium text-gray-900">{admin.name}</p>
                <p className="text-xs text-gray-500">{admin.email}</p>
                <button
                  onClick={() => resetAdminPasswordMutation.mutate(admin._id)}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Key size={12} />
                  Reset password
                </button>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{admin.name}</td>
                  <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                  <td className="px-4 py-3 text-gray-600">{admin.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => resetAdminPasswordMutation.mutate(admin._id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <Key size={12} />
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StoreCard({ store, onSave }) {
  const [form, setForm] = useState({
    name: store.name || '',
    address: store.address && typeof store.address === 'object' ? {
      street1: store.address.street1 || '',
      street2: store.address.street2 || '',
      city: store.address.city || '',
      state: store.address.state || '',
      postalCode: store.address.postalCode || '',
      country: store.address.country || '',
    } : {
      street1: store.address || '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    phone: store.phone || '',
    paymentMethods: store.paymentMethods?.length ? store.paymentMethods : ['cash'],
    isActive: store.isActive !== false,
  });

  useEffect(() => {
    setForm({
      name: store.name || '',
      address: store.address && typeof store.address === 'object' ? {
        street1: store.address.street1 || '',
        street2: store.address.street2 || '',
        city: store.address.city || '',
        state: store.address.state || '',
        postalCode: store.address.postalCode || '',
        country: store.address.country || '',
      } : {
        street1: store.address || '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      phone: store.phone || '',
      paymentMethods: store.paymentMethods?.length ? store.paymentMethods : ['cash'],
      isActive: store.isActive !== false,
    });
  }, [store]);

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${form.isActive ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {form.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
        />
        Store active (visible in POS)
      </label>
      <label className="block text-xs text-gray-500">Store Name</label>
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      
      <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-150">
        <span className="block text-xs font-semibold text-gray-700">Address</span>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" placeholder="Street 1" value={form.address.street1} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, street1: e.target.value } }))} />
        <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" placeholder="Street 2" value={form.address.street2} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, street2: e.target.value } }))} />
        <div className="grid grid-cols-2 gap-2">
          <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" placeholder="City" value={form.address.city} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))} />
          <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" placeholder="State" value={form.address.state} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, state: e.target.value } }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" placeholder="Postal Code" value={form.address.postalCode} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, postalCode: e.target.value } }))} />
          <input className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white" placeholder="Country" value={form.address.country} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, country: e.target.value } }))} />
        </div>
      </div>

      <label className="block text-xs text-gray-500">Phone</label>
      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
      <label className="block text-xs text-gray-500">Payment Methods (cash required)</label>
      <div className="flex flex-wrap gap-3">
        {['cash', 'card', 'bank_transfer', 'mobile_wallet'].map((m) => (
          <label key={m} className="text-sm text-gray-700 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.paymentMethods.includes(m)}
              disabled={m === 'cash'}
              onChange={() => setForm((p) => {
                const has = p.paymentMethods.includes(m);
                const next = has ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m];
                if (!next.includes('cash')) next.unshift('cash');
                return { ...p, paymentMethods: [...new Set(next)] };
              })}
            />
            <span className="capitalize">{m.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
      <button
        onClick={() => onSave({
          name: form.name,
          address: form.address,
          phone: form.phone,
          paymentMethods: form.paymentMethods,
          isActive: form.isActive,
        })}
        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        Save store
      </button>
    </div>
  );
}

function BillingBreakdownPanel({ breakdown }) {
  if (!breakdown || !breakdown.plan) {
    return (
      <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-gray-150">
        No subscription details found for this cycle.
      </div>
    );
  }

  const { plan, addons = [], storesDetail = [], usersDetail = [], total = 0, currency = 'LKR' } = breakdown;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Base Plan</span>
          <span className="text-base font-bold">{plan.name}</span>
          <span className="text-xs text-slate-400 block capitalize mt-0.5">{plan.billingCycle} cycle</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-black">{currency} {Number(plan.amount).toLocaleString()}</span>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm divide-y divide-gray-100">
        {storesDetail.length > 0 && (
          <div className="p-4 space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Locations & Branches</h4>
            <div className="space-y-1.5">
              {storesDetail.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                    <span className="text-gray-800 font-medium">{s.name}</span>
                    <span className="text-xs text-gray-400">({s.city || 'Active Branch'})</span>
                  </div>
                  <span className="font-mono text-gray-600">
                    {s.isFree ? 'Included' : `${currency} ${Number(s.cost).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {usersDetail.length > 0 && (
          <div className="p-4 space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">User Licenses & Seats</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {usersDetail.map((u, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div>
                    <div className="text-gray-800 font-medium">{u.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{u.role?.replace('_', ' ')} · {u.email}</div>
                  </div>
                  <span className="font-mono text-gray-600">
                    {u.isFree ? 'Included' : `${currency} ${Number(u.cost).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {addons.length > 0 && (
          <div className="p-4 space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Activated Add-ons & Seat Extras</h4>
            <div className="space-y-1.5">
              {addons.map((add, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-800 font-medium">{add.label}</span>
                  <span className="font-mono text-gray-600">
                    {currency} {Number(add.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50/50 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-900">Total Cycle Cost</span>
          <span className="text-xl font-black text-brand-teal">
            {currency} {Number(total).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

