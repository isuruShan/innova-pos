import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Search, X } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import RewardScopeCombobox from '../../components/RewardScopeCombobox';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import LoyaltyAddonBanner from '../../components/LoyaltyAddonBanner';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import SortableTh from '../../components/SortableTh';
import { useListSort } from '../../hooks/useListSort';

const empty = {
  name: '',
  description: '',
  redemptionType: 'points',
  pointsCost: '100',
  rewardType: 'order_discount_amount',
  discountAmount: '5',
  discountPercent: '',
  minTierLevel: '1',
  applicableItems: [],
  applicableItemNames: [],
  applicableCategories: [],
  maxDiscountAmount: '',
};

export default function LoyaltyRewardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slide, setSlide] = useState(null);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState('');
  const { sort, order, toggleSort, sortParams } = useListSort('createdAt', 'desc');

  const [search, setSearch] = useState('');
  const [rewardTypeFilter, setRewardTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: paidAddons } = useTenantPaidAddons();
  const loyaltyAddonActive = paidAddons?.loyalty === true;

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['loyalty-rewards', sortParams],
    queryFn: () => api.get('/loyalty/rewards', { params: { sort, order } }).then((r) => r.data),
    enabled: loyaltyAddonActive,
  });

  const filteredRows = rows.filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = (r.name || '').toLowerCase().includes(q);
      const descMatch = (r.description || '').toLowerCase().includes(q);
      if (!nameMatch && !descMatch) return false;
    }
    if (rewardTypeFilter !== 'all' && r.rewardType !== rewardTypeFilter) {
      return false;
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        if (!r.active || r.approvalStatus !== 'approved') return false;
      } else if (statusFilter === 'disabled') {
        if (r.active) return false;
      } else if (statusFilter === 'pending') {
        if (r.approvalStatus !== 'pending') return false;
      } else if (statusFilter === 'rejected') {
        if (r.approvalStatus !== 'rejected') return false;
      } else if (statusFilter === 'approved') {
        if (r.approvalStatus !== 'approved') return false;
      }
    }
    return true;
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', 'loyalty-form', selectedStoreId],
    queryFn: () => api.get('/menu').then((r) => r.data),
    enabled: isStoreReady,
  });

  const save = useMutation({
    mutationFn: ({ id, payload }) =>
      id ? api.put(`/loyalty/rewards/${id}`, payload) : api.post('/loyalty/rewards', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      setSlide(null);
      setForm(empty);
      setFormError('');
    },
    onError: (e) => setFormError(e.response?.data?.message || 'Save failed'),
  });

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    const redemptionType = form.redemptionType || 'points';
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      redemptionType,
      pointsCost: redemptionType === 'automatic' ? 0 : Number(form.pointsCost) || 1,
      rewardType: form.rewardType,
      discountAmount: Number(form.discountAmount) || 0,
      discountPercent: Number(form.discountPercent) || 0,
      minTierLevel: Number(form.minTierLevel) || 1,
      applicableItems: form.applicableItems || [],
      applicableCategories: form.applicableCategories || [],
      maxDiscountAmount:
        form.maxDiscountAmount === '' || form.maxDiscountAmount == null
          ? null
          : Math.max(0, Number(form.maxDiscountAmount) || 0),
      active: false,
    };
    save.mutate({ id: slide?._id, payload });
  };

  const isManager = user?.role === 'manager';

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <LoyaltyAddonBanner className="mb-6" />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Gift className="text-amber-400" />
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Loyalty rewards</h1>
          </div>
          <button
            type="button"
            disabled={!loyaltyAddonActive}
            onClick={() => {
              setSlide({});
              setForm(empty);
              setFormError('');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm disabled:opacity-50"
          >
            <Plus size={16} /> New reward
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {isManager
            ? 'Rewards you create stay pending until a merchant admin approves them.'
            : 'You can create rewards directly or approve requests from managers in Approvals.'}
        </p>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rewards..."
              className="w-full bg-[var(--pos-panel)] border border-slate-700/80 rounded-xl pl-9 pr-8 py-2.5 text-sm text-[var(--pos-text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[var(--pos-text-primary)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={rewardTypeFilter}
              onChange={(e) => setRewardTypeFilter(e.target.value)}
              className="bg-[var(--pos-panel)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              title="Filter by reward type"
            >
              <option value="all">All Types</option>
              <option value="order_discount_amount">Fixed amount off order</option>
              <option value="order_discount_percent">Percent off order</option>
              <option value="free_item">Free item</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[var(--pos-panel)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              title="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
          {isPending ? (
            <p className="p-8 text-center text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No rewards yet</p>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <Search size={44} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold">No matches found</p>
              <p className="text-sm mt-1 opacity-60">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left text-slate-500 text-xs uppercase">
                  <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3">Type</th>
                  <SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Points" field="pointsCost" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r._id} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 text-[var(--pos-text-primary)]">{r.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {r.redemptionType === 'automatic' ? 'Member perk' : 'Points'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-amber-400">{r.pointsCost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.approvalStatus === 'approved'
                            ? 'bg-green-500/15 text-green-400'
                            : r.approvalStatus === 'rejected'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {r.approvalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SlideOver
        open={slide !== null}
        onClose={() => {
          setSlide(null);
          setForm(empty);
          setFormError('');
        }}
        title="Loyalty reward"
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Redemption</label>
            <select
              value={form.redemptionType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  redemptionType: e.target.value,
                  pointsCost: e.target.value === 'automatic' ? '0' : f.pointsCost || '100',
                }))
              }
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
            >
              <option value="points">Spend loyalty points</option>
              <option value="automatic">Member perk (no points)</option>
            </select>
          </div>
          {form.redemptionType !== 'automatic' ? (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Points cost *</label>
              <input
                type="number"
                min={1}
                required
                value={form.pointsCost}
                onChange={(e) => setForm((f) => ({ ...f, pointsCost: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Applies automatically for eligible members when attached to an order (tier rules apply).
            </p>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Reward type</label>
            <select
              value={form.rewardType}
              onChange={(e) => setForm((f) => ({ ...f, rewardType: e.target.value }))}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
            >
              <option value="order_discount_amount">Fixed amount off order</option>
              <option value="order_discount_percent">Percent off scoped lines</option>
              <option value="free_item">Free item (configure menu item later)</option>
            </select>
          </div>
          {form.rewardType === 'order_discount_amount' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Discount amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.discountAmount}
                onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}
          {form.rewardType === 'order_discount_percent' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Percent off</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.discountPercent}
                onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}
          {(form.rewardType === 'order_discount_amount' || form.rewardType === 'order_discount_percent') && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max discount per order (optional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.maxDiscountAmount}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Min tier level</label>
            <input
              type="number"
              min={1}
              value={form.minTierLevel}
              onChange={(e) => setForm((f) => ({ ...f, minTierLevel: e.target.value }))}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Apply to categories / items (optional)</p>
            <RewardScopeCombobox
              menuItems={menuItems}
              isStoreReady={isStoreReady}
              categoryNames={form.applicableCategories || []}
              itemIds={form.applicableItems || []}
              itemNames={form.applicableItemNames || []}
              onPatch={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
          </div>
          {formError ? (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{formError}</div>
          ) : null}
          <button
            type="submit"
            disabled={save.isPending}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold"
          >
            {save.isPending ? 'Saving…' : 'Submit'}
          </button>
        </form>
      </SlideOver>
    </div>
  );
}
