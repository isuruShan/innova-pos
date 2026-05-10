import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

const empty = { name: '', mobile: '', email: '', birthday: '', notes: '' };

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [slide, setSlide] = useState(null);
  const [form, setForm] = useState(empty);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsForm, setPointsForm] = useState({ lifetimePoints: '', note: '' });

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['customers', search],
    queryFn: () =>
      api.get('/customers', { params: search.trim() ? { search: search.trim() } : {} }).then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (payload) =>
      slide?._id
        ? api.put(`/customers/${slide._id}`, payload)
        : api.post('/customers', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setSlide(null);
      setForm(empty);
    },
  });

  const adjustPoints = useMutation({
    mutationFn: ({ id, lifetimePoints, note }) =>
      api.post(`/customers/${id}/points`, { lifetimePoints, note }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setPointsOpen(false);
      setPointsForm({ lifetimePoints: '', note: '' });
      setSlide(data);
    },
  });

  const openNew = () => {
    setSlide({});
    setForm(empty);
  };

  const openEdit = (c) => {
    setSlide(c);
    setForm({
      name: c.name || '',
      mobile: c.mobile || '',
      email: c.email || '',
      birthday: c.birthday ? String(c.birthday).slice(0, 10) : '',
      notes: c.notes || '',
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      ...(form.birthday ? { birthday: new Date(form.birthday).toISOString() } : { birthday: null }),
    };
    save.mutate(payload);
  };

  const submitPoints = (e) => {
    e.preventDefault();
    if (!slide?._id) return;
    const n = Number(pointsForm.lifetimePoints);
    if (Number.isNaN(n) || n < 0) return;
    adjustPoints.mutate({
      id: slide._id,
      lifetimePoints: n,
      note: pointsForm.note,
    });
  };

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Users className="text-amber-400" />
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Customers</h1>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, mobile…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--pos-panel)] border border-slate-700 text-sm text-[var(--pos-text-primary)]"
              />
            </div>
            <button
              type="button"
              onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
          {isPending ? (
            <p className="p-8 text-center text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No customers yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left text-slate-500 text-xs uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => openEdit(c)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-[var(--pos-text-primary)] font-medium">{c.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.mobile || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-[180px]">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-amber-400 font-semibold">{c.lifetimePoints ?? 0}</td>
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
          setPointsOpen(false);
        }}
        title={slide?._id ? 'Edit customer' : 'New customer'}
      >
        <form onSubmit={submit} className="space-y-4">
          {slide?._id ? (
            <div className="rounded-xl border border-slate-700 bg-[var(--pos-surface-inset)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">Lifetime points (tenant-wide)</p>
                  <p className="text-lg font-semibold text-amber-400 tabular-nums">{slide.lifetimePoints ?? 0}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPointsForm({
                      lifetimePoints: String(slide.lifetimePoints ?? 0),
                      note: '',
                    });
                    setPointsOpen(true);
                  }}
                  className="shrink-0 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                >
                  Adjust points
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Merchant admins are notified in-app when points change.
              </p>
            </div>
          ) : null}
          {['name', 'mobile', 'email'].map((k) => (
            <div key={k}>
              <label className="block text-xs text-slate-400 mb-1 capitalize">{k}</label>
              <input
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Birthday</label>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={save.isPending}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </SlideOver>

      {pointsOpen && slide?._id ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setPointsOpen(false)}
          role="presentation"
        >
          <div
            className="bg-[var(--pos-panel)] rounded-2xl max-w-md w-full p-5 border border-slate-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-[var(--pos-text-primary)] mb-4">Adjust lifetime points</h3>
            <form onSubmit={submitPoints} className="space-y-3">
              <label className="block text-xs text-slate-400">
                Points
                <input
                  type="number"
                  min={0}
                  required
                  value={pointsForm.lifetimePoints}
                  onChange={(e) => setPointsForm((f) => ({ ...f, lifetimePoints: e.target.value }))}
                  className="mt-1 w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Note (optional)
                <textarea
                  value={pointsForm.note}
                  onChange={(e) => setPointsForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm resize-none"
                  placeholder="Reason for adjustment"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPointsOpen(false)}
                  className="px-3 py-2 text-sm text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustPoints.isPending}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  {adjustPoints.isPending ? 'Saving…' : 'Save points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
