import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Search, X, Pencil, Trash2, Coins, Award, Sparkles } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
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

  const [confirmDeleteReward, setConfirmDeleteReward] = useState(null);

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

  const del = useMutation({
    mutationFn: (id) => api.delete(`/loyalty/rewards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      setConfirmDeleteReward(null);
    },
  });

  const handleEditReward = (r) => {
    setSlide(r);
    setForm({
      name: r.name || '',
      description: r.description || '',
      redemptionType: r.redemptionType || 'points',
      pointsCost: String(r.pointsCost ?? 100),
      rewardType: r.rewardType || 'order_discount_amount',
      discountAmount: String(r.discountAmount ?? 0),
      discountPercent: String(r.discountPercent ?? ''),
      minTierLevel: String(r.minTierLevel ?? 1),
      applicableItems: r.applicableItems || [],
      applicableItemNames: r.applicableItemNames || [],
      applicableCategories: r.applicableCategories || [],
      maxDiscountAmount: r.maxDiscountAmount != null ? String(r.maxDiscountAmount) : '',
    });
    setFormError('');
  };

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
      active: slide?._id ? Boolean(slide.active) : false,
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
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r._id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-[var(--pos-text-primary)] font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {r.redemptionType === 'automatic' ? 'Member perk' : 'Points'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-amber-400 font-semibold tabular-nums">{r.pointsCost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
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
                    <td className="px-4 py-3 text-slate-400">
                      <span className={`text-xs font-semibold ${r.active ? 'text-green-400' : 'text-slate-500'}`}>
                        {r.active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditReward(r)}
                          className="p-1.5 text-slate-400 hover:text-amber-450 hover:bg-slate-800 rounded-lg transition"
                          title="Edit reward"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteReward(r)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                          title="Delete reward"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
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
        title={slide?._id ? 'Edit loyalty reward' : 'New loyalty reward'}
      >
        <form onSubmit={submit} className="space-y-5 pb-8 text-sm">
          {/* Section 1: Basic Info */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-850/60 pb-2">
              <Sparkles size={16} className="text-amber-450" />
              <h3 className="font-semibold text-slate-205 text-xs uppercase tracking-wider">Basic info</h3>
            </div>
            
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Free Coffee, $10 Off..."
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-[var(--pos-text-primary)] transition"
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Describe how customers qualify or what they get..."
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-[var(--pos-text-primary)] resize-none transition"
              />
            </div>
          </div>

          {/* Section 2: Redemption Model */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-850/60 pb-2">
              <Coins size={16} className="text-amber-455" />
              <h3 className="font-semibold text-slate-205 text-xs uppercase tracking-wider">Redemption model</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">Redemption type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      redemptionType: 'points',
                      pointsCost: f.pointsCost === '0' ? '100' : f.pointsCost || '100',
                    }))
                  }
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                    form.redemptionType === 'points'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-705'
                  }`}
                >
                  <Coins size={20} className={form.redemptionType === 'points' ? 'text-amber-400 mb-1' : 'text-slate-500 mb-1'} />
                  <span className="text-xs font-bold">Spend Points</span>
                  <span className="text-[10px] opacity-70 mt-0.5">Deducts points at checkout</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      redemptionType: 'automatic',
                      pointsCost: '0',
                    }))
                  }
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                    form.redemptionType === 'automatic'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-705'
                  }`}
                >
                  <Award size={20} className={form.redemptionType === 'automatic' ? 'text-amber-400 mb-1' : 'text-slate-500 mb-1'} />
                  <span className="text-xs font-bold">Member Perk</span>
                  <span className="text-[10px] opacity-70 mt-0.5">Free / auto-applies</span>
                </button>
              </div>
            </div>

            {form.redemptionType !== 'automatic' ? (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400">Points cost *</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.pointsCost}
                    onChange={(e) => setForm((f) => ({ ...f, pointsCost: e.target.value }))}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl pl-3 pr-10 py-2 text-sm text-[var(--pos-text-primary)] transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">PTS</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-950/20 border border-slate-800/40 rounded-xl p-3">
                ⭐ This is a member perk. It will apply automatically for eligible customers when attached to an order (tier rules still apply).
              </p>
            )}
          </div>

          {/* Section 3: Reward Action */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-850/60 pb-2">
              <Gift size={16} className="text-amber-450" />
              <h3 className="font-semibold text-slate-205 text-xs uppercase tracking-wider">Reward action</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">Reward type</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    value: 'order_discount_amount',
                    label: 'Fixed discount',
                    desc: 'Specific dollar amount off order or items',
                  },
                  {
                    value: 'order_discount_percent',
                    label: 'Percentage discount',
                    desc: 'Percent off the scoped items or whole order',
                  },
                  {
                    value: 'free_item',
                    label: 'Free item',
                    desc: 'Get a complimentary menu item (select scope below)',
                  },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rewardType: item.value }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                      form.rewardType === item.value
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-705'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                      form.rewardType === item.value ? 'bg-amber-500/25 text-amber-450' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.value === 'order_discount_amount' ? '$' : item.value === 'order_discount_percent' ? '%' : <Gift size={16} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] opacity-70">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {form.rewardType === 'order_discount_amount' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400">Discount amount ($) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.discountAmount}
                    onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl pl-7 pr-3 py-2 text-sm text-[var(--pos-text-primary)] transition"
                  />
                </div>
              </div>
            )}

            {form.rewardType === 'order_discount_percent' && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400">Percent off (%) *</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={form.discountPercent}
                    onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl pl-3 pr-8 py-2 text-sm text-[var(--pos-text-primary)] transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                </div>
              </div>
            )}

            {(form.rewardType === 'order_discount_amount' || form.rewardType === 'order_discount_percent') && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400">Max discount per order (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
                    placeholder="No limit"
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl pl-7 pr-3 py-2 text-sm text-[var(--pos-text-primary)] transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Scope & Eligibility */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-850/60 pb-2">
              <Award size={16} className="text-amber-450" />
              <h3 className="font-semibold text-slate-205 text-xs uppercase tracking-wider">Scope &amp; eligibility</h3>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Minimum tier level required</label>
              <input
                type="number"
                min={1}
                required
                value={form.minTierLevel}
                onChange={(e) => setForm((f) => ({ ...f, minTierLevel: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-[var(--pos-text-primary)] transition"
              />
              <p className="text-[10px] text-slate-500">Only customers at or above this loyalty tier can redeem this reward.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Apply restriction (optional)</label>
              <RewardScopeCombobox
                menuItems={menuItems}
                isStoreReady={isStoreReady}
                categoryNames={form.applicableCategories || []}
                itemIds={form.applicableItems || []}
                itemNames={form.applicableItemNames || []}
                onPatch={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
              <p className="text-[10px] text-slate-500">Leave empty to apply the discount to the entire order.</p>
            </div>
          </div>

          {formError ? (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <span className="font-bold">⚠️ Error:</span>
              <span>{formError}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={save.isPending}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-450 disabled:opacity-50 text-white font-semibold shadow-lg shadow-amber-500/10 transition cursor-pointer"
          >
            {save.isPending ? 'Saving…' : slide?._id ? 'Save reward' : 'Create reward'}
          </button>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(confirmDeleteReward)}
        variant="delete"
        title="Delete reward?"
        message={`"${confirmDeleteReward?.name}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => {
          del.mutate(confirmDeleteReward._id);
        }}
        onCancel={() => setConfirmDeleteReward(null)}
      />
    </div>
  );
}
