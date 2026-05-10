import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import ViewModeToggle from '../../components/common/ViewModeToggle';

export default function StoresPage() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', paymentMethods: ['cash'] });
  const [editingStore, setEditingStore] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', code: '', address: '', phone: '', paymentMethods: ['cash'], isActive: true,
  });
  const [editMeta, setEditMeta] = useState({ deactivatedBySuperadmin: false });
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_admin_stores') || 'table');

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['admin-stores'],
    queryFn: async () => {
      const { data } = await api.get('/stores');
      return data;
    },
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-store-access'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
  });

  const createStore = useMutation({
    mutationFn: (payload) => api.post('/stores', payload),
    onSuccess: () => {
      setForm({ name: '', code: '', address: '', phone: '', paymentMethods: ['cash'] });
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create store'),
  });

  const updateStore = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/stores/${id}`, payload),
    onSuccess: () => {
      setEditingStore(null);
      setEditForm({ name: '', code: '', address: '', phone: '', paymentMethods: ['cash'], isActive: true });
      setEditMeta({ deactivatedBySuperadmin: false });
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update store'),
  });
  const updateUserAccess = useMutation({
    mutationFn: ({ userId, payload }) => api.put(`/users/${userId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-for-store-access'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update store access'),
  });

  const onCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError('Store name and code are required');
      return;
    }
    createStore.mutate(form);
  };

  const openEdit = (store) => {
    setEditingStore(store);
    setEditForm({
      name: store.name || '',
      code: store.code || '',
      address: store.address || '',
      phone: store.phone || '',
      paymentMethods: store.paymentMethods?.length ? store.paymentMethods : ['cash'],
      isActive: store.isActive !== false,
    });
    setEditMeta({ deactivatedBySuperadmin: Boolean(store.deactivatedBySuperadmin) });
    setError('');
  };

  const onEditSave = (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setError('Store name and code are required');
      return;
    }
    updateStore.mutate({ id: editingStore._id, payload: editForm });
  };
  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_admin_stores', mode);
  };

  const storeUsers = (storeId) => (
    users.filter((u) => Array.isArray(u.storeIds) && u.storeIds.some((s) => (typeof s === 'string' ? s : s?._id) === storeId))
  );

  const toggleUserStoreAccess = (user, storeId, checked) => {
    const currentStoreIds = Array.isArray(user.storeIds)
      ? user.storeIds.map((s) => (typeof s === 'string' ? s : s?._id)).filter(Boolean)
      : [];
    const nextStoreIds = checked
      ? [...new Set([...currentStoreIds, storeId])]
      : currentStoreIds.filter((id) => id !== storeId);
    const defaultStoreIdRaw = typeof user.defaultStoreId === 'string' ? user.defaultStoreId : user.defaultStoreId?._id;
    const nextDefaultStoreId = nextStoreIds.includes(defaultStoreIdRaw) ? defaultStoreIdRaw : (nextStoreIds[0] || null);
    updateUserAccess.mutate({
      userId: user._id,
      payload: { storeIds: nextStoreIds, defaultStoreId: nextDefaultStoreId },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Stores</h2>
        <p className="text-sm text-gray-500 mt-1">
          {isSuperAdmin
            ? 'Create and manage store branches for merchants.'
            : 'Edit details for stores assigned to your admin account.'}
        </p>
      </div>

      {isSuperAdmin && (
        <form onSubmit={onCreate} className="rounded-xl border border-gray-200 bg-white p-4 grid gap-3 md:grid-cols-2">
          <div><label className="block text-xs text-gray-500 mb-1">Store Name</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Store name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Store Code</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Code (e.g. COL-01)" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Address</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Address (optional)" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Payment Methods (cash required)</label>
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
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold disabled:opacity-60" disabled={createStore.isPending}>
              {createStore.isPending ? 'Creating...' : 'Create store'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>
      )}

      <div className="flex justify-end">
        <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stores.map((store) => (
              <div key={store._id} className="rounded-xl border border-gray-200 p-4">
                <p className="font-semibold text-gray-900">{store.name}</p>
                <p className="text-xs text-gray-500">{store.code}</p>
                <p className="text-xs text-gray-600 mt-1">{store.address || '-'}</p>
                <p className="text-xs text-gray-600 mt-1">{store.phone || '-'}</p>
                {store.isActive === false && (
                  <span className="mt-2 inline-block text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">Inactive</span>
                )}
                <button className="mt-3 text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => openEdit(store)}>
                  Edit
                </button>
                {!isSuperAdmin && (
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Store Access Users</p>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {users.map((u) => {
                        const assigned = storeUsers(store._id).some((su) => su._id === u._id);
                        return (
                          <label key={u._id} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={(e) => toggleUserStoreAccess(u, store._id, e.target.checked)}
                            />
                            <span>{u.name} ({u.role?.replace('_', ' ')})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!stores.length && <p className="text-sm text-gray-500">No stores yet.</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Store', 'Code', 'Address', 'Status', 'Default', 'Action'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading stores...</td></tr>
            )}
            {!isLoading && stores.map((store) => (
              <tr key={store._id} className={store.isActive === false ? 'bg-gray-50/80' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900">{store.name}</td>
                <td className="px-4 py-3 text-gray-600">{store.code}</td>
                <td className="px-4 py-3 text-gray-600">{store.address || '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {store.isActive === false ? (
                    <span className="text-xs font-medium text-red-600">Inactive</span>
                  ) : (
                    <span className="text-xs font-medium text-green-700">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{store.isDefault ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <button className="text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => openEdit(store)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !stores.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No stores yet</td></tr>
            )}
          </tbody>
          </table>
        )}
      </div>

      {editingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Edit store</h3>
              <button onClick={() => setEditingStore(null)} className="text-gray-400 hover:text-gray-600">x</button>
            </div>
            <form onSubmit={onEditSave} className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Store Name</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Store name" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Store Code</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Code" value={editForm.code} onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Address</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Address" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payment Methods (cash required)</label>
                <div className="flex flex-wrap gap-3">
                  {['cash', 'card', 'bank_transfer', 'mobile_wallet'].map((m) => (
                    <label key={m} className="text-sm text-gray-700 flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={editForm.paymentMethods.includes(m)}
                        disabled={m === 'cash'}
                        onChange={() => setEditForm((p) => {
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
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  disabled={!isSuperAdmin && editMeta.deactivatedBySuperadmin}
                  onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Store is active (visible in POS)
              </label>
              {!isSuperAdmin && editMeta.deactivatedBySuperadmin && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                  This store was disabled by a superadmin. You cannot turn it back on.
                </p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingStore(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={updateStore.isPending} className="flex-1 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60">
                  {updateStore.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
