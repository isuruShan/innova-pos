import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_LINKS } from '../../constants/managerLinks';
import { useAuth } from '../../context/AuthContext';

const empty = {
  name: '',
  description: '',
  pointsCost: '100',
  rewardType: 'order_discount_amount',
  discountAmount: '5',
  discountPercent: '',
  minTierLevel: '1',
};

export default function LoyaltyRewardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [slide, setSlide] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['loyalty-rewards'],
    queryFn: () => api.get('/loyalty/rewards').then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: ({ id, payload }) =>
      id ? api.put(`/loyalty/rewards/${id}`, payload) : api.post('/loyalty/rewards', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      setSlide(null);
      setForm(empty);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      pointsCost: Number(form.pointsCost) || 1,
      rewardType: form.rewardType,
      discountAmount: Number(form.discountAmount) || 0,
      discountPercent: Number(form.discountPercent) || 0,
      minTierLevel: Number(form.minTierLevel) || 1,
      active: false,
    };
    save.mutate({ id: slide?._id, payload });
  };

  const isManager = user?.role === 'manager';

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar links={MANAGER_LINKS} />
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Gift className="text-amber-400" />
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Loyalty rewards</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setSlide({});
              setForm(empty);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm"
          >
            <Plus size={16} /> New reward
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {isManager
            ? 'Rewards you create stay pending until a merchant admin approves them.'
            : 'You can create rewards directly or approve requests from managers in Approvals.'}
        </p>

        <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
          {isPending ? (
            <p className="p-8 text-center text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No rewards yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left text-slate-500 text-xs uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 text-[var(--pos-text-primary)]">{r.name}</td>
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

      <SlideOver open={slide !== null} onClose={() => { setSlide(null); setForm(empty); }} title="Loyalty reward">
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
          <div>
            <label className="block text-xs text-slate-400 mb-1">Reward type</label>
            <select
              value={form.rewardType}
              onChange={(e) => setForm((f) => ({ ...f, rewardType: e.target.value }))}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm"
            >
              <option value="order_discount_amount">Fixed amount off order</option>
              <option value="order_discount_percent">Percent off order</option>
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
