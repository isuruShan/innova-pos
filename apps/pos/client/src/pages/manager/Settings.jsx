import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save, ToggleLeft, ToggleRight, Settings as SettingsIcon,
  Percent, Hash, Users, Plus, Edit2, Trash2,
  ChefHat, ShoppingCart, Eye, EyeOff,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { AvatarDisplay } from '../../components/ProfileSlideOver';
import { useStoreContext } from '../../context/StoreContext';
import { SettingsChargesSkeleton, StaffListSkeleton } from '../../components/StoreSkeletons';

// ─── Order-charges tab ────────────────────────────────────────────────────────

const ORDER_TYPE_ROWS = [
  { key: 'dine-in',   label: 'Dine-In',  icon: '🪑' },
  { key: 'takeaway',  label: 'Take Away', icon: '🥡' },
  { key: 'uber-eats', label: 'Uber Eats', icon: '🛵' },
  { key: 'pickme',    label: 'PickMe',    icon: '🏍️' },
];
const DEFAULT_OT = { enabled: true, taxRate: 0, serviceFeeType: 'percentage', serviceFeeRate: 0, serviceFeeFixed: 0 };

function ChargesTab() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [local, setLocal] = useState(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isPending } = useQuery({
    queryKey: ['settings', selectedStoreId],
    queryFn: () => api.get('/settings').then(r => r.data),
    enabled: isStoreReady,
  });

  useEffect(() => {
    if (!settings) return;
    const init = {};
    ORDER_TYPE_ROWS.forEach(({ key }) => {
      init[key] = { ...DEFAULT_OT, ...(settings.orderTypes?.[key] || {}) };
    });
    setLocal(init);
  }, [settings, selectedStoreId]);

  const saveMutation = useMutation({
    mutationFn: (d) => api.put('/settings', { orderTypes: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const set = (key, field, value) =>
    setLocal(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  if (!isStoreReady || isPending || !local) return <SettingsChargesSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Set tax and service fee per order type.</p>
        <button
          onClick={() => saveMutation.mutate(local)}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition ${
            saved ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-60'
          }`}
        >
          <Save size={13} />
          {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_110px_160px] gap-3 px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/30">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Order Type</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-center">On</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Tax %</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Service Fee</span>
        </div>

        {ORDER_TYPE_ROWS.map(({ key, label, icon }, i) => {
          const cfg = local[key];
          const isFixed = cfg.serviceFeeType === 'fixed';
          return (
            <div
              key={key}
              className={`grid grid-cols-[1fr_60px_110px_160px] gap-3 items-center px-4 py-3 ${
                i < ORDER_TYPE_ROWS.length - 1 ? 'border-b border-slate-700/30' : ''
              } ${!cfg.enabled ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{icon}</span>
                <span className="text-sm font-medium text-[var(--pos-text-primary)]">{label}</span>
              </div>

              <div className="flex justify-center">
                <button onClick={() => set(key, 'enabled', !cfg.enabled)}>
                  {cfg.enabled
                    ? <ToggleRight size={22} className="text-green-400" />
                    : <ToggleLeft size={22} className="text-slate-600" />}
                </button>
              </div>

              <div className="flex items-center gap-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-2 py-1.5 focus-within:border-amber-500">
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={cfg.taxRate}
                  disabled={!cfg.enabled}
                  onChange={e => set(key, 'taxRate', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-full bg-transparent text-[var(--pos-text-primary)] text-sm text-center focus:outline-none disabled:cursor-not-allowed"
                />
                <Percent size={11} className="text-slate-600 flex-shrink-0" />
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg overflow-hidden flex-shrink-0">
                  <button
                    disabled={!cfg.enabled}
                    onClick={() => set(key, 'serviceFeeType', 'percentage')}
                    className={`px-2 py-1 text-xs font-medium transition ${!isFixed ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-500 hover:text-white'} disabled:cursor-not-allowed`}
                  ><Percent size={11} /></button>
                  <button
                    disabled={!cfg.enabled}
                    onClick={() => set(key, 'serviceFeeType', 'fixed')}
                    className={`px-2 py-1 text-xs font-medium transition ${isFixed ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-500 hover:text-white'} disabled:cursor-not-allowed`}
                  ><Hash size={11} /></button>
                </div>
                <div className="flex-1 flex items-center gap-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-2 py-1.5 focus-within:border-amber-500 min-w-0">
                  {isFixed && <span className="text-slate-500 text-xs flex-shrink-0">Rs</span>}
                  <input
                    type="number" min="0" step={isFixed ? '1' : '0.1'} max={isFixed ? undefined : '100'}
                    disabled={!cfg.enabled}
                    value={isFixed ? cfg.serviceFeeFixed : cfg.serviceFeeRate}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      set(key, isFixed ? 'serviceFeeFixed' : 'serviceFeeRate',
                        isFixed ? Math.max(0, v) : Math.max(0, Math.min(100, v)));
                    }}
                    className="w-full bg-transparent text-[var(--pos-text-primary)] text-sm text-center focus:outline-none disabled:cursor-not-allowed"
                  />
                  {!isFixed && <Percent size={11} className="text-slate-600 flex-shrink-0" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-700 text-center">Rates apply to new orders only.</p>
    </div>
  );
}

function PaymentMethodsTab() {
  const qc = useQueryClient();
  const { stores, selectedStoreId } = useStoreContext();
  const selectedStore = stores.find((s) => s._id === selectedStoreId) || null;
  const [methods, setMethods] = useState(() => selectedStore?.paymentMethods || ['cash']);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMethods(selectedStore?.paymentMethods?.length ? selectedStore.paymentMethods : ['cash']);
  }, [selectedStoreId, selectedStore?.paymentMethods]);

  const mutation = useMutation({
    mutationFn: (payload) => api.put(`/stores/${selectedStoreId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-stores'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    },
  });

  const toggle = (method) => {
    setMethods((prev) => {
      const has = prev.includes(method);
      const next = has ? prev.filter((m) => m !== method) : [...prev, method];
      if (!next.includes('cash')) next.unshift('cash');
      return [...new Set(next)];
    });
  };

  if (!selectedStore) return <div className="text-sm text-slate-500">No assigned store selected.</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Configure payment methods for <span className="text-[var(--pos-text-primary)] font-medium">{selectedStore.name}</span>.</p>
      <div className="grid grid-cols-2 gap-2">
        {['cash', 'card', 'bank_transfer', 'mobile_wallet'].map((method) => (
          <label key={method} className="flex items-center gap-2 bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={methods.includes(method)}
              onChange={() => toggle(method)}
              disabled={method === 'cash'}
            />
            <span className="capitalize">{method.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
      <button
        onClick={() => mutation.mutate({ paymentMethods: methods })}
        disabled={mutation.isPending}
        className={`px-4 py-2 rounded-xl text-sm font-semibold ${saved ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'}`}
      >
        {mutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save payment methods'}
      </button>
    </div>
  );
}

// ─── Staff-users tab ──────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  cashier: { label: 'Cashier', icon: ShoppingCart, bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
  kitchen: { label: 'Kitchen', icon: ChefHat,      bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/25' },
};
const AVATAR_COLORS = { cashier: 'bg-amber-500', kitchen: 'bg-green-500' };
const EMPTY_FORM = { name: '', email: '', password: '', role: 'cashier' };

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function UserAvatar({ user }) {
  // Reuse AvatarDisplay for profile image support; fall back to initials
  if (user.profileImage) return <AvatarDisplay user={user} size="md" />;
  return (
    <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[user.role] || 'bg-slate-600'} flex items-center justify-center font-bold text-[var(--pos-text-primary)] text-xs flex-shrink-0`}>
      {getInitials(user.name)}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [filterRole, setFilterRole] = useState('all');

  const { data: users = [], isPending: usersPending } = useQuery({
    queryKey: ['staff-users', selectedStoreId],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isStoreReady,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff-users'] });
  const createMutation = useMutation({ mutationFn: (d) => api.post('/users', d), onSuccess: () => { invalidate(); closeSlide(); }, onError: (e) => setFormError(e.response?.data?.message || 'Failed') });
  const updateMutation = useMutation({ mutationFn: ({ id, d }) => api.put(`/users/${id}`, d), onSuccess: () => { invalidate(); closeSlide(); }, onError: (e) => setFormError(e.response?.data?.message || 'Failed') });
  const deleteMutation = useMutation({ mutationFn: (id) => api.delete(`/users/${id}`), onSuccess: invalidate });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setShowPw(false); setSlideOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setFormError(''); setShowPw(false); setSlideOpen(true); };
  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.email.trim()) return setFormError('Email is required');
    if (!editing && (!form.password || form.password.length < 6)) return setFormError('Password must be at least 6 characters');
    if (editing && form.password && form.password.length < 6) return setFormError('Password must be at least 6 characters');
    const payload = { name: form.name, email: form.email, role: form.role };
    if (form.password) payload.password = form.password;
    if (editing) updateMutation.mutate({ id: editing._id, d: payload });
    else createMutation.mutate(payload);
  };

  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);
  const savePending = createMutation.isPending || updateMutation.isPending;
  const cashierCount = users.filter(u => u.role === 'cashier').length;
  const kitchenCount = users.filter(u => u.role === 'kitchen').length;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            {cashierCount} cashier{cashierCount !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
            {kitchenCount} kitchen
          </span>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2 rounded-xl transition text-sm">
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[{ key: 'all', label: 'All' }, { key: 'cashier', label: 'Cashiers' }, { key: 'kitchen', label: 'Kitchen' }].map(f => (
          <button key={f.key} onClick={() => setFilterRole(f.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filterRole === f.key ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
            }`}>{f.label}</button>
        ))}
      </div>

      {!isStoreReady || usersPending ? (
        <StaffListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const cfg = ROLE_CONFIG[user.role];
            const Icon = cfg?.icon || Users;
            return (
              <div key={user._id} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
                <UserAvatar user={user} />
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--pos-text-primary)] font-semibold text-sm truncate">{user.name}</p>
                  <p className="text-slate-500 text-xs truncate">{user.email}</p>
                </div>
                <span className={`hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg?.bg} ${cfg?.text} ${cfg?.border}`}>
                  <Icon size={10} />{cfg?.label}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition"><Edit2 size={13} /></button>
                  <button onClick={() => { if (confirm(`Delete "${user.name}"?`)) deleteMutation.mutate(user._id); }} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit User' : 'Add Staff User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {['cashier', 'kitchen'].map(role => {
                const cfg = ROLE_CONFIG[role];
                const Icon = cfg.icon;
                return (
                  <button key={role} type="button" onClick={() => setForm(f => ({ ...f, role }))}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-semibold transition ${
                      form.role === role ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <Icon size={16} />{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Sarah Smith" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="e.g. sarah@burgerjoint.com" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {editing ? 'New Password (leave blank to keep)' : 'Password *'}
            </label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? 'Leave blank to keep current' : 'Min 6 characters'}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{formError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeSlide}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">Cancel</button>
            <button type="submit" disabled={savePending}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {savePending ? 'Saving…' : editing ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}

// ─── Settings shell with tabs ─────────────────────────────────────────────────

const TABS = [
  { id: 'charges', label: 'Order Charges', icon: SettingsIcon },
  { id: 'users',   label: 'Staff Users',   icon: Users },
  { id: 'payments', label: 'Store Payments', icon: Hash },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('charges');

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-xl font-bold text-[var(--pos-text-primary)] mb-5">Settings</h1>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-1 mb-6 w-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow'
                    : 'text-slate-400 hover:text-[var(--pos-text-primary)]'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'charges' ? <ChargesTab /> : tab === 'users' ? <UsersTab /> : <PaymentMethodsTab />}
      </div>
    </div>
  );
}
