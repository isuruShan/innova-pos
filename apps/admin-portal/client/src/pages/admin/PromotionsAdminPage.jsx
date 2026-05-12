import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Tag, Search, Pencil, Percent, Minus as MinusIcon,
} from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import { useStoreContext } from '../../context/StoreContext';
const EMPTY = {
  name: '',
  description: '',
  type: 'percentageDiscount',
  startDate: '',
  endDate: '',
  active: true,
  promoScope: 'tenant',
  storeId: '',
  discountAmount: '',
  discountPercent: '',
  minOrderAmount: '',
  maxDiscountAmount: '',
  minTierLevel: '',
  applicableItems: [],
  applicableItemNames: [],
  applicableCategories: [],
};

export default function PromotionsAdminPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('');
  const [slide, setSlide] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const listParams = () => {
    const p = {};
    if (search.trim()) p.search = search.trim();
    if (approvalFilter !== 'all') p.approvalStatus = approvalFilter;
    if (storeFilter === 'tenant') p.storeId = 'tenant';
    else if (storeFilter) p.storeId = storeFilter;
    return p;
  };

  const { data: promotions = [], isPending } = useQuery({
    queryKey: ['admin-promotions', search, approvalFilter, storeFilter],
    queryFn: () => api.get('/promotions', { params: listParams() }).then((r) => r.data),
  });

  const { data: pendingOnly = [], isPending: pendingListLoading } = useQuery({
    queryKey: ['admin-promotions-pending'],
    queryFn: () => api.get('/promotions', { params: { pending: true } }).then((r) => r.data),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['admin-menu', selectedStoreId],
    queryFn: () => api.get('/menu').then((r) => r.data),
    enabled: isStoreReady,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-promotions'] });
    qc.invalidateQueries({ queryKey: ['admin-promotions-pending'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    qc.invalidateQueries({ queryKey: ['notifications-all'] });
  };

  const createMut = useMutation({
    mutationFn: (payload) => api.post('/promotions', payload),
    onSuccess: () => {
      invalidate();
      closeSlide();
    },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/promotions/${id}`, payload),
    onSuccess: () => {
      invalidate();
      closeSlide();
    },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/promotions/${id}`),
    onSuccess: invalidate,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, active }) => api.post(`/promotions/${id}/approve`, { active }),
    onSuccess: invalidate,
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/promotions/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      invalidate();
      setRejectFor(null);
      setRejectReason('');
    },
  });

  const closeSlide = () => {
    setSlide(null);
    setForm(EMPTY);
    setFormError('');
  };

  const openNew = () => {
    const today = new Date().toISOString().split('T')[0];
    const next = new Date();
    next.setDate(next.getDate() + 30);
    setSlide({});
    setForm({
      ...EMPTY,
      startDate: today,
      endDate: next.toISOString().split('T')[0],
      promoScope: 'tenant',
    });
    setFormError('');
  };

  const openEdit = (p) => {
    setSlide(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      type: p.type,
      startDate: p.startDate?.split('T')[0] || '',
      endDate: p.endDate?.split('T')[0] || '',
      active: p.active ?? true,
      promoScope: p.storeId ? 'store' : 'tenant',
      storeId: p.storeId ? String(p.storeId) : '',
      discountAmount: String(p.discountAmount ?? ''),
      discountPercent: String(p.discountPercent ?? ''),
      minOrderAmount: String(p.minOrderAmount ?? ''),
      maxDiscountAmount: p.maxDiscountAmount != null && p.maxDiscountAmount !== '' ? String(p.maxDiscountAmount) : '',
      minTierLevel: p.minTierLevel != null && p.minTierLevel !== '' ? String(p.minTierLevel) : '',
      applicableItems: p.applicableItems || [],
      applicableItemNames: p.applicableItemNames || [],
      applicableCategories: p.applicableCategories || [],
    });
    setFormError('');
  };

  const toggleApplicableItem = (m) => {
    setForm((f) => {
      const ids = f.applicableItems || [];
      const names = f.applicableItemNames || [];
      const idx = ids.findIndex((id) => String(id) === String(m._id));
      if (idx >= 0) {
        return {
          ...f,
          applicableItems: ids.filter((_, i) => i !== idx),
          applicableItemNames: names.filter((_, i) => i !== idx),
        };
      }
      return {
        ...f,
        applicableItems: [...ids, m._id],
        applicableItemNames: [...names, m.name],
      };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.startDate || !form.endDate) return setFormError('Dates required');
    if (form.startDate > form.endDate) return setFormError('Invalid date range');

    const base = {
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      active: form.active,
      minOrderAmount: +form.minOrderAmount || 0,
      applicableItems: form.applicableItems || [],
      applicableItemNames: form.applicableItemNames || [],
      applicableCategories: form.applicableCategories || [],
      bundleItems: [],
      bundlePrice: 0,
      buyItem: null,
      buyItemName: '',
      buyQty: 1,
      getFreeItem: null,
      getFreeItemName: '',
      getFreeQty: 1,
      flatPrice: 0,
      discountAmount: +form.discountAmount || 0,
      discountPercent: +form.discountPercent || 0,
      maxDiscountAmount:
        form.maxDiscountAmount === '' || form.maxDiscountAmount == null
          ? null
          : Math.max(0, +form.maxDiscountAmount || 0),
      minTierLevel:
        form.minTierLevel === '' || form.minTierLevel == null
          ? null
          : Math.max(1, Number(form.minTierLevel) || 1),
    };

    if (form.type === 'percentageDiscount' && (form.discountPercent === '' || Number.isNaN(+form.discountPercent))) {
      return setFormError('Discount % required');
    }
    if (form.type === 'flatDiscount' && (form.discountAmount === '' || Number.isNaN(+form.discountAmount))) {
      return setFormError('Discount amount required');
    }

    const payload = {
      ...base,
      scope: form.promoScope === 'tenant' ? 'tenant' : 'store',
      ...(form.promoScope === 'store' && form.storeId ? { storeId: form.storeId } : {}),
    };

    if (slide?._id) updateMut.mutate({ id: slide._id, payload });
    else createMut.mutate(payload);
  };

  const storeLabel = (sid) => {
    if (sid == null) return 'All stores';
    const s = stores.find((x) => String(x._id) === String(sid));
    return s?.name || 'Store';
  };

  const nowActive = (p) => {
    const now = new Date();
    return p.active && new Date(p.startDate) <= now && new Date(p.endDate) >= now && p.approvalStatus === 'approved';
  };

  useEffect(() => {
    if (searchParams.get('focus') !== 'pending') return;
    if (pendingListLoading) return;
    let t;
    if (pendingOnly.length > 0) {
      t = window.setTimeout(() => {
        document.getElementById('admin-promotions-pending')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [searchParams, setSearchParams, pendingOnly.length, pendingListLoading]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Tag className="text-brand-orange" size={26} />
          Promotions
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Tenant-wide or store-specific promotions. Manager submissions from the POS appear as pending until you approve
          them.
        </p>
      </div>

      {pendingOnly.length > 0 && (
        <section id="admin-promotions-pending" className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">Pending approval (from POS managers)</h2>
          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-100/80 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOnly.map((p) => (
                  <tr key={p._id} className="border-t border-amber-100">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-gray-600">{storeLabel(p.storeId)}</td>
                    <td className="px-3 py-2">{p.type}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => approveMut.mutate({ id: p._id, active: true })}
                        className="text-xs font-semibold text-brand-teal"
                      >
                        Approve
                      </button>
                      <button type="button" onClick={() => setRejectFor(p)} className="text-xs text-red-600">
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All scopes</option>
            <option value="tenant">Tenant-wide only</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or description…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-medium shrink-0"
        >
          <Plus size={16} /> New promotion
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isPending ? (
          <p className="p-8 text-center text-gray-500">Loading…</p>
        ) : promotions.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No promotions match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Live</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p._id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{storeLabel(p.storeId)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-700">
                        {p.type === 'percentageDiscount' ? <Percent size={12} /> : <MinusIcon size={12} />}
                        {p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-gray-600">{p.approvalStatus}</td>
                    <td className="px-4 py-3">{nowActive(p) ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {p.approvalStatus === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => approveMut.mutate({ id: p._id, active: true })}
                            className="text-brand-teal text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button type="button" onClick={() => setRejectFor(p)} className="text-red-600 text-xs">
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="text-brand-teal text-xs font-semibold"
                      >
                        <Pencil size={12} className="inline mr-1" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete promotion "${p.name}"?`)) deleteMut.mutate(p._id);
                        }}
                        className="text-red-600 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {slide !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 overflow-y-auto"
          onClick={closeSlide}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl border border-gray-200 my-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {slide._id ? 'Edit promotion' : 'New promotion'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              This screen supports percentage and flat discounts. Use the POS app for bundles and buy-X-get-Y promos.
            </p>
            {formError ? <p className="text-sm text-red-600 mb-2">{formError}</p> : null}
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs text-gray-600">
                Scope
                <select
                  value={form.promoScope}
                  onChange={(e) => setForm((f) => ({ ...f, promoScope: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="tenant">All stores (tenant-wide)</option>
                  <option value="store">Single store</option>
                </select>
              </label>
              {form.promoScope === 'store' ? (
                <label className="block text-xs text-gray-600">
                  Store
                  <select
                    required
                    value={form.storeId}
                    onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {stores.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-xs text-gray-600">
                Type
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="percentageDiscount">Percentage discount</option>
                  <option value="flatDiscount">Flat discount (amount)</option>
                </select>
              </label>
              <label className="block text-xs text-gray-600">
                Name *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-gray-600">
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-600">
                  Start
                  <AdminDateField
                    required
                    value={form.startDate}
                    max={form.endDate || undefined}
                    onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  End
                  <AdminDateField
                    required
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                  />
                </label>
              </div>
              {form.type === 'percentageDiscount' ? (
                <label className="block text-xs text-gray-600">
                  Percent off
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.discountPercent}
                    onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <label className="block text-xs text-gray-600">
                  Discount amount (Rs)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.discountAmount}
                    onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
              <label className="block text-xs text-gray-600">
                Minimum order amount (optional)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-gray-600">
                Max discount per order (optional cap)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Leave empty for no cap"
                />
              </label>
              <label className="block text-xs text-gray-600">
                Minimum loyalty tier (optional)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.minTierLevel}
                  onChange={(e) => setForm((f) => ({ ...f, minTierLevel: e.target.value }))}
                  placeholder="All tiers"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              {isStoreReady && menuItems.length > 0 ? (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Limit to items (optional — empty = whole order)</p>
                  <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {menuItems.map((m) => (
                      <button
                        key={m._id}
                        type="button"
                        onClick={() => toggleApplicableItem(m)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          form.applicableItems?.some((id) => String(id) === String(m._id))
                            ? 'bg-brand-teal/10 text-brand-teal font-medium'
                            : 'text-gray-800'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Select a store in the header to attach menu items to this promotion.
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={Boolean(form.active)}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active when approved
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeSlide} className="px-3 py-2 text-sm text-gray-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-900">Reject promotion</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Reason"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectFor(null)} className="px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => rejectMut.mutate({ id: rejectFor._id, reason: rejectReason })}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
