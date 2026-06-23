import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save, ToggleLeft, ToggleRight, Settings as SettingsIcon,
  Percent, Hash, Users, Plus, Edit2, Trash2,
  ChefHat, ShoppingCart, Eye, EyeOff, LayoutGrid,
  Monitor, Smartphone,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { AvatarDisplay } from '../../components/ProfileSlideOver';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
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

  const { data: partners = [] } = useQuery({
    queryKey: ['foodmarket-partners'],
    queryFn: () => api.get('/foodmarket-partners').then((r) => r.data),
    enabled: isStoreReady,
  });

  const activePartners = useMemo(() => partners.filter((p) => p.isActive), [partners]);

  const filteredOrderTypeRows = useMemo(() => {
    return ORDER_TYPE_ROWS.filter((row) => {
      if (row.key === 'dine-in' || row.key === 'takeaway') return true;
      if (row.key === 'uber-eats') {
        return activePartners.some(p => p.name?.toLowerCase().includes('uber'));
      }
      if (row.key === 'pickme') {
        return activePartners.some(p => p.name?.toLowerCase().includes('pickme') || p.name?.toLowerCase().includes('pick me'));
      }
      return false;
    });
  }, [activePartners]);

  useEffect(() => {
    if (!settings) return;
    const init = {};
    ORDER_TYPE_ROWS.forEach(({ key }) => {
      const saved = settings.orderTypes?.[key] || {};
      // Derive flat taxRate from taxComponents array (sum of all component rates)
      const derivedTaxRate = (saved.taxComponents || []).reduce((sum, tc) => sum + (tc.rate || 0), 0);
      init[key] = { ...DEFAULT_OT, ...saved, taxRate: derivedTaxRate };
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
    setLocal(prev => {
      const nextObj = { ...prev[key], [field]: value };
      if (field === 'taxRate') {
        const rateVal = parseFloat(value) || 0;
        if (rateVal === 0) {
          nextObj.taxComponents = [];
        } else {
          nextObj.taxComponents = [{ name: 'Tax', rate: rateVal, isCompound: false }];
        }
      }
      return { ...prev, [key]: nextObj };
    });

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

        {filteredOrderTypeRows.map(({ key, label, icon }, i) => {
          const cfg = local[key];
          if (!cfg) return null;
          const isFixed = cfg.serviceFeeType === 'fixed';
          return (
            <div
              key={key}
              className={`grid grid-cols-[1fr_60px_110px_160px] gap-3 items-center px-4 py-3 ${
                i < filteredOrderTypeRows.length - 1 ? 'border-b border-slate-700/30' : ''
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
  const updateMutation = useMutation({ mutationFn: ({ id, d }) => api.put(`/users/${id}`, d), onSuccess: () => { invalidate(); closeSlide(); }, onError: (e) => setFormError(e.response?.data?.message || 'Failed') });
  const deleteMutation = useMutation({ mutationFn: (id) => api.delete(`/users/${id}`), onSuccess: invalidate });

  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setFormError(''); setShowPw(false); setSlideOpen(true); };
  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.email.trim()) return setFormError('Email is required');
    if (form.password && form.password.length < 6) return setFormError('Password must be at least 6 characters');
    const payload = { name: form.name, email: form.email, role: form.role };
    if (form.password) payload.password = form.password;
    if (editing) updateMutation.mutate({ id: editing._id, d: payload });
  };

  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);
  const savePending = updateMutation.isPending;
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
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
        {[{ key: 'all', label: 'All' }, { key: 'cashier', label: 'Cashiers' }, { key: 'kitchen', label: 'Kitchen' }].map(f => (
          <button key={f.key} onClick={() => setFilterRole(f.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition ${
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

      <SlideOver open={slideOpen} onClose={closeSlide} title="Edit User">
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
              New Password (leave blank to keep)
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
              {savePending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}

// ─── Guest QR tab (waiter call cooldown for public ordering app) ─────────────

function GuestQrTab() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const store = stores.find((s) => String(s._id) === String(selectedStoreId));
  const [sec, setSec] = useState('300');

  useEffect(() => {
    if (store?.guestWaiterCallCooldownSeconds != null) {
      setSec(String(store.guestWaiterCallCooldownSeconds));
    }
  }, [store?._id, store?.guestWaiterCallCooldownSeconds]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/stores/${selectedStoreId}`, {
        guestWaiterCallCooldownSeconds: Math.min(3600, Math.max(30, parseInt(sec, 10) || 300)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-stores'] });
    },
  });

  if (!isStoreReady) {
    return <p className="text-sm text-amber-300">Select a store in the header first.</p>;
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-slate-400">
        Controls how long guests must wait between &quot;Call waiter&quot; taps in the public QR ordering app (default 5 minutes).
      </p>
      <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 space-y-3">
        <label className="block text-xs text-slate-400">Cooldown (seconds)</label>
        <input
          type="number"
          min={30}
          max={3600}
          className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
          value={sec}
          onChange={(e) => setSec(e.target.value)}
        />
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-[var(--pos-selection-text)] text-sm font-semibold disabled:opacity-50"
        >
          <Save size={14} /> Save
        </button>
      </div>
    </div>
  );
}

// ─── POS View Layout tab ──────────────────────────────────────────────────────

const LAYOUT_OPTIONS = [
  {
    id: 'default',
    label: 'Standard',
    description: 'Larger cards, wider cart panel',
    preview: (
      <div className="flex gap-1 w-full h-14 rounded overflow-hidden border border-slate-600">
        <div className="flex-1 grid grid-cols-3 gap-0.5 p-1">
          {[0,1,2,3,4,5].map(i => <div key={i} className="rounded bg-slate-600" />)}
        </div>
        <div className="w-9 bg-slate-700 rounded-r" />
      </div>
    ),
  },
  {
    id: 'compact',
    label: 'Compact Grid',
    description: 'Small squares, 1/3 cart with images',
    preview: (
      <div className="flex gap-1 w-full h-14 rounded overflow-hidden border border-slate-600">
        <div className="flex-[2] grid grid-cols-4 gap-0.5 p-1">
          {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="rounded bg-slate-600" />)}
        </div>
        <div className="flex-1 bg-slate-700 rounded-r" />
      </div>
    ),
  },
];

function PosViewTab() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const store = stores.find((s) => String(s._id) === String(selectedStoreId));
  const [layout, setLayout] = useState(store?.posMenuLayout || 'default');
  const [menuCols, setMenuCols] = useState(store?.posMenuCols || 4);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLayout(store?.posMenuLayout || 'default');
    setMenuCols(store?.posMenuCols || 4);
    setNotes(store?.cashDenominations || []);
  }, [store?._id, store?.posMenuLayout, store?.posMenuCols, store?.cashDenominations]);

  const saveMutation = useMutation({
    mutationFn: ({ layoutVal, colsVal, notesVal }) =>
      api.put(`/stores/${selectedStoreId}`, {
        posMenuLayout: layoutVal,
        posMenuCols: colsVal,
        cashDenominations: notesVal && notesVal.length > 0 ? notesVal : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-stores'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleAddNote = () => {
    const val = parseFloat(newNote);
    if (!isNaN(val) && val > 0 && !notes.includes(val)) {
      const next = [...notes, val].sort((a, b) => b - a);
      setNotes(next);
      setNewNote('');
    }
  };

  const handleRemoveNote = (val) => {
    setNotes(notes.filter((n) => n !== val));
  };

  const handleResetToDefault = () => {
    setNotes([]);
  };

  if (!isStoreReady) {
    return <p className="text-sm text-amber-300">Select a store in the header first.</p>;
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <p className="text-sm text-slate-400 mb-3">Choose how the POS cashier screen displays menu items.</p>
        <div className="grid grid-cols-2 gap-3">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLayout(opt.id)}
              className={`text-left rounded-2xl border-2 p-3 transition ${
                layout === opt.id
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-700 bg-[var(--pos-panel)] hover:border-slate-500'
              }`}
            >
              {opt.preview}
              <p className={`mt-2 text-sm font-semibold ${
                layout === opt.id ? 'text-amber-400' : 'text-[var(--pos-text-primary)]'
              }`}>{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-5 mt-5">
        <h3 className="text-sm font-semibold text-[var(--pos-text-primary)] mb-1">
          Cards Per Row
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Choose how many menu items are displayed in a single row on the cashier grid layout (4, 5, or 6 columns).
        </p>

        <div className="flex gap-2">
          {[4, 5, 6].map((cols) => (
            <button
              key={cols}
              type="button"
              onClick={() => setMenuCols(cols)}
              className={`flex-1 py-3 px-4 rounded-xl border font-semibold text-sm text-center transition ${
                menuCols === cols
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-slate-700 bg-[var(--pos-panel)] text-[var(--pos-text-secondary)] hover:border-slate-500'
              }`}
            >
              {cols} Columns
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-5 mt-5">
        <h3 className="text-sm font-semibold text-[var(--pos-text-primary)] mb-1">
          Touch Cash Notes
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Configure custom cash notes for the payment screen. Sri Lankan merchants default to LKR notes (5000, 2000, 1000, 500, 200, 100, 50, 20) if left empty/default.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {notes.length === 0 ? (
            <span className="text-xs text-slate-500 italic py-1.5">Using default notes for store currency/region</span>
          ) : (
            notes.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
              >
                {val}
                <button
                  type="button"
                  onClick={() => handleRemoveNote(val)}
                  className="text-slate-500 hover:text-red-400 font-bold transition ml-0.5 focus:outline-none"
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 50"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="flex-1 max-w-[150px] bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600"
          />
          <button
            type="button"
            onClick={handleAddNote}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition"
          >
            Add Note
          </button>
          {notes.length > 0 && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition ml-auto"
            >
              Reset to default
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => saveMutation.mutate({ layoutVal: layout, colsVal: menuCols, notesVal: notes })}
        disabled={saveMutation.isPending}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition mt-5 ${
          saved ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-60'
        }`}
      >
        <Save size={14} />
        {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Layout & Cash Notes'}
      </button>
    </div>
  );
}

// ─── Settings shell with tabs ─────────────────────────────────────────────

const TABS = [
  { id: 'charges', label: 'Order Charges', icon: SettingsIcon },
  { id: 'posview', label: 'POS View',       icon: LayoutGrid },
  { id: 'guestqr', label: 'QR Ordering',   icon: ShoppingCart },
  { id: 'checkin', label: 'Customer Screen', icon: Monitor },
  { id: 'users',   label: 'Staff Users',   icon: Users },
  { id: 'payments', label: 'Store Payments', icon: Hash },
];

function CustomerScreenTab() {
  const qc = useQueryClient();
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [smsAllowed, setSmsAllowed] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: tenantSettings, isPending } = useQuery({
    queryKey: ['tenant-settings-page'],
    queryFn: () => api.get('/tenant-settings').then(r => r.data),
  });

  useEffect(() => {
    if (tenantSettings) {
      setOtpEnabled(Boolean(tenantSettings.customerOtpVerificationEnabled));
      setSmsAllowed(Boolean(tenantSettings.smsGatewayAllowed));
    }
  }, [tenantSettings]);

  const saveMutation = useMutation({
    mutationFn: (val) => api.put('/tenant-settings', { customerOtpVerificationEnabled: val }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings-page'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isPending) return <div className="text-sm text-slate-500">Loading settings...</div>;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-slate-400">
        Configure customer terminal display and login/registration behavior.
      </p>
      
      <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-[var(--pos-text-primary)]">SMS OTP Verification</h4>
            <p className="text-xs text-slate-500 mt-1">
              Require customers checking in on screen or mobile to verify their mobile number with a one-time passcode.
            </p>
          </div>
          <button 
            type="button"
            disabled={!smsAllowed || saveMutation.isPending}
            onClick={() => {
              const next = !otpEnabled;
              setOtpEnabled(next);
              saveMutation.mutate(next);
            }}
            className="cursor-pointer disabled:opacity-40"
          >
            {otpEnabled ? (
              <ToggleRight size={32} className="text-amber-500" />
            ) : (
              <ToggleLeft size={32} className="text-slate-600" />
            )}
          </button>
        </div>

        {!smsAllowed && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-xl text-xs">
            ⚠️ SMS OTP Verification is disabled by default for your region. Contact support or super admin to enable SMS gateway access.
          </div>
        )}
      </div>

      {saved && (
        <p className="text-xs text-green-400 text-center font-medium mt-2">Settings saved successfully!</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const getActiveTab = () => {
    if (location.pathname.endsWith('/posview')) return 'posview';
    if (location.pathname.endsWith('/guestqr')) return 'guestqr';
    if (location.pathname.endsWith('/checkin')) return 'checkin';
    if (location.pathname.endsWith('/users')) return 'users';
    if (location.pathname.endsWith('/payments')) return 'payments';
    return 'charges';
  };
  const tab = getActiveTab();
  const setTab = (t) => navigate(`/manager/settings/${t}`);

  useEffect(() => {
    if (location.pathname === '/manager/settings' || location.pathname === '/manager/settings/') {
      navigate('/manager/settings/charges', { replace: true });
    }
  }, [location.pathname, navigate]);

  const { user } = useAuth();
  const visibleTabs = TABS.filter((t) => t.id !== 'users' || user?.role === 'merchant_admin');

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-xl font-bold text-[var(--pos-text-primary)] mb-5">Settings</h1>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-1 mb-6 overflow-x-auto no-scrollbar">
          {visibleTabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
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

        {tab === 'charges' ? <ChargesTab /> : tab === 'posview' ? <PosViewTab /> : tab === 'guestqr' ? <GuestQrTab /> : tab === 'checkin' ? <CustomerScreenTab /> : tab === 'users' && user?.role === 'merchant_admin' ? <UsersTab /> : tab === 'payments' ? <PaymentMethodsTab /> : <ChargesTab />}
      </div>
    </div>
  );
}
