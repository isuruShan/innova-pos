import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContactRound, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';

const emptyForm = {
  name: '', mobile: '', email: '', birthday: '', notes: '',
  lifetimePoints: '0', pointsNote: '',
};

export default function CustomersAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: () =>
      api.get('/customers', { params: search.trim() ? { search: search.trim() } : {} }).then((r) => r.data),
  });

  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('No editor');
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
        ...(form.birthday ? { birthday: new Date(form.birthday).toISOString() } : { birthday: null }),
      };
      if (editor._id) {
        await api.put(`/customers/${editor._id}`, payload);
        const n = Number(form.lifetimePoints);
        if (!Number.isNaN(n) && n >= 0) {
          await api.post(`/customers/${editor._id}/points`, {
            lifetimePoints: n,
            note: form.pointsNote?.trim() || '',
          });
        }
      } else {
        await api.post('/customers', payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      qc.invalidateQueries({ queryKey: ['loyalty-retention-pending'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      setEditor(null);
      setForm(emptyForm);
    },
    onError: (err) => {
      window.alert(err.response?.data?.message || 'Save failed');
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  const openNew = () => {
    setEditor({});
    setForm(emptyForm);
  };

  const openEdit = (c) => {
    setEditor(c);
    setForm({
      name: c.name || '',
      mobile: c.mobile || '',
      email: c.email || '',
      birthday: c.birthday ? String(c.birthday).slice(0, 10) : '',
      notes: c.notes || '',
      lifetimePoints: String(c.lifetimePoints ?? 0),
      pointsNote: '',
    });
  };

  const submitProfile = (e) => {
    e.preventDefault();
    saveCustomer.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ContactRound className="text-brand-orange" size={26} />
          Customers
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Tenant-wide customer records shared across all stores. Add, edit, delete profiles, and adjust lifetime loyalty
          points from the edit screen.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, mobile…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-medium shrink-0"
        >
          <Plus size={16} /> Add customer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isPending ? (
          <p className="p-8 text-center text-gray-500 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">
            {search.trim() ? 'No customers match this search.' : 'No customers yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Points</th>
                  <th className="px-4 py-3 font-medium text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{row.name || '—'}</div>
                      <div className="text-xs text-gray-500">{row.email || row.mobile || '—'}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-900">{row.lifetimePoints ?? 0}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="text-brand-teal text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete customer "${row.name || row.email || 'this record'}"?`)) {
                            deleteCustomer.mutate(row._id);
                          }
                        }}
                        className="text-red-600 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          onClick={() => {
            setEditor(null);
            setForm(emptyForm);
          }}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editor._id ? 'Edit customer' : 'New customer'}
            </h3>
            <form onSubmit={submitProfile} className="space-y-3">
              {['name', 'mobile', 'email'].map((k) => (
                <label key={k} className="block text-xs text-gray-600 capitalize">
                  {k}
                  <input
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ))}
              <label className="block text-xs text-gray-600">
                Birthday
                <AdminDateField
                  value={form.birthday}
                  onChange={(v) => setForm((f) => ({ ...f, birthday: v }))}
                />
              </label>
              <label className="block text-xs text-gray-600">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </label>

              {editor._id && (
                <>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-2">Loyalty points</p>
                    <label className="block text-xs text-gray-600">
                      Lifetime points
                      <input
                        type="number"
                        min={0}
                        required
                        value={form.lifetimePoints}
                        onChange={(e) => setForm((f) => ({ ...f, lifetimePoints: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs text-gray-600 mt-2">
                      Note for this adjustment (optional)
                      <textarea
                        value={form.pointsNote}
                        onChange={(e) => setForm((f) => ({ ...f, pointsNote: e.target.value }))}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                        placeholder="Reason for adjustment"
                      />
                    </label>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Saving updates profile first, then applies this points total. Other merchant admins may receive a
                      notification.
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditor(null);
                    setForm(emptyForm);
                  }}
                  className="px-3 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveCustomer.isPending}
                  className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium disabled:opacity-50"
                >
                  {saveCustomer.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
