import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, Save } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';

export default function PaidAddonsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: rows = [], isPending } = useQuery({
    queryKey: ['paid-addons'],
    queryFn: () => api.get('/paid-addons').then((r) => r.data),
  });

  const [edit, setEdit] = useState(null);

  useEffect(() => {
    if (rows.length && !edit) {
      const r = rows.find((x) => x.code === 'qr_ordering') || rows[0];
      setEdit({ ...r });
    }
  }, [rows, edit]);

  const saveMut = useMutation({
    mutationFn: () => api.put(`/paid-addons/${edit.code}`, edit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paid-addons'] });
      toast.success('Saved');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  if (isPending || !edit) {
    return (
      <div className="flex justify-center py-20">
        <Loader className="animate-spin w-8 h-8 text-amber-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paid add-ons</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configure optional features merchants can subscribe to (priced by their plan billing cycle: monthly vs yearly).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700">Code</label>
        <input className="w-full border rounded-lg px-3 py-2 bg-gray-50" value={edit.code} disabled />

        <label className="block text-sm font-medium text-gray-700">Display name</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
        />

        <label className="block text-sm font-medium text-gray-700">Short description</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm"
          rows={2}
          value={edit.shortDescription}
          onChange={(e) => setEdit({ ...edit, shortDescription: e.target.value })}
        />

        <label className="block text-sm font-medium text-gray-700">Long description (shown in purchase modal)</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm"
          rows={5}
          value={edit.longDescription}
          onChange={(e) => setEdit({ ...edit, longDescription: e.target.value })}
        />

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Monthly plan add-on</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2"
              value={edit.monthlyAmount}
              onChange={(e) => setEdit({ ...edit, monthlyAmount: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Yearly plan add-on</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2"
              value={edit.yearlyAmount}
              onChange={(e) => setEdit({ ...edit, yearlyAmount: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-xs text-gray-500 mt-1">If 0, yearly = monthly × 12</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={edit.currency}
              onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })}
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

        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50"
        >
          {saveMut.isPending ? <Loader className="animate-spin w-4 h-4" /> : <Save size={16} />}
          Save
        </button>
      </div>
    </div>
  );
}
