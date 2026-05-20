import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, Save, X, Upload, Sparkles, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm uppercase"
              value={edit.currency}
              onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })}
            />
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

export default function PaidAddonsPage() {
  const [selected, setSelected] = useState(null);

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
              <span className="font-semibold text-gray-900 tabular-nums">
                {row.currency} {Number(row.monthlyAmount || 0).toLocaleString()}/mo
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <AddonEditDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected(null)}
        />
      )}
    </div>
  );
}
