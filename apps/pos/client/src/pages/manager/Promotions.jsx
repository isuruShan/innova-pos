import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, Tag, ToggleRight, ToggleLeft,
  Gift, Package, Percent, Minus as MinusIcon, Hash,
  Search, X,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_LINKS } from '../../constants/managerLinks';
import { formatCurrency } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import { PromoListSkeleton } from '../../components/StoreSkeletons';
import PosDateField from '../../components/PosDateField';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMO_TYPES = [
  {
    id: 'bundle',
    label: 'Bundle Deal',
    icon: Package,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    desc: 'Set of items at a special combined price',
  },
  {
    id: 'buyXgetY',
    label: 'Buy X Get Y',
    icon: Gift,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/25',
    desc: 'Buy X qty of an item, get another item free',
  },
  {
    id: 'flatPrice',
    label: 'Flat Price',
    icon: Hash,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    desc: 'Specific items sold at a fixed price',
  },
  {
    id: 'flatDiscount',
    label: 'Flat Discount',
    icon: MinusIcon,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    desc: 'Fixed Rs amount off the order total',
  },
  {
    id: 'percentageDiscount',
    label: '% Discount',
    icon: Percent,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/25',
    desc: 'Percentage off the order or specific items',
  },
];

const EMPTY_FORM = {
  name: '', description: '', type: 'bundle',
  startDate: '', endDate: '', active: true,
  bundleItems: [],   bundlePrice: '',
  buyItem: '',       buyItemName: '', buyQty: '1',
  getFreeItem: '',   getFreeItemName: '', getFreeQty: '1',
  applicableItems: [], applicableItemNames: [], applicableCategories: [],
  flatPrice: '',  discountAmount: '', discountPercent: '',
  minOrderAmount: '',
};

function typeMeta(id) { return PROMO_TYPES.find(t => t.id === id) || PROMO_TYPES[0]; }

function isActive(promo) {
  const now = new Date();
  return promo.active && new Date(promo.startDate) <= now && new Date(promo.endDate) >= now;
}

