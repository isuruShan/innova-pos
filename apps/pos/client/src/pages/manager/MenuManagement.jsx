import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Link2, X,
  ChevronDown, ChevronUp, Tag, Check, Upload, ImageIcon,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import { MenuGridSkeleton } from '../../components/StoreSkeletons';

const EMPTY_FORM = {
  name: '', category: '', price: '', description: '', image: '', imageKey: '',
  available: true, isCombo: false, comboItems: [],
};

// ─── Combo builder ───────────────────────────────────────────────────────────

function ComboBuilder({ comboItems, onChange, allItems, currentItemId }) {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);

  const addedIds = new Set(comboItems.map(c => c.menuItem));
  const available = allItems.filter(i => i._id !== currentItemId && !addedIds.has(i._id) && !i.isCombo);

  const add = () => {
    if (!selectedId) return;
    const item = allItems.find(i => i._id === selectedId);
    if (!item) return;
    onChange([...comboItems, { menuItem: item._id, name: item.name, qty: parseInt(qty) || 1 }]);
    setSelectedId(''); setQty(1);
  };
  const remove = (id) => onChange(comboItems.filter(c => c.menuItem !== id));
  const updateQty = (id, newQty) => onChange(
    comboItems.map(c => c.menuItem === id ? { ...c, qty: Math.max(1, parseInt(newQty) || 1) } : c)
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Quantities multiply with the ordered amount.</p>
      {comboItems.length > 0 && (
        <div className="bg-[var(--pos-surface-inset)] rounded-xl divide-y divide-slate-800">
          {comboItems.map(ci => (
            <div key={ci.menuItem} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 text-sm text-slate-200 truncate">{ci.name}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateQty(ci.menuItem, ci.qty - 1)}
                  className="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-xs">−</button>
                <span className="w-6 text-center text-sm text-[var(--pos-text-primary)] font-semibold">{ci.qty}</span>
                <button type="button" onClick={() => updateQty(ci.menuItem, ci.qty + 1)}
                  className="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-xs">+</button>
              </div>
              <button type="button" onClick={() => remove(ci.menuItem)}
                className="text-slate-600 hover:text-red-400 transition ml-1"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <div className="flex gap-2">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">— Select item —</option>
            {available.map(i => <option key={i._id} value={i._id}>{i.name} ({formatCurrency(i.price)})</option>)}
          </select>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
            className="w-16 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <button type="button" onClick={add} disabled={!selectedId}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-2 rounded-xl transition text-sm font-semibold">
            Add
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">No more items available to add.</p>
      )}
    </div>
  );
}

function ComboItemsPreview({ comboItems }) {
  const [open, setOpen] = useState(false);
  if (!comboItems?.length) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-400">
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {comboItems.length} item{comboItems.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {comboItems.map((ci, i) => (
            <li key={i} className="text-xs text-slate-500">• {ci.name} ×{ci.qty}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Image upload field ───────────────────────────────────────────────────────

function ImageUploadField({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState(value?.startsWith('http') || !value ? 'url' : 'file');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd);
      onChange({ image: data.url, imageKey: data.key });
      setTab('file');
    } catch {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-slate-300">Image</label>
        <div className="flex gap-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg p-0.5">
          {[{ id: 'url', label: 'URL' }, { id: 'file', label: 'Upload' }].map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${tab === t.id ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'url' ? (
        <input type="url" value={value} onChange={e => onChange({ image: e.target.value, imageKey: '' })}
          placeholder="https://images.unsplash.com/..."
          className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
      ) : (
        <div>
          <input type="file" ref={fileRef} onChange={handleFile} accept="image/*" className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 bg-[var(--pos-surface-inset)] border border-dashed border-slate-600 hover:border-amber-500 rounded-xl px-4 py-3 text-sm text-slate-400 hover:text-amber-400 transition disabled:opacity-50">
            {uploading ? <><Upload size={15} className="animate-bounce" /> Uploading…</> : <><ImageIcon size={15} /> Click to upload image (max 5 MB)</>}
          </button>
        </div>
      )}

      {value && (
        <div className="mt-2 relative group">
          <img src={value}
            alt="preview" className="h-24 w-full object-cover rounded-xl"
            onError={e => e.target.style.display = 'none'} />
          <button type="button" onClick={() => onChange({ image: '', imageKey: '' })}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-red-500 rounded-full flex items-center justify-center text-[var(--pos-text-primary)] transition opacity-0 group-hover:opacity-100">
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Category management panel ────────────────────────────────────────────────

function CategoryManager({ categories, onClose }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: (name) => api.post('/categories', { name }),
    onSuccess: () => { invalidate(); setNewName(''); setError(''); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to add'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/categories/${id}`, data),
    onSuccess: () => { invalidate(); setEditingId(null); setError(''); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/categories/${id}`),
    onSuccess: invalidate,
  });

  const startEdit = (cat) => { setEditingId(cat._id); setEditName(cat.name); setError(''); };
  const saveEdit = () => {
    if (!editName.trim()) return;
    updateMutation.mutate({ id: editingId, data: { name: editName.trim() } });
  };

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">New Category</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
            placeholder="e.g. Wraps"
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
          />
          <button
            onClick={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
            disabled={!newName.trim() || createMutation.isPending}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No categories yet</p>
        ) : (
          categories.map(cat => (
            <div key={cat._id}
              className={`flex items-center gap-3 bg-[var(--pos-surface-inset)] rounded-xl px-3 py-2.5 border transition ${
                cat.active ? 'border-slate-700' : 'border-slate-800 opacity-60'
              }`}>
              {editingId === cat._id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none"
                  />
                  <button onClick={saveEdit} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
                </>
              ) : (
                <>
                  <Tag size={13} className={cat.active ? 'text-amber-400' : 'text-slate-600'} />
                  <span className="flex-1 text-sm text-[var(--pos-text-primary)] truncate">{cat.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cat.active
                      ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                      : 'bg-slate-700 text-slate-500 border border-slate-600'
                  }`}>
                    {cat.active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => updateMutation.mutate({ id: cat._id, data: { active: !cat.active } })}
                    className="p-1 rounded text-slate-500 hover:text-amber-400 transition" title={cat.active ? 'Deactivate' : 'Activate'}>
                    {cat.active ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => startEdit(cat)}
                    className="p-1 rounded text-slate-500 hover:text-[var(--pos-text-primary)] transition"><Edit2 size={13} /></button>
                  <button
                    onClick={() => { if (confirm(`Delete category "${cat.name}"?`)) deleteMutation.mutate(cat._id); }}
                    className="p-1 rounded text-slate-500 hover:text-red-400 transition"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <button onClick={onClose}
        className="w-full bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-medium py-2.5 rounded-xl transition text-sm mt-2">
        Done
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MenuManagement() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [activeCategory, setActiveCategory] = useState('All');
  const [slideOpen, setSlideOpen] = useState(false);
  const [catSlideOpen, setCatSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    setActiveCategory('All');
  }, [selectedStoreId]);

  const { data: items = [], isPending: menuPending } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: isStoreReady,
  });

  // Fetch ALL categories (including inactive) for management; active-only for filter/form
  const { data: allCategories = [], isPending: categoriesPending } = useQuery({
    queryKey: ['categories', 'all', selectedStoreId],
    queryFn: () => api.get('/categories?all=true').then(r => r.data),
    enabled: isStoreReady,
  });

  const menuLoading = !isStoreReady || menuPending || categoriesPending;
  const activeCategories = allCategories.filter(c => c.active);
  const categoryNames = activeCategories.map(c => c.name);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/menu', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save item'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/menu/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save item'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/menu/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }) => api.put(`/menu/${id}`, { available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categoryNames[0] || '' });
    setFormError('');
    setSlideOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, price: item.price,
      description: item.description, image: item.image, imageKey: item.imageKey || '', available: item.available,
      isCombo: item.isCombo || false, comboItems: item.comboItems || [],
    });
    setFormError('');
    setSlideOpen(true);
  };

  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const payload = { ...form, price: parseFloat(form.price) };
    if (!payload.name.trim()) return setFormError('Name is required');
    if (isNaN(payload.price) || payload.price < 0) return setFormError('Price must be a positive number');
    if (payload.isCombo && payload.comboItems.length === 0)
      return setFormError('A combo must have at least one item added');
    if (!payload.isCombo) payload.comboItems = [];
    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = useMemo(
    () => activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory),
    [items, activeCategory]
  );
  const isPending = createMutation.isPending || updateMutation.isPending;
  const nonComboItems = items.filter(i => !i.isCombo);
  const filterTabs = ['All', ...categoryNames];

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)]">Menu Items</h1>
            <p className="text-slate-500 text-sm mt-1">{items.length} items · {items.filter(i => i.isCombo).length} combos</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCatSlideOpen(true)}
              className="flex items-center gap-2 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-amber-400 font-medium px-4 py-2.5 rounded-xl transition text-sm">
              <Tag size={15} />
              Categories
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm">
              <Plus size={16} />
              Add Item
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {filterTabs.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeCategory === cat
                  ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {menuLoading ? (
          <MenuGridSkeleton cards={15} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-slate-600 py-16">No items in this category</div>
            )}
            {filtered.map(item => (
              <div key={item._id}
                className={`bg-[var(--pos-panel)] rounded-2xl overflow-hidden border transition group ${
                  item.isCombo ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-slate-700/50 hover:border-slate-600'
                }`}>
                <div className="relative h-32 bg-slate-800 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {item.isCombo ? '🍱' : '🍔'}
                    </div>
                  )}
                  {item.isCombo && (
                    <div className="absolute top-2 left-2">
                      <span className="flex items-center gap-1 bg-amber-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Link2 size={10} /> Combo
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                    <button onClick={() => openEdit(item)}
                      className="w-7 h-7 bg-slate-900/80 backdrop-blur rounded-lg flex items-center justify-center text-slate-300 hover:text-[var(--pos-text-primary)]">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => { if (confirm('Delete this item?')) deleteMutation.mutate(item._id); }}
                      className="w-7 h-7 bg-slate-900/80 backdrop-blur rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-[var(--pos-text-primary)] text-sm truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 mb-1">{item.category}</p>
                  {item.isCombo && <ComboItemsPreview comboItems={item.comboItems} />}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-amber-400 font-bold">{formatCurrency(item.price)}</span>
                    <button
                      onClick={() => toggleMutation.mutate({ id: item._id, available: !item.available })}
                      className={`flex items-center gap-1 text-xs font-medium transition ${item.available ? 'text-green-400' : 'text-slate-500'}`}>
                      {item.available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {item.available ? 'Active' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category management slide-over */}
      <SlideOver open={catSlideOpen} onClose={() => setCatSlideOpen(false)} title="Manage Categories">
        <CategoryManager categories={allCategories} onClose={() => setCatSlideOpen(false)} />
      </SlideOver>

      {/* Menu item slide-over */}
      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Menu Item' : 'Add Menu Item'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Combo toggle */}
          <div
            onClick={() => setForm(f => ({ ...f, isCombo: !f.isCombo, category: !f.isCombo ? 'Combos' : f.category, comboItems: [] }))}
            className={`flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer border transition ${
              form.isCombo ? 'bg-amber-500/10 border-amber-500/40' : 'bg-[var(--pos-surface-inset)] border-slate-700 hover:border-slate-600'
            }`}>
            <div className="flex items-center gap-2">
              <Link2 size={16} className={form.isCombo ? 'text-amber-400' : 'text-slate-500'} />
              <div>
                <p className={`text-sm font-semibold ${form.isCombo ? 'text-amber-400' : 'text-slate-300'}`}>Combo Product</p>
                <p className="text-xs text-slate-500">Bundle multiple items into one product</p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition relative flex-shrink-0 ${form.isCombo ? 'bg-amber-500' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isCombo ? 'left-5' : 'left-0.5'}`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Item Name *</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={form.isCombo ? 'e.g. Burger Meal Deal' : 'e.g. Classic Burger'} required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Category *</label>
            {categoryNames.length > 0 ? (
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-500 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-4 py-3">
                No active categories. Add categories first using the Categories button.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Price ($) *</label>
            <input type="number" step="0.01" min="0" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="0.00" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
            {form.isCombo && <p className="text-xs text-slate-500 mt-1">Set the combo price (can differ from sum of parts)</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Short description..."
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none" />
          </div>

          <ImageUploadField
            value={form.image}
            onChange={({ image, imageKey }) => setForm((f) => ({ ...f, image, imageKey }))}
          />

          {/* Combo builder */}
          {form.isCombo && (
            <div className="bg-[var(--pos-surface-inset)] rounded-xl p-4 border border-amber-500/20">
              <p className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                <Link2 size={14} /> Combo Items
              </p>
              <ComboBuilder comboItems={form.comboItems}
                onChange={comboItems => setForm(f => ({ ...f, comboItems }))}
                allItems={items} currentItemId={editing?._id} />
            </div>
          )}

          {/* Availability toggle */}
          <div className="flex items-center justify-between bg-[var(--pos-surface-inset)] rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Available on menu</p>
              <p className="text-xs text-slate-500">Show to cashiers</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, available: !f.available }))}
              className={`w-12 h-6 rounded-full transition relative ${form.available ? 'bg-amber-500' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.available ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{formError}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeSlide}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
