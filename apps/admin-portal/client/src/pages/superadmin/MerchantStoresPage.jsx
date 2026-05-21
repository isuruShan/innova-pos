import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import api from '../../api/axios';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import StoreCreateDrawer from '../../components/superadmin/StoreCreateDrawer';

const storeIdStr = (store) => String(store?._id ?? store?.id ?? '');

function buildFormFromStore(store) {
  return {
    name: store.name || '',
    address: store.address || '',
    phone: store.phone || '',
    paymentMethods: store.paymentMethods?.length ? [...store.paymentMethods] : ['cash'],
  };
}

function StoreCard({ store, onSave, isSaving }) {
  const id = storeIdStr(store);
  const [form, setForm] = useState(() => buildFormFromStore(store));

  useEffect(() => {
    setForm(buildFormFromStore(store));
  }, [id, store.name, store.address, store.phone, store.paymentMethods?.join(',')]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3 hover:border-gray-300 transition-colors">
      <p className="text-xs text-gray-400 font-mono truncate">{store.code || id}</p>
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
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="Phone (optional)"
        />
      </div>
      <button
        type="button"
        onClick={() => onSave(id, form)}
        disabled={isSaving || !id}
        className="w-full mt-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60 transition-colors"
      >
        {isSaving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

export default function MerchantStoresPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingStoreId, setSavingStoreId] = useState(null);

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
    mutationFn: ({ storeId, payload }) =>
      api.put(`/stores/${storeId}`, {
        tenantId: id,
        name: payload.name?.trim(),
        address: payload.address?.trim(),
        phone: payload.phone?.trim(),
        paymentMethods: payload.paymentMethods ? [...payload.paymentMethods] : ['cash'],
      }),
    onMutate: ({ storeId }) => {
      setSavingStoreId(storeId);
    },
    onSettled: () => {
      setSavingStoreId(null);
    },
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
          {stores.map((store) => {
            const sid = storeIdStr(store);
            return (
              <StoreCard
                key={sid}
                store={store}
                isSaving={savingStoreId === sid && updateStoreMutation.isPending}
                onSave={(storeId, payload) => updateStoreMutation.mutate({ storeId, payload })}
              />
            );
          })}
          {!stores.length && <p className="text-sm text-gray-500 col-span-full">No stores yet.</p>}
        </div>
      )}

      <StoreCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSubmit={(f) => createStoreMutation.mutate(f)} isPending={createStoreMutation.isPending} />
    </div>
  );
}
