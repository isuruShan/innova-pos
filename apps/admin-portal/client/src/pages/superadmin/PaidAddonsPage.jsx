import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader, Save, X, Upload, Sparkles, Trash2,
  Users, ChevronRight, BadgeDollarSign, Globe, Building2,
} from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';

/* ─────────────────────────────────────────────
   Standard add-on edit drawer (unchanged)
───────────────────────────────────────────── */
function AddonEditDrawer({ row, onClose, onSaved }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState({
    ...row,
    _previewUrls: row.screenshotPreviewUrls || row.screenshotUrls || [],
  });
  const [uploading, setUploading] = useState(false);

  const saveMut = useMutation({
    mutationFn: () => api.put(`/paid-addons/${edit.code}`, edit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paid-addons'] });
      toast.success('Saved');
      onSaved?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', file);
      const { data } = await api.post(`/paid-addons/${edit.code}/screenshots`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEdit((prev) => ({
        ...prev,
        screenshotUrls: data.screenshotUrls || [...(prev.screenshotUrls || []), data.key],
        _previewUrls: [...(prev._previewUrls || prev.screenshotUrls || []), data.url].filter(Boolean),
      }));
      toast.success('Screenshot uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const previews = edit._previewUrls || edit.screenshotUrls || [];

  const removeScreenshot = (index) => {
    setEdit((prev) => ({
      ...prev,
      screenshotUrls: (prev.screenshotUrls || []).filter((_, i) => i !== index),
      _previewUrls: (prev._previewUrls || prev.screenshotUrls || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-gray-200 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addon-drawer-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 id="addon-drawer-title" className="text-lg font-bold text-gray-900 truncate pr-2">
            {edit.name}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-sm" value={edit.code} disabled />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={2}
              value={edit.shortDescription}
              onChange={(e) => setEdit({ ...edit, shortDescription: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Long description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={5}
              value={edit.longDescription}
              onChange={(e) => setEdit({ ...edit, longDescription: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Screenshots</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {previews.map((url, i) => (
                <div key={`${url}-${i}`} className="relative group">
                  <img
                    src={url}
                    alt={`Screenshot ${i + 1}`}
                    className="w-20 h-28 object-cover object-top rounded-lg border border-gray-200 bg-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(i)}
                    className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove screenshot"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-700 hover:border-amber-500 cursor-pointer">
              {uploading ? <Loader className="animate-spin w-4 h-4" /> : <Upload size={16} />}
              {uploading ? 'Uploading…' : 'Upload screenshot'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleScreenshotUpload} disabled={uploading} />
            </label>
            <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP — max 8MB</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={edit.monthlyAmount}
                onChange={(e) => setEdit({ ...edit, monthlyAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yearly price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={edit.yearlyAmount}
                onChange={(e) => setEdit({ ...edit, yearlyAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency (Sri Lanka)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
              value={edit.currency}
              onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-3">
            <p className="text-sm font-semibold text-blue-900">International pricing (merchants outside Sri Lanka)</p>
            <p className="text-xs text-blue-800">Shown in USD. International merchants pay add-ons via PayPal only.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monthly (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={edit.internationalMonthlyAmount ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, internationalMonthlyAmount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Yearly (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={edit.internationalYearlyAmount ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, internationalYearlyAmount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">International currency</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
                value={edit.internationalCurrency || 'USD'}
                onChange={(e) => setEdit({ ...edit, internationalCurrency: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={edit.isActive}
              onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
            />
            Active (merchants can purchase)
          </label>
        </div>

        <div className="px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {saveMut.isPending ? <Loader className="animate-spin w-4 h-4" /> : <Save size={16} />}
            Save changes
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────
   Role config for the User License drawer
───────────────────────────────────────────── */
const ROLE_CONFIG = [
  {
    role: 'merchant_admin',
    label: 'Merchant Admin',
    description: 'Full account control',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
  },
  {
    role: 'manager',
    label: 'Manager',
    description: 'Store & staff management',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    role: 'cashier',
    label: 'Cashier',
    description: 'POS & order processing',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    role: 'kitchen',
    label: 'Kitchen Staff',
    description: 'Kitchen display & orders',
    color: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
];

/* ─────────────────────────────────────────────
   Single role pricing card inside the drawer
───────────────────────────────────────────── */
function RolePricingCard({ row, config }) {
  const toast = useToast();
  const [edit, setEdit] = useState({ ...row });
  const [saved, setSaved] = useState(false);

  const saveMut = useMutation({
    mutationFn: () => api.put(`/user-licensing/pricing/${edit.role}`, edit),
    onSuccess: () => {
      toast.success(`${config.label} pricing saved`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const num = (key, val) =>
    setEdit((p) => ({ ...p, [key]: val === '' ? 0 : Number(val) }));

  const isDirty =
    edit.userSeatMonthlyAmount !== row.userSeatMonthlyAmount ||
    edit.extraStoreMonthlyAmount !== row.extraStoreMonthlyAmount ||
    edit.internationalUserSeatMonthlyAmount !== row.internationalUserSeatMonthlyAmount ||
    edit.internationalExtraStoreMonthlyAmount !== row.internationalExtraStoreMonthlyAmount;

  return (
    <div className={`rounded-2xl border ${config.border} overflow-hidden`}>
      {/* Role header */}
      <div className={`bg-gradient-to-r ${config.color} px-4 py-3 flex items-center justify-between`}>
        <div>
          <p className="text-white font-semibold text-sm">{config.label}</p>
          <p className="text-white/70 text-xs mt-0.5">{config.description}</p>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${config.badge} bg-white/20 text-white`}>
          {row.role}
        </span>
      </div>

      {/* Pricing fields */}
      <div className={`${config.bg} px-4 py-4 space-y-4`}>

        {/* Local pricing */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <BadgeDollarSign size={13} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Local — LKR / month
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Per user seat</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                  LKR
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  value={edit.userSeatMonthlyAmount}
                  onChange={(e) => num('userSeatMonthlyAmount', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Per extra store</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                  LKR
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  value={edit.extraStoreMonthlyAmount}
                  onChange={(e) => num('extraStoreMonthlyAmount', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* International pricing */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Globe size={13} className="text-blue-500" />
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              International — USD / month
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Per user seat</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition"
                  value={edit.internationalUserSeatMonthlyAmount}
                  onChange={(e) => num('internationalUserSeatMonthlyAmount', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Per extra store</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition"
                  value={edit.internationalExtraStoreMonthlyAmount}
                  onChange={(e) => num('internationalExtraStoreMonthlyAmount', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || (!isDirty && !saved)}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
            ${saved
              ? 'bg-emerald-500 text-white'
              : isDirty
                ? 'bg-gray-900 text-white hover:bg-gray-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
        >
          {saveMut.isPending ? (
            <Loader size={14} className="animate-spin" />
          ) : saved ? (
            <>✓ Saved</>
          ) : (
            <>
              <Save size={14} />
              Save {config.label}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   User License Pricing side drawer
───────────────────────────────────────────── */
function UserLicensePricingDrawer({ onClose }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['user-license-pricing'],
    queryFn: () => api.get('/user-licensing/pricing').then((r) => r.data),
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.18)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ulp-drawer-title"
      >
        {/* Premium header with gradient */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-5 shrink-0">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <h2 id="ulp-drawer-title" className="text-white font-bold text-base leading-tight">
                  User License Pricing
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">Monthly rates per role</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Info pills */}
          <div className="relative flex gap-2 mt-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-slate-300">
              <BadgeDollarSign size={11} />
              LKR · Local
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-slate-300">
              <Globe size={11} />
              USD · International
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-slate-300">
              <Building2 size={11} />
              Per user seat + extra store
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-5 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader className="animate-spin w-8 h-8 text-slate-400" />
              <p className="text-sm text-gray-400">Loading pricing…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">No pricing data found.</div>
          ) : (
            ROLE_CONFIG.map((config) => {
              const row = rows.find((r) => r.role === config.role);
              if (!row) return null;
              return (
                <RolePricingCard key={config.role} row={row} config={config} />
              );
            })
          )}

          {/* Footer note */}
          {!isLoading && rows.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
              <span className="text-amber-500 mt-0.5 shrink-0">ℹ️</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                These are monthly rates per additional user seat or extra store assignment.
                Merchants are charged prorated amounts based on their remaining billing period.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────
   Static "User License Pricing" tile
───────────────────────────────────────────── */
function UserLicenseTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-5 shadow-sm hover:shadow-lg hover:border-slate-500 transition-all duration-200 flex flex-col gap-3 group"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 transition">
          <Users size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">User License Pricing</h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">user-licensing</p>
        </div>
        <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 transition mt-0.5 shrink-0" />
      </div>
      <p className="text-sm text-slate-400 line-clamp-2">
        Per-role monthly pricing for additional user seats and extra store assignments.
      </p>
      <div className="flex items-center justify-between text-xs mt-auto pt-1">
        <span className="text-emerald-400 font-medium">Active</span>
        <span className="text-slate-500 tabular-nums">4 roles configured</span>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function PaidAddonsPage() {
  const [selected, setSelected] = useState(null);          // standard add-on row
  const [showUserLicensing, setShowUserLicensing] = useState(false);

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['paid-addons'],
    queryFn: () => api.get('/paid-addons').then((r) => r.data),
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-20">
        <Loader className="animate-spin w-8 h-8 text-amber-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paid add-ons</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configure optional features merchants can subscribe to. Select a tile to edit details and upload screenshots.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Dynamic add-on tiles from DB */}
        {rows.map((row) => (
          <button
            key={row.code}
            type="button"
            onClick={() => setSelected(row)}
            className="text-left bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{row.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{row.code}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{row.shortDescription}</p>
            <div className="flex items-center justify-between text-xs mt-auto pt-1">
              <span className={row.isActive ? 'text-green-700 font-medium' : 'text-gray-400'}>
                {row.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="font-semibold text-gray-900 tabular-nums text-right">
                <span className="block">{row.currency} {Number(row.monthlyAmount || 0).toLocaleString()}/mo</span>
                <span className="block text-blue-700 font-normal">
                  {row.internationalCurrency || 'USD'}{' '}
                  {Number(row.internationalMonthlyAmount || 0).toLocaleString()}/mo intl.
                </span>
              </span>
            </div>
          </button>
        ))}

        {/* Static User License Pricing tile */}
        <UserLicenseTile onClick={() => setShowUserLicensing(true)} />
      </div>

      {/* Standard add-on edit drawer */}
      {selected && (
        <AddonEditDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected(null)}
        />
      )}

      {/* User License Pricing drawer */}
      {showUserLicensing && (
        <UserLicensePricingDrawer onClose={() => setShowUserLicensing(false)} />
      )}
    </div>
  );
}
