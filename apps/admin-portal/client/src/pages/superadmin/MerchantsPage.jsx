import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Building2, Users, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../api/axios';

const STATUS_CONFIG = {
  active:    { label: 'Active',    class: 'bg-green-100 text-green-700',  icon: CheckCircle },
  suspended: { label: 'Suspended', class: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', class: 'bg-red-100 text-red-700',     icon: XCircle },
};

const SUB_STATUS_CONFIG = {
  trial:   'bg-blue-100 text-blue-700',
  active:  'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
};

export default function MerchantsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenants', search, statusFilter, page],
    queryFn: async () => {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/tenants', { params });
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/tenants/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Merchants</h2>
        <p className="text-sm text-gray-500 mt-0.5">All registered merchants on the platform</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or slug..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => refetch()} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading merchants...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.tenants?.map(tenant => {
            const sc = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.active;
            const StatusIcon = sc.icon;
            return (
              <div key={tenant._id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-brown-deep flex items-center justify-center">
                      {tenant.settings?.logoUrl ? (
                        <img src={tenant.settings.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <Building2 size={18} className="text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{tenant.businessName}</p>
                      <p className="text-xs text-gray-400">{tenant.slug}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sc.class}`}>
                    <StatusIcon size={11} />
                    {sc.label}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Subscription</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${SUB_STATUS_CONFIG[tenant.subscriptionStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {tenant.subscriptionStatus}
                    </span>
                  </div>
                  {tenant.trialEndsAt && tenant.subscriptionStatus === 'trial' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Trial ends</span>
                      <span className="text-gray-700">{new Date(tenant.trialEndsAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Admins</span>
                    <span className="text-gray-700 flex items-center gap-1"><Users size={11} /> {tenant.admins?.length || 0}</span>
                  </div>
                </div>

                {/* Admin emails */}
                {tenant.admins?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {tenant.admins.map(a => (
                      <p key={a.email} className="text-xs text-gray-500 truncate">{a.email}</p>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex gap-2">
                  {tenant.status === 'active' ? (
                    <button
                      onClick={() => statusMutation.mutate({ id: tenant._id, status: 'suspended' })}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-yellow-300 text-yellow-700 hover:bg-yellow-50 transition-colors">
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => statusMutation.mutate({ id: tenant._id, status: 'active' })}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
                      Activate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Page {data.page} of {data.pages} ({data.total} merchants)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
