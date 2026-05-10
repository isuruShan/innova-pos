import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, Users, ChefHat, ShoppingCart, Eye, EyeOff,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_LINKS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { StaffListSkeleton } from '../../components/StoreSkeletons';

const ROLE_CONFIG = {
  cashier: {
    label: 'Cashier',
    icon: ShoppingCart,
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
  kitchen: {
    label: 'Kitchen',
    icon: ChefHat,
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/25',
    dot: 'bg-green-400',
  },
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'cashier' };

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = {
  cashier: 'bg-amber-500',
  kitchen: 'bg-green-500',
};

function UserAvatar({ name, role, size = 'md' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs';
  return (
    <div className={`${AVATAR_COLORS[role] || 'bg-slate-600'} ${sz} rounded-full flex items-center justify-center font-bold text-[var(--pos-text-primary)] flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

function UserCard({ user, onEdit, onDelete }) {
  const cfg = ROLE_CONFIG[user.role];
  const Icon = cfg?.icon || Users;
  return (
    <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
      <UserAvatar name={user.name} role={user.role} size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-[var(--pos-text-primary)] font-semibold text-sm truncate">{user.name}</p>
        <p className="text-slate-500 text-xs truncate">{user.email}</p>
        <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
          <Icon size={10} />
          {cfg?.label}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(user)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition">
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(user)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const qc = useQueryClient();

  const { data: users = [], isPending } = useQuery({
    queryKey: ['staff-users', selectedStoreId],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isStoreReady,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff-users'] });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setShowPw(false); setSlideOpen(true); };
  const openEdit = (user) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setFormError('');
    setShowPw(false);
    setSlideOpen(true);
  };
  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.email.trim()) return setFormError('Email is required');
    if (!editing && (!form.password || form.password.length < 6))
      return setFormError('Password must be at least 6 characters');
    if (editing && form.password && form.password.length < 6)
      return setFormError('Password must be at least 6 characters');

    const payload = { name: form.name, email: form.email, role: form.role };
    if (form.password) payload.password = form.password;

    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = (user) => {
    if (confirm(`Delete user "${user.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(user._id);
    }
  };

  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const cashierCount = users.filter(u => u.role === 'cashier').length;
  const kitchenCount = users.filter(u => u.role === 'kitchen').length;

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar links={MANAGER_LINKS} />

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              <Users size={22} className="text-blue-400" />
              Staff Users
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {cashierCount} cashier{cashierCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                {kitchenCount} kitchen
              </span>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm">
            <Plus size={16} />
            Add User
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'all', label: 'All' },
            { key: 'cashier', label: 'Cashiers' },
            { key: 'kitchen', label: 'Kitchen' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterRole(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                filterRole === f.key
                  ? 'bg-amber-500 text-[var(--pos-selection-text)]'
                  : 'text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {!isStoreReady || isPending ? (
          <StaffListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Users size={52} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-semibold">No users found</p>
            <p className="text-sm mt-1 opacity-60">Add your first staff member to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => (
              <UserCard key={user._id} user={user} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit User' : 'Add Staff User'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['cashier', 'kitchen']).map(role => {
                const cfg = ROLE_CONFIG[role];
                const Icon = cfg.icon;
                return (
                  <button key={role} type="button" onClick={() => setForm(f => ({ ...f, role }))}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-semibold transition ${
                      form.role === role
                        ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                        : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <Icon size={16} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Sarah Smith" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
            <input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="e.g. sarah@burgerjoint.com" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {editing ? 'New Password (leave blank to keep current)' : 'Password *'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? 'Leave blank to keep current' : 'Min 6 characters'}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeSlide}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {isPending ? 'Saving…' : (editing ? 'Save Changes' : 'Add User')}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
