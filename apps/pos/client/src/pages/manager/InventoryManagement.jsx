import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, Package, Check, X, AlertTriangle, Truck,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import Badge from '../../components/Badge';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { InventoryTableSkeleton } from '../../components/StoreSkeletons';

const EMPTY_FORM = { itemName: '', unit: 'pcs', quantity: '', minThreshold: '', suppliers: [] };

const getStockStatus = (qty, min) => {
  if (qty <= 0) return { label: 'Out of Stock', variant: 'critical' };
  if (qty < min) return { label: 'Critical', variant: 'critical' };
  if (qty < min * 1.5) return { label: 'Low', variant: 'low' };
  return { label: 'OK', variant: 'ok' };
};

function InlineEdit({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const save = () => {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) { onSave(n); setEditing(false); }
  };

  if (!editing) {
    return (
      <button onClick={() => { setVal(value); setEditing(true); }}
        className="text-[var(--pos-text-primary)] font-semibold hover:text-amber-400 transition">
        {value}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input type="number" min="0" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        className="w-20 bg-[var(--pos-surface-inset)] border border-amber-500 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-sm focus:outline-none"
      />
      <button onClick={save} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
      <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
    </div>
  );
}

function SupplierPills({ suppliers }) {
  if (!suppliers?.length) return <span className="text-slate-600 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {suppliers.map(s => (
        <span key={s._id}
          className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-full px-2 py-0.5 text-xs font-medium">
          <Truck size={9} /> {s.name}
        </span>
      ))}
    </div>
  );
}

export default function InventoryManagement() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState('all');
  const qc = useQueryClient();

  const { data: items = [], isPending: invPending } = useQuery({
    queryKey: ['inventory', selectedStoreId],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: isStoreReady,
  });

  const { data: suppliers = [], isPending: supPending } = useQuery({
    queryKey: ['suppliers', selectedStoreId],
    queryFn: () => api.get('/suppliers').then(r => r.data),
    enabled: isStoreReady,
  });

  const pageLoading = !isStoreReady || invPending || supPending;

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/inventory', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setSlideOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      itemName: item.itemName,
      unit: item.unit,
      quantity: item.quantity,
      minThreshold: item.minThreshold,
      suppliers: item.suppliers?.map(s => s._id) || [],
    });
    setFormError('');
    setSlideOpen(true);
  };
  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const toggleSupplier = (id) => {
    setForm(f => ({
      ...f,
      suppliers: f.suppliers.includes(id)
        ? f.suppliers.filter(s => s !== id)
        : [...f.suppliers, id],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      ...form,
      quantity: parseFloat(form.quantity),
      minThreshold: parseFloat(form.minThreshold),
    };
    if (!payload.itemName.trim()) return setFormError('Item name is required');
    if (isNaN(payload.quantity) || payload.quantity < 0) return setFormError('Quantity must be 0 or more');
    if (isNaN(payload.minThreshold) || payload.minThreshold < 0) return setFormError('Threshold must be 0 or more');
    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = items.filter(item => {
    if (filter === 'all') return true;
    const s = getStockStatus(item.quantity, item.minThreshold);
    return s.variant === filter;
  });

  const lowCount = items.filter(i => getStockStatus(i.quantity, i.minThreshold).variant !== 'ok').length;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              Inventory
              {lowCount > 0 && (
                <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <AlertTriangle size={12} /> {lowCount} need attention
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-sm mt-1">{items.length} items tracked</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm">
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'all', label: 'All' },
            { key: 'ok', label: 'OK' },
            { key: 'low', label: 'Low' },
            { key: 'critical', label: 'Critical' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                filter === f.key
                  ? 'bg-amber-500 text-[var(--pos-selection-text)]'
                  : 'text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {pageLoading ? (
          <InventoryTableSkeleton />
        ) : (
          <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Item Name</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Unit</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Qty (click to edit)</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Min Threshold</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Suppliers</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500 py-16">
                        <Package size={36} className="mx-auto mb-3 opacity-30" />
                        <p>No inventory items found</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(item => {
                      const status = getStockStatus(item.quantity, item.minThreshold);
                      const rowBg = status.variant === 'critical' ? 'bg-red-500/5'
                        : status.variant === 'low' ? 'bg-yellow-500/5' : '';
                      return (
                        <tr key={item._id} className={`hover:bg-slate-700/20 transition ${rowBg}`}>
                          <td className="px-5 py-3 font-medium text-[var(--pos-text-primary)]">{item.itemName}</td>
                          <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                          <td className="px-4 py-3">
                            <InlineEdit value={item.quantity}
                              onSave={(qty) => updateMutation.mutate({ id: item._id, data: { quantity: qty } })} />
                          </td>
                          <td className="px-4 py-3 text-slate-400">{item.minThreshold}</td>
                          <td className="px-4 py-3">
                            <Badge label={status.label} variant={status.variant} />
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <SupplierPills suppliers={item.suppliers} />
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {new Date(item.lastUpdated || item.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => { if (confirm('Delete this item?')) deleteMutation.mutate(item._id); }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Inventory Item' : 'Add Inventory Item'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Item Name *</label>
            <input type="text" value={form.itemName}
              onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
              placeholder="e.g. Burger Buns" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Unit *</label>
            <input type="text" value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              placeholder="e.g. pcs, kg, L" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Quantity *</label>
            <input type="number" min="0" step="0.01" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="0" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Minimum Threshold *</label>
            <input type="number" min="0" step="0.01" value={form.minThreshold}
              onChange={e => setForm(f => ({ ...f, minThreshold: e.target.value }))}
              placeholder="e.g. 50" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
            <p className="text-xs text-slate-500 mt-1">Alert when quantity drops below this value</p>
          </div>

          {/* Supplier binding */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5"><Truck size={13} /> Suppliers</span>
            </label>
            {suppliers.length === 0 ? (
              <p className="text-xs text-slate-500 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-4 py-3">
                No suppliers added yet. Add suppliers from the Suppliers page first.
              </p>
            ) : (
              <div className="bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl p-3 flex flex-wrap gap-2">
                {suppliers.map(s => {
                  const selected = form.suppliers.includes(s._id);
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => toggleSupplier(s._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        selected
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'text-slate-400 border-slate-700 hover:border-slate-500 hover:text-[var(--pos-text-primary)]'
                      }`}
                    >
                      {selected && <Check size={11} />}
                      <Truck size={11} />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
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
              {isPending ? 'Saving...' : (editing ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
