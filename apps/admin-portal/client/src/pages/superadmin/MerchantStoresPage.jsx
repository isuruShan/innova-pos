import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import api from '../../api/axios';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import StoreCreateDrawer from '../../components/superadmin/StoreCreateDrawer';

function StoreCard({ store, onSave }) {
  const [form, setForm] = useState({
    name: store.name || '',
    address: store.address || '',
    phone: store.phone || '',
    paymentMethods: store.paymentMethods || ['cash'],
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3 hover:border-gray-300 transition-colors">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Store Name</label>
        <input 
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" 
          value={form.name} 
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} 
          placeholder="e.g. Main Street branch" 
          maxLength={120} 
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Address</label>
        <input 
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30" 
          value={form.address} 
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} 
          placeholder="Store address" 
        />
      </div>
      <button 
        type="button" 
        onClick={() => onSave(form)} 
        className="w-full mt-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover transition-colors"
      >
        Save changes
      </button>
    </div>
  );
}

export default function MerchantStoresPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ['tenant-workspace', id],
    queryFn: async () => { const { data } = await api.get(`/tenants/${id}`); return data; },
  });

  const { data: storesList, isLoading } = useQuery({
    queryKey: ['workspace-stores', id],
    queryFn: async () => {
      const { data } = await api.get('/stores', { params: { tenantId: id, page: 1, limit: 200 } });
      return unwrapPagedList(data);
    },
  });
  const stores = storesList?.items || [];

  const createStoreMutation = useMutation({
    mutationFn: (payload) => api.post('/stores', { ...payload, tenantId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-stores', id] });
      setDrawerOpen(false);
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: ({ storeId, payload }) => api.put(`/stores/${storeId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-stores', id] }),
  });

  return (
    <div className="space-y-6">
      <Link to={`/merchants/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Back to merchant
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Stores — {tenant?.businessName || 'Merchant'}</h2>
          <p className="text-sm text-gray-500">Manage branches for this merchant</p>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold">
          <Plus size={16} /> New store
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading stores…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stores.map((store) => (
            <StoreCard key={store._id} store={store} onSave={(payload) => updateStoreMutation.mutate({ storeId: store._id, payload: { ...payload, tenantId: id } })} />
          ))}
          {!stores.length && <p className="text-sm text-gray-500 col-span-full">No stores yet.</p>}
        </div>
      )}

      <StoreCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSubmit={(f) => createStoreMutation.mutate(f)} isPending={createStoreMutation.isPending} />
    </div>
  );
}
