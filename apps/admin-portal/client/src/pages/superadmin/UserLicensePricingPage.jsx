import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, Save } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';

const ROLE_LABELS = {
  merchant_admin: 'Merchant admin',
  manager: 'Manager',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
};

function PricingRow({ row, onSaved }) {
  const toast = useToast();
  const [edit, setEdit] = useState({ ...row });

  const saveMut = useMutation({
    mutationFn: () => api.put(`/user-licensing/pricing/${edit.role}`, edit),
    onSuccess: () => {
      toast.success('Pricing saved');
      onSaved?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const num = (key, val) => setEdit((p) => ({ ...p, [key]: val === '' ? 0 : Number(val) }));

  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 font-medium capitalize">{ROLE_LABELS[row.role] || row.role}</td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.userSeatMonthlyAmount}
          onChange={(e) => num('userSeatMonthlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.userSeatYearlyAmount}
          onChange={(e) => num('userSeatYearlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.extraStoreMonthlyAmount}
          onChange={(e) => num('extraStoreMonthlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.extraStoreYearlyAmount}
          onChange={(e) => num('extraStoreYearlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.internationalUserSeatMonthlyAmount}
          onChange={(e) => num('internationalUserSeatMonthlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.internationalUserSeatYearlyAmount}
          onChange={(e) => num('internationalUserSeatYearlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.internationalExtraStoreMonthlyAmount}
          onChange={(e) => num('internationalExtraStoreMonthlyAmount', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm"
          value={edit.internationalExtraStoreYearlyAmount}
          onChange={(e) => num('internationalExtraStoreYearlyAmount', e.target.value)} />
      </td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-orange text-white text-xs font-semibold disabled:opacity-60"
        >
          {saveMut.isPending ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </td>
    </tr>
  );
}

export default function UserLicensePricingPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['user-license-pricing'],
    queryFn: () => api.get('/user-licensing/pricing').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">User license pricing</h2>
        <p className="text-sm text-gray-500 mt-1">
          Per-role prices for additional user seats and extra store assignments. Merchants pay prorated amounts for their billing period.
        </p>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-2 py-3">Seat / mo (LKR)</th>
                <th className="text-left px-2 py-3">Seat / yr</th>
                <th className="text-left px-2 py-3">Store / mo</th>
                <th className="text-left px-2 py-3">Store / yr</th>
                <th className="text-left px-2 py-3">Seat / mo (USD)</th>
                <th className="text-left px-2 py-3">Seat / yr</th>
                <th className="text-left px-2 py-3">Store / mo</th>
                <th className="text-left px-2 py-3">Store / yr</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PricingRow
                  key={row.role}
                  row={row}
                  onSaved={() => qc.invalidateQueries({ queryKey: ['user-license-pricing'] })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