function PromoTypeBadge({ type }) {
  const m = typeMeta(type);
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${m.bg} ${m.color} ${m.border}`}>
      <Icon size={10} />{m.label}
    </span>
  );
}

function StatusDot({ promo }) {
  const active = isActive(promo);
  const now = new Date();
  const future = new Date(promo.startDate) > now;
  if (!promo.active) return <span className="text-xs text-slate-600 font-medium">Disabled</span>;
  if (future)        return <span className="text-xs text-amber-400 font-medium">Upcoming</span>;
  if (active)        return <span className="flex items-center gap-1 text-xs text-green-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />Active</span>;
  return <span className="text-xs text-slate-500 font-medium">Expired</span>;
}

// ─── Bundle item builder ───────────────────────────────────────────────────────
function BundleItemsField({ bundleItems, onChange, menuItems }) {
  const add = () => onChange([...bundleItems, { menuItem: '', name: '', qty: 1 }]);

  const updateItem = (i, patch) =>
    onChange(bundleItems.map((b, idx) => idx === i ? { ...b, ...patch } : b));

  const remove = (i) => onChange(bundleItems.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {bundleItems.map((bi, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={bi.menuItem}
            onChange={e => {
              const item = menuItems.find(m => m._id === e.target.value);
              // Single atomic update — avoids stale-closure overwrite bug
              updateItem(i, { menuItem: e.target.value, name: item?.name || '' });
            }}
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select item…</option>
            {menuItems.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
          <input
            type="number" min="1" value={bi.qty}
            onChange={e => updateItem(i, { qty: parseInt(e.target.value) || 1 })}
            className="w-16 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="button" onClick={() => remove(i)}
            className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition mt-1">
        <Plus size={13} /> Add item
      </button>
    </div>
  );
}

// ─── Applicable items: search-based combobox (by category AND/OR by product) ──
function ApplicableItemsField({
  itemIds, itemNames, categoryNames,
  onChange,   // (itemIds, itemNames, categoryNames) => void
  menuItems,
  categories,
  required = false,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const q = search.trim().toLowerCase();
  const matchCats  = categories.filter(c => c.name.toLowerCase().includes(q));
  const matchItems = menuItems.filter(m => m.name.toLowerCase().includes(q));
  const showDrop   = open && q.length > 0 && (matchCats.length > 0 || matchItems.length > 0);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCategory = (name) => {
    const next = categoryNames.includes(name)
      ? categoryNames.filter(c => c !== name)
      : [...categoryNames, name];
    onChange(itemIds, itemNames, next);
    setSearch(''); setOpen(false);
  };

  const selectItem = (m) => {
    let nextIds, nextNames;
    if (itemIds.includes(m._id)) {
      nextIds   = itemIds.filter(id => id !== m._id);
      nextNames = itemNames.filter(n => n !== m.name);
    } else {
      nextIds   = [...itemIds,   m._id];
      nextNames = [...itemNames, m.name];
    }
    onChange(nextIds, nextNames, categoryNames);
    setSearch(''); setOpen(false);
  };

  const removeCategory = (name) => onChange(itemIds, itemNames, categoryNames.filter(c => c !== name));
  const removeItem = (id, name) =>
    onChange(itemIds.filter(i => i !== id), itemNames.filter(n => n !== name), categoryNames);

  const totalSelected = itemIds.length + categoryNames.length;

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Selected chips */}
      {totalSelected === 0 ? (
        <p className="text-xs text-slate-500">
          {required
            ? 'Search and select at least one product or category.'
            : 'Nothing selected → discount applies to the whole order.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {categoryNames.map(c => (
            <span key={c} className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs px-2.5 py-1 rounded-full">
              📁 {c}
              <button type="button" onClick={() => removeCategory(c)} className="ml-0.5 hover:text-[var(--pos-text-primary)] leading-none">×</button>
            </span>
          ))}
          {itemIds.map((id, i) => (
            <span key={id} className="flex items-center gap-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2.5 py-1 rounded-full">
              {itemNames[i]}
              <button type="button" onClick={() => removeItem(id, itemNames[i])} className="ml-0.5 hover:text-[var(--pos-text-primary)] leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 focus-within:border-amber-500 transition">
          <Search size={13} className="text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search categories or products…"
            className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
          />
          {search && (
            <button type="button" onMouseDown={() => { setSearch(''); setOpen(false); }}>
              <X size={13} className="text-slate-500 hover:text-[var(--pos-text-primary)]" />
            </button>
          )}
        </div>

        {showDrop && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[var(--pos-panel)] border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
            {matchCats.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-800/60 sticky top-0">Categories</div>
                {matchCats.map(c => (
                  <button key={c._id} type="button" onMouseDown={() => selectCategory(c.name)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-700/50 transition">
                    <span className="text-base leading-none">📁</span>
                    <span className={categoryNames.includes(c.name) ? 'text-amber-400 font-medium' : 'text-slate-300'}>{c.name}</span>
                    {categoryNames.includes(c.name) && <span className="ml-auto text-amber-400 text-xs">✓</span>}
                  </button>
                ))}
              </>
            )}
            {matchItems.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-800/60 sticky top-0">Products</div>
                {matchItems.map(m => (
                  <button key={m._id} type="button" onMouseDown={() => selectItem(m)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-700/50 transition">
                    <span className="text-base leading-none">🍔</span>
                    <span className={itemIds.includes(m._id) ? 'text-amber-400 font-medium' : 'text-slate-300'}>{m.name}</span>
                    {m.category && <span className="text-xs text-slate-600">{m.category}</span>}
                    {itemIds.includes(m._id) && <span className="ml-auto text-amber-400 text-xs">✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Promotions() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const { data: promotions = [], isPending: promosPending } = useQuery({
    queryKey: ['promotions', selectedStoreId],
    queryFn: () => api.get('/promotions').then(r => r.data),
    enabled: isStoreReady,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: isStoreReady,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active', selectedStoreId],
    queryFn: () => api.get('/categories', { params: { active: true } }).then(r => r.data),
    enabled: isStoreReady,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['promotions'] });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/promotions', d),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to create'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => api.put(`/promotions/${id}`, d),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to update'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/promotions/${id}`),
    onSuccess: invalidate,
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => api.put(`/promotions/${id}`, { active }),
    onSuccess: invalidate,
  });

  const field = (key) => ({ value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })) });

  const openAdd = () => {
    setEditing(null);
    const today = new Date().toISOString().split('T')[0];
    const next30 = new Date(); next30.setDate(next30.getDate() + 30);
    setForm({ ...EMPTY_FORM, startDate: today, endDate: next30.toISOString().split('T')[0] });
    setFormError('');
    setSlideOpen(true);
  };

  const openEdit = (promo) => {
    setEditing(promo);
    setForm({
      name: promo.name || '',
      description: promo.description || '',
      type: promo.type,
      startDate: promo.startDate?.split('T')[0] || '',
      endDate: promo.endDate?.split('T')[0] || '',
      active: promo.active ?? true,
      bundleItems: promo.bundleItems || [],
      bundlePrice: promo.bundlePrice ?? '',
      buyItem: promo.buyItem || '',
      buyItemName: promo.buyItemName || '',
      buyQty: promo.buyQty ?? 1,
      getFreeItem: promo.getFreeItem || '',
      getFreeItemName: promo.getFreeItemName || '',
      getFreeQty: promo.getFreeQty ?? 1,
      applicableItems: promo.applicableItems || [],
      applicableItemNames: promo.applicableItemNames || [],
      applicableCategories: promo.applicableCategories || [],
      flatPrice: promo.flatPrice ?? '',
      discountAmount: promo.discountAmount ?? '',
      discountPercent: promo.discountPercent ?? '',
      minOrderAmount: promo.minOrderAmount ?? '',
    });
    setFormError('');
    setSlideOpen(true);
  };

  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.startDate || !form.endDate) return setFormError('Date range is required');
    if (form.startDate > form.endDate) return setFormError('End date must be after start date');

    // Type-specific validation
    if (form.type === 'bundle') {
      if (!form.bundleItems.length || form.bundleItems.some(b => !b.menuItem)) return setFormError('Add at least one bundle item');
      if (form.bundlePrice === '' || isNaN(+form.bundlePrice)) return setFormError('Bundle price is required');
    }
    if (form.type === 'buyXgetY') {
      if (!form.buyItem || !form.getFreeItem) return setFormError('Select buy item and free item');
    }
    if (form.type === 'flatPrice') {
      if (!form.applicableItems.length) return setFormError('Select at least one item for flat price');
      if (form.flatPrice === '' || isNaN(+form.flatPrice)) return setFormError('Flat price is required');
    }
    if (form.type === 'flatDiscount') {
      if (form.discountAmount === '' || isNaN(+form.discountAmount)) return setFormError('Discount amount is required');
    }
    if (form.type === 'percentageDiscount') {
      if (form.discountPercent === '' || isNaN(+form.discountPercent)) return setFormError('Discount % is required');
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      active: form.active,
      bundleItems: form.bundleItems,
      bundlePrice: +form.bundlePrice || 0,
      buyItem: form.buyItem || null,
      buyItemName: form.buyItemName,
      buyQty: +form.buyQty || 1,
      getFreeItem: form.getFreeItem || null,
      getFreeItemName: form.getFreeItemName,
      getFreeQty: +form.getFreeQty || 1,
      applicableItems: form.applicableItems,
      applicableItemNames: form.applicableItemNames,
      applicableCategories: form.applicableCategories,
      flatPrice: +form.flatPrice || 0,
      discountAmount: +form.discountAmount || 0,
      discountPercent: +form.discountPercent || 0,
      minOrderAmount: +form.minOrderAmount || 0,
    };

    if (editing) updateMutation.mutate({ id: editing._id, d: payload });
    else createMutation.mutate(payload);
  };

  const savePending = createMutation.isPending || updateMutation.isPending;
  const activeCount = promotions.filter(isActive).length;

  const inputCls = "w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600";
  const labelCls = "block text-sm font-medium text-slate-300 mb-1.5";

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar links={MANAGER_LINKS} />

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              <Tag size={20} className="text-amber-400" />
              Promotions
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {activeCount} active &middot; {promotions.length} total
              <span className="block text-xs mt-1 opacity-80">
                Manager-created promotions require merchant approval before they apply at checkout.
              </span>
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm">
            <Plus size={15} /> New Promotion
          </button>
        </div>

        {/* Promotion type legend */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PROMO_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <span key={t.id} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${t.bg} ${t.color} ${t.border}`}>
                <Icon size={11} />{t.label}
              </span>
            );
          })}
        </div>

        {/* List */}
        {!isStoreReady || promosPending ? (
          <PromoListSkeleton />
        ) : promotions.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Tag size={44} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-semibold">No promotions yet</p>
            <p className="text-sm mt-1 opacity-60">Create your first promotion to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {promotions.map(promo => {
              const m = typeMeta(promo.type);
              const Icon = m.icon;
              return (
                <div key={promo._id}
                  className={`bg-[var(--pos-panel)] border rounded-2xl px-4 py-4 flex items-start gap-4 ${
                    isActive(promo) ? 'border-slate-700/50' : 'border-slate-800/50 opacity-60'
                  }`}>
                  <div className={`w-9 h-9 rounded-xl ${m.bg} border ${m.border} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={m.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[var(--pos-text-primary)] font-semibold text-sm">{promo.name}</p>
                      <PromoTypeBadge type={promo.type} />
                      <StatusDot promo={promo} />
                      {promo.approvalStatus && promo.approvalStatus !== 'approved' && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          promo.approvalStatus === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {promo.approvalStatus}
                        </span>
                      )}
                    </div>
                    {promo.description && (
                      <p className="text-slate-500 text-xs mt-0.5">{promo.description}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-1">
                      {new Date(promo.startDate).toLocaleDateString()} – {new Date(promo.endDate).toLocaleDateString()}
                    </p>
                    <PromoSummary promo={promo} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      disabled={promo.approvalStatus === 'pending'}
                      title={promo.approvalStatus === 'pending' ? 'Approve before enabling' : ''}
                      onClick={() => toggleMutation.mutate({ id: promo._id, active: !promo.active })}
                    >
                      {promo.active
                        ? <ToggleRight size={20} className="text-green-400" />
                        : <ToggleLeft size={20} className="text-slate-600" />}
                    </button>
                    <button onClick={() => openEdit(promo)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${promo.name}"?`)) deleteMutation.mutate(promo._id); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-over form */}
      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Promotion' : 'New Promotion'}>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Type selector */}
          <div>
            <label className={labelCls}>Promotion Type *</label>
            <div className="grid grid-cols-1 gap-2">
              {PROMO_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} type="button"
                    onClick={() => setForm(f => ({ ...f, type: t.id }))}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left ${
                      form.type === t.id
                        ? `${t.bg} ${t.color} ${t.border}`
                        : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <Icon size={16} className="flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-xs opacity-70">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={labelCls}>Name *</label>
            <input type="text" {...field('name')} placeholder="e.g. Weekend Bundle Deal" className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <input type="text" {...field('description')} placeholder="Optional short description" className={inputCls} />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date *</label>
              <PosDateField
                value={form.startDate ? String(form.startDate).slice(0, 10) : ''}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                max={form.endDate ? String(form.endDate).slice(0, 10) : undefined}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End Date *</label>
              <PosDateField
                value={form.endDate ? String(form.endDate).slice(0, 10) : ''}
                onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                min={form.startDate ? String(form.startDate).slice(0, 10) : undefined}
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Type-specific fields ── */}

          {form.type === 'bundle' && (
            <>
              <div>
                <label className={labelCls}>Bundle Items *</label>
                <BundleItemsField
                  bundleItems={form.bundleItems}
                  onChange={(items) => setForm(f => ({ ...f, bundleItems: items }))}
                  menuItems={menuItems}
                />
              </div>
              <div>
                <label className={labelCls}>Bundle Price (Rs) *</label>
                <input type="number" min="0" step="0.01" {...field('bundlePrice')}
                  placeholder="e.g. 499.00" className={inputCls} />
              </div>
            </>
          )}

          {form.type === 'buyXgetY' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Buy Item *</label>
                  <select value={form.buyItem}
                    onChange={e => {
                      const m = menuItems.find(x => x._id === e.target.value);
                      setForm(f => ({ ...f, buyItem: e.target.value, buyItemName: m?.name || '' }));
                    }}
                    className={inputCls}>
                    <option value="">Select…</option>
                    {menuItems.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Buy Qty *</label>
                  <input type="number" min="1" {...field('buyQty')} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Free Item *</label>
                  <select value={form.getFreeItem}
                    onChange={e => {
                      const m = menuItems.find(x => x._id === e.target.value);
                      setForm(f => ({ ...f, getFreeItem: e.target.value, getFreeItemName: m?.name || '' }));
                    }}
                    className={inputCls}>
                    <option value="">Select…</option>
                    {menuItems.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Free Qty *</label>
                  <input type="number" min="1" {...field('getFreeQty')} className={inputCls} />
                </div>
              </div>
            </>
          )}

          {form.type === 'flatPrice' && (
            <>
              <div>
                <label className={labelCls}>Applicable Items / Categories * (at least one required)</label>
                <ApplicableItemsField
                  itemIds={form.applicableItems}
                  itemNames={form.applicableItemNames}
                  categoryNames={form.applicableCategories}
                  onChange={(ids, names, cats) => setForm(f => ({ ...f, applicableItems: ids, applicableItemNames: names, applicableCategories: cats }))}
                  menuItems={menuItems}
                  categories={categories}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Flat Price per item (Rs) *</label>
                <input type="number" min="0" step="0.01" {...field('flatPrice')}
                  placeholder="e.g. 299.00" className={inputCls} />
              </div>
            </>
          )}

          {form.type === 'flatDiscount' && (
            <>
              <div>
                <label className={labelCls}>Discount Amount (Rs) *</label>
                <input type="number" min="0" step="0.01" {...field('discountAmount')}
                  placeholder="e.g. 100.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Scope (empty = whole order)</label>
                <ApplicableItemsField
                  itemIds={form.applicableItems}
                  itemNames={form.applicableItemNames}
                  categoryNames={form.applicableCategories}
                  onChange={(ids, names, cats) => setForm(f => ({ ...f, applicableItems: ids, applicableItemNames: names, applicableCategories: cats }))}
                  menuItems={menuItems}
                  categories={categories}
                />
              </div>
              <div>
                <label className={labelCls}>Min Order Amount (Rs, optional)</label>
                <input type="number" min="0" step="0.01" {...field('minOrderAmount')}
                  placeholder="e.g. 500" className={inputCls} />
              </div>
            </>
          )}

          {form.type === 'percentageDiscount' && (
            <>
              <div>
                <label className={labelCls}>Discount % *</label>
                <input type="number" min="0" max="100" step="0.1" {...field('discountPercent')}
                  placeholder="e.g. 15" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Scope (empty = whole order)</label>
                <ApplicableItemsField
                  itemIds={form.applicableItems}
                  itemNames={form.applicableItemNames}
                  categoryNames={form.applicableCategories}
                  onChange={(ids, names, cats) => setForm(f => ({ ...f, applicableItems: ids, applicableItemNames: names, applicableCategories: cats }))}
                  menuItems={menuItems}
                  categories={categories}
                />
              </div>
              <div>
                <label className={labelCls}>Min Order Amount (Rs, optional)</label>
                <input type="number" min="0" step="0.01" {...field('minOrderAmount')}
                  placeholder="e.g. 500" className={inputCls} />
              </div>
            </>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-slate-300">Active</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
              {form.active
                ? <ToggleRight size={24} className="text-green-400" />
                : <ToggleLeft size={24} className="text-slate-600" />}
            </button>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeSlide}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={savePending}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {savePending ? 'Saving…' : editing ? 'Save Changes' : 'Create Promotion'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}

// ─── Inline summary of what the promotion does ────────────────────────────────
function PromoSummary({ promo }) {
  let summary = '';
  switch (promo.type) {
    case 'bundle':
      summary = `${promo.bundleItems?.length || 0} items bundled @ ${formatCurrency(promo.bundlePrice)}`;
      break;
    case 'buyXgetY':
      summary = `Buy ${promo.buyQty}× ${promo.buyItemName || '?'} → get ${promo.getFreeQty}× ${promo.getFreeItemName || '?'} free`;
      break;
    case 'flatPrice': {
      summary = `${formatCurrency(promo.flatPrice)} per item`;
      const fp = [...(promo.applicableCategories || []).map(c => `📁 ${c}`), ...(promo.applicableItemNames || [])];
      if (fp.length) summary += ` (${fp.join(', ')})`;
      break;
    }
    case 'flatDiscount': {
      summary = `${formatCurrency(promo.discountAmount)} off`;
      const fd = [...(promo.applicableCategories || []).map(c => `📁 ${c}`), ...(promo.applicableItemNames || [])];
      if (fd.length) summary += ` on ${fd.join(', ')}`;
      else summary += ' order';
      if (promo.minOrderAmount > 0) summary += ` (min ${formatCurrency(promo.minOrderAmount)})`;
      break;
    }
    case 'percentageDiscount': {
      summary = `${promo.discountPercent}% off`;
      const pd = [...(promo.applicableCategories || []).map(c => `📁 ${c}`), ...(promo.applicableItemNames || [])];
      if (pd.length) summary += ` on ${pd.join(', ')}`;
      else summary += ' order';
      if (promo.minOrderAmount > 0) summary += ` (min ${formatCurrency(promo.minOrderAmount)})`;
      break;
    }
  }
  if (!summary) return null;
  return <p className="text-xs text-amber-400/80 mt-1">{summary}</p>;
}
