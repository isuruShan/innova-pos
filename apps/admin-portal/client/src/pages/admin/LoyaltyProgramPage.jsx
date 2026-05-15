import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Trash2, RefreshCw, Users, Gift } from 'lucide-react';
import api from '../../api/axios';
import LoyaltyRewardsAdminTab from './LoyaltyRewardsAdminTab';
import ListPagination from '../../components/common/ListPagination';
import { unwrapPagedList } from '../../utils/unwrapPagedList';

const emptyTier = { name: '', level: '1', minLifetimePoints: '0', description: '' };

export default function LoyaltyProgramPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mainTab, setMainTab] = useState('program');
  const [tierModal, setTierModal] = useState(null);
  const [tierForm, setTierForm] = useState(emptyTier);
  const [resolveFor, setResolveFor] = useState(null);
  const [pointsAction, setPointsAction] = useState('keep');
  const [tierAction, setTierAction] = useState('computed');
  const [retentionPage, setRetentionPage] = useState(1);

  const { data: cfg, isPending: cfgPending } = useQuery({
    queryKey: ['loyalty-config'],
    queryFn: () => api.get('/loyalty/config').then((r) => r.data),
  });

  const { data: tiersRaw = [], isPending: tiersPending } = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: () => api.get('/loyalty/tiers').then((r) => r.data),
  });
  const tiers = Array.isArray(tiersRaw) ? tiersRaw : unwrapPagedList(tiersRaw).items;

  const { data: retentionList = { items: [], page: 1, pages: 1, total: 0 }, isPending: pendPending, isFetching: pendFetching } = useQuery({
    queryKey: ['loyalty-retention-pending', retentionPage],
    queryFn: () =>
      api
        .get('/loyalty/retention/pending', { params: { page: retentionPage, limit: 25 } })
        .then((r) => unwrapPagedList(r.data)),
  });
  const pendingRetention = retentionList.items || [];

  const saveCfg = useMutation({
    mutationFn: (payload) => api.put('/loyalty/config', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-config'] }),
  });

  const syncRetention = useMutation({
    mutationFn: () => api.post('/loyalty/retention/sync'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-retention-pending'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const resolveRetention = useMutation({
    mutationFn: ({ id, body }) => api.post(`/loyalty/retention/${id}/resolve`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-retention-pending'] });
      setResolveFor(null);
    },
  });

  const saveTier = useMutation({
    mutationFn: ({ id, payload }) =>
      id ? api.put(`/loyalty/tiers/${id}`, payload) : api.post('/loyalty/tiers', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-tiers'] });
      setTierModal(null);
      setTierForm(emptyTier);
    },
  });

  const deleteTier = useMutation({
    mutationFn: (id) => api.delete(`/loyalty/tiers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-tiers'] }),
  });

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => (a.minLifetimePoints ?? 0) - (b.minLifetimePoints ?? 0)),
    [tiers],
  );

  useEffect(() => {
    if (searchParams.get('tab') !== 'rewards') return;
    setMainTab('rewards');
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const submitTier = (e) => {
    e.preventDefault();
    saveTier.mutate({
      id: tierModal?._id,
      payload: {
        name: tierForm.name.trim(),
        level: Number(tierForm.level) || 1,
        minLifetimePoints: Number(tierForm.minLifetimePoints) || 0,
        description: tierForm.description.trim(),
      },
    });
  };

  const openResolve = (row) => {
    setResolveFor(row);
    setPointsAction('keep');
    setTierAction('computed');
  };

  if (mainTab === 'program' && (cfgPending || tiersPending)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">Loading…</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="text-brand-orange" size={26} />
          Loyalty admin
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Program rules and rewards for your whole organization. Customers are managed under Customers in the sidebar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setMainTab('program')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mainTab === 'program'
              ? 'bg-brand-teal text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Award size={16} />
          Program & tiers
        </button>
        <button
          type="button"
          onClick={() => setMainTab('rewards')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mainTab === 'rewards'
              ? 'bg-brand-teal text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Gift size={16} />
          Rewards
        </button>
      </div>

      {mainTab === 'rewards' ? (
        <LoyaltyRewardsAdminTab />
      ) : (
        <>
      <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Program settings</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-xs text-gray-600">
            Spend per earn block
            <input
              type="number"
              min={1}
              defaultValue={cfg?.spendPerEarnBlock ?? 100}
              key={String(cfg?.spendPerEarnBlock)}
              id="adm-spendPerEarnBlock"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Points per block
            <input
              type="number"
              min={0}
              defaultValue={cfg?.pointsPerEarnBlock ?? 1}
              key={String(cfg?.pointsPerEarnBlock)}
              id="adm-pointsPerEarnBlock"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600 sm:col-span-2">
            Points retention period (days without loyalty activity before customers need review — leave empty to disable)
            <input
              type="number"
              min={0}
              placeholder="e.g. 365 — empty = off"
              defaultValue={cfg?.pointsRetentionDays ?? ''}
              key={String(cfg?.pointsRetentionDays)}
              id="adm-pointsRetentionDays"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" id="adm-isEnabled" defaultChecked={cfg?.isEnabled !== false} />
            Loyalty earning enabled
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            const sp = document.getElementById('adm-spendPerEarnBlock');
            const pp = document.getElementById('adm-pointsPerEarnBlock');
            const rd = document.getElementById('adm-pointsRetentionDays');
            const en = document.getElementById('adm-isEnabled');
            const rawRd = rd?.value?.trim();
            saveCfg.mutate({
              spendPerEarnBlock: Number(sp?.value) || 100,
              pointsPerEarnBlock: Number(pp?.value) ?? 1,
              isEnabled: Boolean(en?.checked),
              pointsRetentionDays: rawRd === '' || rawRd == null ? null : Number(rawRd),
            });
          }}
          className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:opacity-95"
        >
          Save settings
        </button>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Tier ladder (tenant-wide)</h2>
            <p className="text-xs text-gray-600 mt-1">
              The same thresholds apply to every store in your organization.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTierModal({});
              setTierForm(emptyTier);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange text-white text-sm font-medium shrink-0"
          >
            <Plus size={16} /> Add tier
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Min lifetime points</th>
                <th className="px-3 py-2 font-medium w-24" />
              </tr>
            </thead>
            <tbody>
              {sortedTiers.map((t) => (
                <tr key={t._id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{t.name}</td>
                  <td className="px-3 py-2">{t.level}</td>
                  <td className="px-3 py-2 tabular-nums">{t.minLifetimePoints}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      type="button"
                      className="text-brand-teal text-xs font-semibold"
                      onClick={() => {
                        setTierModal(t);
                        setTierForm({
                          name: t.name || '',
                          level: String(t.level ?? 1),
                          minLifetimePoints: String(t.minLifetimePoints ?? 0),
                          description: t.description || '',
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-red-600 text-xs"
                      onClick={() => {
                        if (window.confirm(`Delete tier "${t.name}"?`)) deleteTier.mutate(t._id);
                      }}
                    >
                      <Trash2 size={14} className="inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users size={16} className="text-brand-orange" />
            Retention review queue
          </h2>
          <button
            type="button"
            onClick={() => syncRetention.mutate()}
            disabled={syncRetention.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncRetention.isPending ? 'animate-spin' : ''} />
            Run inactivity check
          </button>
        </div>
        <p className="text-xs text-gray-600">
          Flags customers who have had no qualifying loyalty activity for longer than the retention period. Then choose
          whether to reset or keep points, and whether tier should follow points or be forced to the entry level.
        </p>

        {pendPending ? (
          <p className="text-sm text-gray-500">Loading queue…</p>
        ) : pendingRetention.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
            No customers pending retention review.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Points</th>
                    <th className="px-3 py-2 font-medium">Tier</th>
                    <th className="px-3 py-2 font-medium">Last activity</th>
                    <th className="px-3 py-2 font-medium w-28" />
                  </tr>
                </thead>
                <tbody>
                  {pendingRetention.map((row) => (
                    <tr key={row._id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{row.name || '—'}</div>
                        <div className="text-xs text-gray-500">{row.email || row.mobile || ''}</div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{row.lifetimePoints ?? 0}</td>
                      <td className="px-3 py-2">{row.effectiveTier?.name || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {row.lastLoyaltyActivityAt
                          ? new Date(row.lastLoyaltyActivityAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openResolve(row)}
                          className="text-amber-700 hover:text-amber-900 text-xs font-semibold"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={retentionList.page}
              pages={retentionList.pages}
              total={retentionList.total}
              onPageChange={setRetentionPage}
              isFetching={pendFetching}
            />
          </>
        )}
      </section>

      {tierModal !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{tierModal._id ? 'Edit tier' : 'New tier'}</h3>
            <form onSubmit={submitTier} className="space-y-3">
              <label className="block text-xs text-gray-600">
                Name
                <input
                  required
                  value={tierForm.name}
                  onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-600">
                  Level (display order)
                  <input
                    type="number"
                    min={1}
                    value={tierForm.level}
                    onChange={(e) => setTierForm((f) => ({ ...f, level: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  Min lifetime points
                  <input
                    type="number"
                    min={0}
                    value={tierForm.minLifetimePoints}
                    onChange={(e) => setTierForm((f) => ({ ...f, minLifetimePoints: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs text-gray-600">
                Description
                <textarea
                  value={tierForm.description}
                  onChange={(e) => setTierForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTierModal(null);
                    setTierForm(emptyTier);
                  }}
                  className="px-3 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resolveFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Resolve retention — {resolveFor.name || 'Customer'}</h3>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Points</label>
              <select
                value={pointsAction}
                onChange={(e) => setPointsAction(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="keep">Keep current points balance</option>
                <option value="reset">Reset all points to zero</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Tier after resolution</label>
              <select
                value={tierAction}
                onChange={(e) => setTierAction(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="computed">Follow points (normal ladder)</option>
                <option value="force_bottom">Force to entry tier (while keeping points if you chose keep)</option>
              </select>
            </div>
            <p className="text-xs text-gray-600">
              After you confirm, the customer&apos;s review clock restarts from today.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResolveFor(null)} className="px-3 py-2 text-sm text-gray-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  resolveRetention.mutate({
                    id: resolveFor._id,
                    body: {
                      pointsAction,
                      tierAction,
                    },
                  })
                }
                disabled={resolveRetention.isPending}
                className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-medium disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
