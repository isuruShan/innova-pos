import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Trash2, Gift } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
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
  const { data: cfg, isPending: cfgPending } = useQuery({
    queryKey: ['loyalty-config'],
    queryFn: () => api.get('/loyalty/config').then((r) => r.data),
  });

  const { data: tiersRaw = [], isPending: tiersPending } = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: () => api.get('/loyalty/tiers').then((r) => r.data),
  });
  const tiers = Array.isArray(tiersRaw) ? tiersRaw : unwrapPagedList(tiersRaw).items;


  const toast = useToast();
  const saveCfg = useMutation({
    mutationFn: (payload) => api.put('/loyalty/config', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-config'] });
      toast.success('Loyalty settings saved');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save settings'),
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
    if (searchParams.get('tab') === 'rewards') setMainTab('rewards');
  }, [searchParams]);

  const rewardIdFromUrl = searchParams.get('reward');

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
        <LoyaltyRewardsAdminTab initialRewardId={rewardIdFromUrl} />
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
          <label className="block text-xs text-gray-600">
            Points retention period
            <select id="adm-pointsRetentionMode" defaultValue={cfg?.pointsRetentionMode || 'none'} key={cfg?.pointsRetentionMode} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="none">No retention (points never expire)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label className="block text-xs text-gray-600">
            Period start date
            <input
              type="date"
              id="adm-pointsRetentionStartDate"
              defaultValue={cfg?.pointsRetentionStartDate ? String(cfg.pointsRetentionStartDate).slice(0, 10) : ''}
              key={String(cfg?.pointsRetentionStartDate)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" id="adm-retentionDowngrade" defaultChecked={Boolean(cfg?.retentionDowngradeToLevel1)} />
            When the period ends, reset all customers to tier level 1
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
            const mode = document.getElementById('adm-pointsRetentionMode')?.value || 'none';
            const start = document.getElementById('adm-pointsRetentionStartDate')?.value || '';
            const downgrade = document.getElementById('adm-retentionDowngrade')?.checked;
            const en = document.getElementById('adm-isEnabled');
            saveCfg.mutate({
              spendPerEarnBlock: Number(sp?.value) || 100,
              pointsPerEarnBlock: Number(pp?.value) ?? 1,
              isEnabled: Boolean(en?.checked),
              pointsRetentionMode: mode,
              pointsRetentionStartDate: mode === 'none' ? null : (start || null),
              retentionDowngradeToLevel1: Boolean(downgrade),
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

        </>
      )}
    </div>
  );
}
