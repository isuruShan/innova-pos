import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, Save, X, Upload, Sparkles, Trash2, Users } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import SideDrawer from '../../components/common/SideDrawer';

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
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type. Please select an image.');
      e.target.value = '';
      return;
    }
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
   Role labels (matching UserLicensePricingPage)
───────────────────────────────────────────── */
const ROLE_LABELS = {
  merchant_admin: 'Merchant Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
  steward: 'Steward',
};

const ROLES_ORDER = ['merchant_admin', 'manager', 'cashier', 'kitchen', 'steward'];

/* ─────────────────────────────────────────────
   Single role pricing row inside the drawer
───────────────────────────────────────────── */
function RolePricingRow({ row, onSaved }) {
  const toast = useToast();
  const [edit, setEdit] = useState({ ...row });

  const saveMut = useMutation({
    mutationFn: () => api.put(`/user-licensing/pricing/${edit.role}`, edit),
    onSuccess: () => {
      toast.success(`${ROLE_LABELS[edit.role] || edit.role} pricing saved`);
      onSaved?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const num = (key, val) =>
    setEdit((p) => ({ ...p, [key]: val === '' ? 0 : Number(val) }));

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/80 space-y-4">
      {/* Role title */}
      <h3 className="text-sm font-semibold text-gray-900">
        {ROLE_LABELS[row.role] || row.role}
        <span className="ml-2 text-xs font-normal font-mono text-gray-400">{row.role}</span>
      </h3>

      {/* Local (LKR) */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Local pricing (LKR / month)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Per user seat</label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={edit.userSeatMonthlyAmount}
              onChange={(e) => num('userSeatMonthlyAmount', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Per extra store</label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={edit.extraStoreMonthlyAmount}
              onChange={(e) => num('extraStoreMonthlyAmount', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* International (USD) */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
        <p className="text-xs font-medium text-blue-900">International pricing (USD / month)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Per user seat</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={edit.internationalUserSeatMonthlyAmount}
              onChange={(e) => num('internationalUserSeatMonthlyAmount', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Per extra store</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={edit.internationalExtraStoreMonthlyAmount}
              onChange={(e) => num('internationalExtraStoreMonthlyAmount', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-orange text-white text-xs font-semibold disabled:opacity-60"
        >
          {saveMut.isPending ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   User License Pricing side drawer
───────────────────────────────────────────── */
function UserLicensePricingDrawer({ open, onClose }) {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['user-license-pricing'],
    queryFn: () => api.get('/user-licensing/pricing').then((r) => r.data),
    enabled: open,
  });

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="User License Pricing"
      subtitle="Monthly rates charged per additional user seat or extra store assignment"
      width="max-w-lg"
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader className="animate-spin w-6 h-6 text-gray-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Info note */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs text-amber-800 leading-relaxed">
              Merchants are charged prorated amounts for their remaining billing period when they add users or assign extra stores.
            </p>
          </div>

          {/* Role rows */}
          {ROLES_ORDER.map((role) => {
            const row = rows.find((r) => r.role === role);
            if (!row) return null;
            return (
              <RolePricingRow
                key={role}
                row={row}
                onSaved={() => qc.invalidateQueries({ queryKey: ['user-license-pricing'] })}
              />
            );
          })}
        </div>
      )}
    </SideDrawer>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function PaidAddonsPage() {
  const [selected, setSelected] = useState(null);
  const [userLicenseOpen, setUserLicenseOpen] = useState(false);

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

        {/* User License Pricing — static tile */}
        <button
          type="button"
          onClick={() => setUserLicenseOpen(true)}
          className="text-left bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Users size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900">User License Pricing</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">user-licensing</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            Per-role monthly pricing for additional user seats and extra store assignments.
          </p>
          <div className="flex items-center justify-between text-xs mt-auto pt-1">
            <span className="text-green-700 font-medium">Active</span>
            <span className="text-gray-500">{ROLES_ORDER.length} roles</span>
          </div>
        </button>
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
      <UserLicensePricingDrawer
        open={userLicenseOpen}
        onClose={() => setUserLicenseOpen(false)}
      />
    </div>
  );
}
