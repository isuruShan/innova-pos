import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import ConfirmDialog from '../../components/ConfirmDialog';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import LoyaltyAddonBanner from '../../components/LoyaltyAddonBanner';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
import { useBranding } from '../../context/BrandingContext';
import { validateEmail } from '../../utils/customerValidation';
import PosPhoneField, { validatePosPhoneField, phoneDisplayFromParts, parseStoredPhone } from '../../components/PosPhoneField';
import SortableTh from '../../components/SortableTh';
import { useListSort } from '../../hooks/useListSort';

const empty = { name: '', email: '', birthday: '', notes: '' };
const emptyPhone = (defaultIso) => ({ countryIso: defaultIso || 'LK', nationalDigits: '' });

export default function CustomersPage() {
  const qc = useQueryClient();
  const branding = useBranding();
  const { data: paidAddons } = useTenantPaidAddons();
  const loyaltyAddonActive = paidAddons?.loyalty === true;
  const [search, setSearch] = useState('');
  const [slide, setSlide] = useState(null);
  const [form, setForm] = useState(empty);
  const [phoneField, setPhoneField] = useState(emptyPhone(branding.countryIso));
  const [formErrors, setFormErrors] = useState({});
  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsForm, setPointsForm] = useState({ lifetimePoints: '', note: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { sort, order, toggleSort, sortParams } = useListSort('createdAt', 'desc');
  const [activeTab, setActiveTab] = useState('profile');

  const { data: customerDetails } = useQuery({
    queryKey: ['pos-customer-details', slide?._id],
    queryFn: () => api.get(`/customers/${slide._id}?loyalty=1`).then((r) => r.data),
    enabled: Boolean(slide?._id && loyaltyAddonActive),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['pos-customer-history', slide?._id],
    queryFn: () => api.get(`/customers/${slide._id}/points/history`).then((r) => r.data),
    enabled: Boolean(slide?._id && loyaltyAddonActive),
  });

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['customers', search, sortParams],
    queryFn: () =>
      api.get('/customers', {
        params: {
          ...(search.trim() ? { search: search.trim() } : {}),
          sort,
          order,
        },
      }).then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (payload) =>
      slide?._id
        ? api.put(`/customers/${slide._id}`, payload)
        : api.post('/customers', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['pos-customer-details'] });
      qc.invalidateQueries({ queryKey: ['pos-customer-history'] });
      setSlide(null);
      setForm(empty);
      setPhoneField(emptyPhone(branding.countryIso));
      setFormErrors({});
      setActiveTab('profile');
    },
  });

  const adjustPoints = useMutation({
    mutationFn: ({ id, lifetimePoints, note }) =>
      api.post(`/customers/${id}/points`, { lifetimePoints, note }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['pos-customer-details'] });
      qc.invalidateQueries({ queryKey: ['pos-customer-history'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setPointsOpen(false);
      setPointsForm({ lifetimePoints: String(data.lifetimePoints ?? 0), note: '' });
      setSlide(data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setSlide(null);
      setConfirmDelete(null);
    },
  });

  const openNew = () => {
    setSlide({});
    setForm(empty);
    setPhoneField(emptyPhone(branding.countryIso));
    setFormErrors({});
    setActiveTab('profile');
  };

  const openEdit = (c) => {
    setFormErrors({});
    setSlide(c);
    setForm({
      name: c.name || '',
      email: c.email || '',
      birthday: c.birthday ? String(c.birthday).slice(0, 10) : '',
      notes: c.notes || '',
    });
    setPhoneField(parseStoredPhone(c.mobile, branding.countryIso || 'LK'));
    setPointsForm({
      lifetimePoints: String(c.lifetimePoints ?? 0),
      note: '',
    });
    setActiveTab('profile');
  };

  const submit = (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const phoneErr = validatePosPhoneField(phoneField.countryIso, phoneField.nationalDigits);
    const emailErr = email ? validateEmail(email) : '';
    if (phoneErr || emailErr) {
      setFormErrors({ mobile: phoneErr, email: emailErr });
      return;
    }
    setFormErrors({});
    const mobileDisplay = phoneDisplayFromParts(phoneField.countryIso, phoneField.nationalDigits);
    const payload = {
      name: form.name.trim(),
      mobile: mobileDisplay,
      email,
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
        <LoyaltyAddonBanner className="mb-6" />
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
                  <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Email</th>
                  <SortableTh label="Updated" field="updatedAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Points" field="points" currentSort={sort} currentOrder={order} onSort={toggleSort} />
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
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                    </td>
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
        {slide?._id && loyaltyAddonActive && (
          <div className="flex border-b border-slate-700 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2.5 text-center text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-[var(--pos-text-primary)]'
              }`}
            >
              Profile Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('loyalty')}
              className={`flex-1 py-2.5 text-center text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'loyalty'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-[var(--pos-text-primary)]'
              }`}
            >
              Loyalty & History
            </button>
          </div>
        )}

        {(activeTab === 'profile' || !slide?._id || !loyaltyAddonActive) ? (
          <form onSubmit={submit} className="space-y-4">
            {[
              { key: 'name', type: 'text', label: 'Name' },
            ].map(({ key, type, label }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none"
                />
              </div>
            ))}
            <PosPhoneField
              countryIso={phoneField.countryIso}
              nationalDigits={phoneField.nationalDigits}
              onCountryIsoChange={(iso) => setPhoneField((p) => ({ ...p, countryIso: iso }))}
              onNationalDigitsChange={(d) => { setPhoneField((p) => ({ ...p, nationalDigits: d })); setFormErrors((e) => ({ ...e, mobile: '' })); }}
              error={formErrors.mobile}
            />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setFormErrors((err) => ({ ...err, email: '' })); }}
                className={`w-full bg-[var(--pos-surface-inset)] border rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none ${
                  formErrors.email ? 'border-red-500' : 'border-slate-700'
                }`}
              />
              {formErrors.email && <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Birthday</label>
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm resize-none focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={save.isPending}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold"
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            {slide?._id && (
              <button
                type="button"
                onClick={() => setConfirmDelete(slide)}
                className="w-full py-3 rounded-xl border border-red-500 hover:bg-red-500/10 text-red-500 font-semibold mt-2 transition"
              >
                Delete Customer
              </button>
            )}
          </form>
        ) : (
          <div className="space-y-4">
            {/* Tier & Points Info */}
            <div className="bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Current Loyalty Tier</p>
                {customerDetails?.loyalty?.effectiveTier ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
                      {customerDetails.loyalty.effectiveTier.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({customerDetails.loyalty.effectiveTier.discountPercentage}% discount)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-slate-400 mt-1">
                    No Active Tier
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Available Points</p>
                <p className="text-2xl font-black text-amber-400 mt-0.5 tabular-nums">
                  {customerDetails?.lifetimePoints ?? 0}
                </p>
              </div>
            </div>

            {/* Adjust Points Inline Form */}
            <div className="bg-[var(--pos-panel)] border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Adjust Loyalty Points</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">New Points</label>
                    <input
                      type="number"
                      min={0}
                      value={pointsForm.lifetimePoints}
                      onChange={(e) => setPointsForm((f) => ({ ...f, lifetimePoints: e.target.value }))}
                      className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none focus:border-amber-400"
                      placeholder="Points"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Reason/Note</label>
                    <input
                      type="text"
                      value={pointsForm.note}
                      onChange={(e) => setPointsForm((f) => ({ ...f, note: e.target.value }))}
                      className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none focus:border-amber-400"
                      placeholder="Adjustment reason"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={adjustPoints.isPending}
                  onClick={() => {
                    const n = Number(pointsForm.lifetimePoints);
                    if (Number.isNaN(n) || n < 0) return;
                    adjustPoints.mutate({
                      id: slide._id,
                      lifetimePoints: n,
                      note: pointsForm.note,
                    });
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition"
                >
                  {adjustPoints.isPending ? 'Adjusting...' : 'Save adjusted points'}
                </button>
              </div>
            </div>

            {/* History Ledger Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Points Ledger / History</h4>
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-[var(--pos-surface-inset)] max-h-56 overflow-y-auto">
                {historyLoading ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading history...</div>
                ) : history.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">No points transactions recorded.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
                      <tr className="text-slate-400 font-medium">
                        <th className="px-3 py-2 bg-slate-800">Date</th>
                        <th className="px-3 py-2 bg-slate-800">Activity</th>
                        <th className="px-3 py-2 text-right bg-slate-800">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {history.map((h, idx) => {
                        const isPositive = h.points >= 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                              {new Date(h.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-200 capitalize">{h.type}</div>
                              {h.note && <div className="text-[10px] text-slate-500 mt-0.5">{h.note}</div>}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? `+${h.points}` : h.points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </SlideOver>

      {pointsOpen && slide?._id ? (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60"
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

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        variant="delete"
        title="Delete customer?"
        message={
          confirmDelete?.lifetimePoints > 0
            ? `This customer has ${confirmDelete.lifetimePoints} loyalty points. Deleting this customer will permanently remove their loyalty profile and points.\n\nAre you sure you want to proceed?`
            : `Are you sure you want to permanently delete this customer?`
        }
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(confirmDelete._id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
