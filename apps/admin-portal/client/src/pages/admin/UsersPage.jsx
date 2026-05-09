import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader, UserCheck, UserX, RefreshCw, Key, Trash2, X } from 'lucide-react';
import api from '../../api/axios';

const ROLE_COLORS = {
  merchant_admin: 'bg-purple-100 text-purple-700',
  manager:        'bg-blue-100 text-blue-700',
  cashier:        'bg-green-100 text-green-700',
  kitchen:        'bg-orange-100 text-orange-700',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'cashier' });
  const [errors, setErrors] = useState({});

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const { data } = await api.get('/users'); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setForm({ name: '', email: '', role: 'cashier' });
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Failed to create user' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetMutation = useMutation({
    mutationFn: (id) => api.post(`/users/${id}/reset-password`),
    onSuccess: () => alert('Password reset email sent'),
  });

  const validateAndSubmit = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name required';
    if (!form.email.trim()) e.email = 'Email required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.role) e.role = 'Role required';
    if (Object.keys(e).length) { setErrors(e); return; }
    createMutation.mutate(form);
  };

  const adminCount = users?.filter(u => u.role === 'merchant_admin' && u.isActive).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your staff and admin accounts</p>
        </div>
        <button onClick={() => { setShowModal(true); setErrors({}); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover"
        >
          <Plus size={15} />
          Add user
        </button>
      </div>

      {adminCount >= 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          You have reached the maximum of 2 admin users. You can still add staff (managers, cashiers, kitchen).
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading users...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users?.map(u => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.isActive ? 'bg-brand-brown-deep' : 'bg-gray-400'}`}>
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleMutation.mutate({ id: u._id, isActive: !u.isActive })}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                        {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button onClick={() => resetMutation.mutate(u._id)} title="Reset password"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                        <Key size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users?.length && (
            <div className="text-center py-12 text-gray-400">No users found</div>
          )}
        </div>
      )}

      {/* Add user modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Add new user</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Full name', key: 'name', placeholder: 'John Silva' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'john@yourbusiness.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} placeholder={f.placeholder}
                    onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setErrors(e2 => ({ ...e2, [f.key]: '' })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors[f.key] ? 'border-red-400' : 'border-gray-300'}`} />
                  {errors[f.key] && <p className="text-xs text-red-500 mt-0.5">{errors[f.key]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="kitchen">Kitchen</option>
                  {adminCount < 2 && <option value="merchant_admin">Admin</option>}
                </select>
              </div>

              {errors.api && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{errors.api}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={validateAndSubmit} disabled={createMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
              >
                {createMutation.isPending ? <Loader size={14} className="animate-spin" /> : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
