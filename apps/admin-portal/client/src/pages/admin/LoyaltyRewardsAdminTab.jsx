import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Search, Pencil, Trash2, Check } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import RewardScopeCombobox from '../../components/RewardScopeCombobox';
import ListPagination from '../../components/common/ListPagination';
import SortableTh from '../../components/common/SortableTh';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useListSort } from '../../hooks/useListSort';
import SideDrawer from '../../components/common/SideDrawer';
import FormField, { inputClass } from '../../components/common/FormField';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const emptyForm = {
  name: '',
  description: '',
  redemptionType: 'points',
  pointsCost: '100',
  rewardType: 'order_discount_amount',
  discountAmount: '5',
  discountPercent: '',
  minTierLevel: '1',
  rewardScope: 'tenant',
  storeId: '',
  applicableItems: [],
  applicableItemNames: [],
  applicableCategories: [],
  maxDiscountAmount: '',
  active: true,
  foodmarketPartnerId: '',
  pointsEarning: '',
};

export default function LoyaltyRewardsAdminTab({ initialRewardId = null } = {}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [rewardTypeFilter, setRewardTypeFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [rejectFor, setRejectFor] = useState(null);
  const [confirmDeleteReward, setConfirmDeleteReward] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [listPage, setListPage] = useState(1);
  const { sort, order, toggleSort, sortParams } = useListSort('createdAt', 'desc');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_loyalty_rewards');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  useEffect(() => {
    setListPage(1);
  }, [search, approvalFilter, storeFilter, activeFilter, rewardTypeFilter, sort, order]);

  useEffect(() => {
    if (!initialRewardId || editor !== null) return;
    api.get(`/loyalty/rewards/${initialRewardId}`).then((r) => {
      const row = r.data;
      setEditor(row);
      setForm({
        name: row.name || '',
        description: row.description || '',
        redemptionType: row.redemptionType || 'points',
        pointsCost: String(row.pointsCost ?? 100),
        rewardType: row.rewardType || 'order_discount_amount',
        discountAmount: String(row.discountAmount ?? ''),
        discountPercent: row.discountPercent != null ? String(row.discountPercent) : '',
        minTierLevel: String(row.minTierLevel ?? 1),
        rewardScope: row.storeId ? 'store' : 'tenant',
        storeId: row.storeId ? String(row.storeId) : '',
        applicableItems: row.applicableItems || [],
        applicableItemNames: row.applicableItemNames || [],
        applicableCategories: row.applicableCategories || [],
        maxDiscountAmount: row.maxDiscountAmount != null ? String(row.maxDiscountAmount) : '',
        active: row.active !== false,
        foodmarketPartnerId: row.foodmarketPartnerId ? String(row.foodmarketPartnerId) : '',
        pointsEarning: row.pointsEarning != null ? String(row.pointsEarning) : '',
      });
    }).catch(() => {});
  }, [initialRewardId]);



  const queryParams = () => {
    const p = {};
    if (search.trim()) p.search = search.trim();
    if (approvalFilter !== 'all') p.approvalStatus = approvalFilter;
    if (storeFilter === 'tenant') p.storeId = 'tenant';
    else if (storeFilter) p.storeId = storeFilter;
    if (activeFilter === 'active') p.active = 'true';
    else if (activeFilter === 'inactive') p.active = 'false';
    if (rewardTypeFilter !== 'all') p.rewardType = rewardTypeFilter;
    return p;
  };

  const { data: rewardList = { items: [], page: 1, pages: 1, total: 0 }, isPending, isFetching } = useQuery({
    queryKey: ['admin-loyalty-rewards-tab', search, approvalFilter, storeFilter, activeFilter, rewardTypeFilter, listPage, sortParams],
    queryFn: () =>
      api
        .get('/loyalty/rewards', { params: { ...queryParams(), page: listPage, limit: 25, sort, order } })
        .then((r) => unwrapPagedList(r.data)),
  });
  const rows = rewardList.items || [];

  const { data: pendingQueueList = { items: [] } } = useQuery({
    queryKey: ['admin-loyalty-rewards-pending-only', sortParams],
    queryFn: () =>
      api
        .get('/loyalty/rewards', { params: { pending: true, page: 1, limit: 200, sort, order } })
        .then((r) => unwrapPagedList(r.data)),
  });
  const pendingQueue = pendingQueueList.items || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-loyalty-rewards-tab'] });
    qc.invalidateQueries({ queryKey: ['admin-loyalty-rewards-pending-only'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  };

  const closeEditor = (cancelled) => {
    setEditor(null);
    setForm(emptyForm);
    setFormError('');
    if (cancelled) toast.info('Changes discarded');
  };

  const { data: menuItems = [] } = useQuery({
    queryKey: ['admin-menu-loyalty-rewards', selectedStoreId],
    queryFn: () => api.get('/menu').then((r) => r.data),
    enabled: isStoreReady,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['admin-foodmarket-partners'],
    queryFn: () => api.get('/foodmarket-partners').then((r) => r.data),
  });
  const activePartners = partners.filter((p) => p.isActive);

  const save = useMutation({
    mutationFn: ({ id, payload }) =>
      id ? api.put(`/loyalty/rewards/${id}`, payload) : api.post('/loyalty/rewards', payload),
    onSuccess: () => {
      invalidate();
      closeEditor(false);
      toast.success('Reward saved');
    },
    onError: (e) => setFormError(e.response?.data?.message || 'Save failed'),
  });

  const approve = useMutation({
    mutationFn: ({ id, active }) => api.post(`/loyalty/rewards/${id}/approve`, { active }),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/loyalty/rewards/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      invalidate();
      setRejectFor(null);
      setRejectReason('');
    },
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/loyalty/rewards/${id}`),
    onSuccess: invalidate,
  });

  const storeLabel = (sid) => {
    if (sid == null) return 'All stores';
    const s = stores.find((x) => String(x._id) === String(sid));
    return s?.name || 'Store';
  };

  const openNew = () => {
    setEditor({});
    setForm({ ...emptyForm, rewardScope: 'tenant' });
  };

  const openEdit = (r) => {
    setEditor(r);
    setForm({
      name: r.name || '',
      description: r.description || '',
      redemptionType: r.redemptionType || 'points',
      pointsCost: String(r.pointsCost ?? 100),
      rewardType: r.rewardType || 'order_discount_amount',
      discountAmount: String(r.discountAmount ?? 0),
      discountPercent: String(r.discountPercent ?? ''),
      minTierLevel: String(r.minTierLevel ?? 1),
      rewardScope: r.storeId ? 'store' : 'tenant',
      storeId: r.storeId ? String(r.storeId) : '',
      applicableItems: r.applicableItems || [],
      applicableItemNames: r.applicableItemNames || [],
      applicableCategories: r.applicableCategories || [],
      maxDiscountAmount:
        r.maxDiscountAmount != null && r.maxDiscountAmount !== '' ? String(r.maxDiscountAmount) : '',
      active: r.active !== false,
      foodmarketPartnerId: r.foodmarketPartnerId ? String(r.foodmarketPartnerId) : '',
      pointsEarning: r.pointsEarning != null ? String(r.pointsEarning) : '',
    });
  };

  const submit = (e) => {
    e.preventDefault();
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
      active: Boolean(form.active),
      foodmarketPartnerId: form.foodmarketPartnerId || null,
      pointsEarning: Number(form.pointsEarning) || 0,
    };
    if (form.rewardScope === 'tenant') {
      payload.scope = 'tenant';
    } else {
      payload.scope = 'store';
      payload.storeId = form.storeId || undefined;
    }
    save.mutate({ id: editor?._id, payload });
  };

  return (
    <div className="space-y-6">
      {pendingQueue.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <Gift size={16} />
            Pending reward approvals (submitted from POS)
          </h3>
          <p className="text-xs text-amber-800 mt-1 mb-3">
            Store-scoped rewards created by managers require approval before they can be activated.
          </p>
          <div className="overflow-x-auto rounded-lg border border-amber-200/80 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-100/80 text-left text-amber-950">
                <tr>
                  <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Store</th>
                  <SortableTh label="Pts" field="pointsCost" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-3 py-2" />
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingQueue.map((r) => (
                  <tr key={r._id} className="border-t border-amber-100">
                    <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{storeLabel(r.storeId)}</td>
                    <td className="px-3 py-2 tabular-nums">{r.pointsCost}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => approve.mutate({ id: r._id, active: true })}
                        className="text-xs font-semibold text-brand-teal"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectFor(r)}
                        className="text-xs text-red-600"
                      >
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
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setListPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Filter by active state"
          >
            <option value="all">All states</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select
            value={rewardTypeFilter}
            onChange={(e) => { setRewardTypeFilter(e.target.value); setListPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            title="Filter by reward type"
          >
            <option value="all">All reward types</option>
            <option value="order_discount_amount">Fixed amount off order</option>
            <option value="order_discount_percent">Percent off order</option>
            <option value="free_item">Free item</option>
            <option value="points_earning">Points Earning</option>
          </select>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rewards…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_admin_loyalty_rewards', m); }} />
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-medium shrink-0"
          >
            <Plus size={16} /> New reward
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isPending ? (
          <p className="p-8 text-center text-gray-500 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">No rewards match your filters.</p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {rows.map((r) => (
              <div key={r._id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-gray-900 text-base">{r.name}</h3>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {storeLabel(r.storeId)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.description || 'No description'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      Pts: {r.pointsCost}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      Approval: {r.approvalStatus}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      Active: {r.active ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3 flex items-center justify-end gap-2 whitespace-nowrap">
                  {r.approvalStatus === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => approve.mutate({ id: r._id, active: true })}
                        className="text-brand-teal text-xs font-semibold hover:underline"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectFor(r)}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="text-brand-teal text-xs font-semibold inline-flex items-center gap-0.5 hover:underline"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteReward(r)}
                    className="text-red-600 text-xs inline-flex items-center gap-0.5 hover:underline"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-left">
                <tr>
                  <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <SortableTh label="Pts" field="pointsCost" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium">Status</th>
                  <SortableTh label="Active" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{storeLabel(r.storeId)}</td>
                    <td className="px-4 py-3 tabular-nums">{r.pointsCost}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase text-gray-600">{r.approvalStatus}</span>
                    </td>
                    <td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {r.approvalStatus === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => approve.mutate({ id: r._id, active: true })}
                            className="text-brand-teal text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectFor(r)}
                            className="text-red-600 text-xs"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-brand-teal text-xs font-semibold"
                      >
                        <Pencil size={12} className="inline mr-1" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteReward(r)}
                        className="text-red-600 text-xs"
                      >
                        <Trash2 size={12} className="inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isPending && rows.length > 0 && (
          <ListPagination
            page={rewardList.page}
            pages={rewardList.pages}
            total={rewardList.total}
            onPageChange={setListPage}
            isFetching={isFetching}
            className="px-4"
          />
        )}
      </div>

      {editor !== null && (
        <SideDrawer
          open
          onClose={() => closeEditor(true)}
          title={editor._id ? 'Edit loyalty reward' : 'New loyalty reward'}
          subtitle="Configure how members redeem this reward."
          width="max-w-lg"
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => closeEditor(true)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button type="submit" form="reward-drawer-form" disabled={save.isPending} className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold disabled:opacity-50">Save reward</button>
            </div>
          )}
        >
            <form id="reward-drawer-form" onSubmit={submit} className="space-y-3">
              <label className="block text-xs text-gray-600">
                Scope
                <select
                  value={form.rewardScope}
                  onChange={(e) => setForm((f) => ({ ...f, rewardScope: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="tenant">All stores (tenant-wide)</option>
                  <option value="store">Single store</option>
                </select>
              </label>
              {form.rewardScope === 'store' ? (
                <label className="block text-xs text-gray-600">
                  Store
                  <select
                    required
                    value={form.storeId}
                    onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select store…</option>
                    {stores.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
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
              <label className="block text-xs text-gray-600">
                Redemption
                <select
                  value={form.redemptionType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      redemptionType: e.target.value,
                      pointsCost: e.target.value === 'automatic' ? '0' : f.pointsCost || '100',
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="points">Spend loyalty points at checkout</option>
                  <option value="automatic">Member perk (no points spent)</option>
                </select>
              </label>
              {form.redemptionType !== 'automatic' ? (
                <label className="block text-xs text-gray-600">
                  Points cost *
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.pointsCost}
                    onChange={(e) => setForm((f) => ({ ...f, pointsCost: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <p className="text-xs text-gray-500">
                  Eligible members receive this discount automatically (tier rules still apply).
                </p>
              )}
              <label className="block text-xs text-gray-600">
                Reward type
                <select
                  value={form.rewardType}
                  onChange={(e) => setForm((f) => ({ ...f, rewardType: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="order_discount_amount">Fixed amount off order</option>
                  <option value="order_discount_percent">Percent off order</option>
                  <option value="free_item">Free item</option>
                  <option value="points_earning">Points Earning (Loyalty Perk)</option>
                </select>
              </label>
              {form.rewardType === 'order_discount_amount' ? (
                <label className="block text-xs text-gray-600">
                  Discount amount
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.discountAmount}
                    onChange={(e) => setForm((f) => ({ ...f, discountAmount: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
              {form.rewardType === 'order_discount_percent' ? (
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
              ) : null}
              {form.rewardType === 'points_earning' ? (
                <label className="block text-xs text-gray-600">
                  Points earned
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.pointsEarning}
                    onChange={(e) => setForm((f) => ({ ...f, pointsEarning: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
              <label className="block text-xs text-gray-600">
                Min tier level
                <input
                  type="number"
                  min={1}
                  value={form.minTierLevel}
                  onChange={(e) => setForm((f) => ({ ...f, minTierLevel: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              {(form.rewardType === 'order_discount_amount' || form.rewardType === 'order_discount_percent') && (
                <label className="block text-xs text-gray-600">
                  Max discount per order (optional)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Cap $ off from this reward"
                  />
                </label>
              )}
              <div>
                <p className="text-xs text-gray-600 mb-1">Apply to (optional — empty = whole order)</p>
                <RewardScopeCombobox
                  menuItems={menuItems}
                  isStoreReady={isStoreReady}
                  categoryNames={form.applicableCategories || []}
                  itemIds={form.applicableItems || []}
                  itemNames={form.applicableItemNames || []}
                  onPatch={(patch) => setForm((f) => ({ ...f, ...patch }))}
                />
              </div>

              {activePartners.length > 0 && (
                <label className="block text-xs text-gray-600">
                  Foodmarket Partner (Optional)
                  <select
                    value={form.foodmarketPartnerId || ''}
                    onChange={(e) => setForm((f) => ({ ...f, foodmarketPartnerId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">All Channels / In-Store</option>
                    {activePartners.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={Boolean(form.active)}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active (when approved)
              </label>
              {formError ? (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>
              ) : null}
            </form>
        </SideDrawer>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-900">Reject reward</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectFor(null)} className="px-3 py-2 text-sm text-gray-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => reject.mutate({ id: rejectFor._id, reason: rejectReason })}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteReward)}
        variant="delete"
        title="Delete reward?"
        message={`"${confirmDeleteReward?.name}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => { del.mutate(confirmDeleteReward._id); setConfirmDeleteReward(null); }}
        onCancel={() => setConfirmDeleteReward(null)}
      />
    </div>
  );
}
