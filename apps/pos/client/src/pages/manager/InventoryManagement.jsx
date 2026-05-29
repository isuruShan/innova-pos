import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, Package, Check, X, AlertTriangle, Truck, Search,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import Badge from '../../components/Badge';
import Toast from '../../components/Toast';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { InventoryTableSkeleton } from '../../components/StoreSkeletons';
import SortableTh from '../../components/SortableTh';
import { useListSort } from '../../hooks/useListSort';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import InventoryAdjustments from '../../components/inventory/InventoryAdjustments';
import InventoryMovements from '../../components/inventory/InventoryMovements';
import ConsumptionReport from '../../components/inventory/ConsumptionReport';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable from '../../components/ResponsiveTable';

const EMPTY_FORM = { itemName: '', unit: 'pcs', quantity: '', minThreshold: '', suppliers: [] };

const PREDEFINED_UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'mL', label: 'Milliliter (mL)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'lb', label: 'Pound (lb)' },
  { value: 'box', label: 'Box' },
  { value: 'bag', label: 'Bag' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' },
  { value: 'pack', label: 'Pack' },
  { value: 'other', label: 'Other (custom)' },
];

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
  const [activeTab, setActiveTab] = useState('stock');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState('all');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const qc = useQueryClient();
  const { sort, order, toggleSort, sortParams } = useListSort('name', 'asc');
  const { toast, showToast, clearToast } = useToast();

  const { data: items = [], isPending: invPending } = useQuery({
    queryKey: ['inventory', selectedStoreId, sortParams],
    queryFn: () => api.get('/inventory', { params: { sort, order } }).then(r => r.data),
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
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['inventory'] }); 
      closeSlide(); 
      showToast('Item added successfully', 'success');
    },
    onError: (e) => {
      const msg = getApiErrorMessage(e, 'Failed to save item');
      setFormError(msg);
      showToast(msg, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      closeSlide();
      showToast('Item updated successfully', 'success');
    },
    onError: (e) => {
      const msg = getApiErrorMessage(e, 'Failed to update item');
      setFormError(msg);
      showToast(msg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const openAdd = () => { 
    setEditing(null); 
    setForm(EMPTY_FORM); 
    setFormError(''); 
    setSlideOpen(true); 
    setSupplierSearch(''); 
    setCustomUnit(''); 
  };
  const openEdit = (item) => {
    setEditing(item);
    const unitExists = PREDEFINED_UNITS.some(u => u.value === item.unit);
    setForm({
      itemName: item.itemName,
      unit: unitExists ? item.unit : 'other',
      quantity: item.quantity,
      minThreshold: item.minThreshold,
      suppliers: item.suppliers?.map(s => s._id) || [],
    });
    setCustomUnit(unitExists ? '' : item.unit);
    setFormError('');
    setSlideOpen(true);
    setSupplierSearch('');
  };
  const closeSlide = () => { 
    setSlideOpen(false); 
    setEditing(null); 
    setForm(EMPTY_FORM); 
    setFormError(''); 
    setSupplierSearch(''); 
    setCustomUnit(''); 
  };

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
    const finalUnit = form.unit === 'other' ? customUnit.trim() : form.unit;
    if (!finalUnit) return setFormError('Please enter a custom unit');
    const payload = {
      ...form,
      unit: finalUnit,
      quantity: parseFloat(form.quantity),
      minThreshold: parseFloat(form.minThreshold),
    };
    if (!payload.itemName.trim()) return setFormError('Item name is required');
    if (isNaN(payload.quantity) || payload.quantity < 0) return setFormError('Quantity must be 0 or more');
    if (isNaN(payload.minThreshold) || payload.minThreshold < 0) return setFormError('Threshold must be 0 or more');
    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(search) || 
      s.contact?.toLowerCase().includes(search)
    );
  }, [suppliers, supplierSearch]);

  const removeSupplier = (id) => {
    setForm(f => ({ ...f, suppliers: f.suppliers.filter(s => s !== id) }));
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
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              Inventory
              {activeTab === 'stock' && lowCount > 0 && (
                <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <AlertTriangle size={12} /> {lowCount} need attention
                </span>
              )}
            </span>
          }
          subtitle={
            activeTab === 'stock' ? `${items.length} items tracked` :
            activeTab === 'adjustments' ? 'Make manual stock adjustments' :
            activeTab === 'consumption' ? 'View theoretical vs actual usage' :
            'View stock movement history'
          }
          actions={activeTab === 'stock' ? [
            { label: 'Add Item', icon: Plus, onClick: openAdd, primary: true },
          ] : []}
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-700/50 overflow-x-auto no-scrollbar">
          {[
            { key: 'stock', label: 'Stock Levels' },
            { key: 'adjustments', label: 'Adjustments' },
            { key: 'consumption', label: 'Consumption' },
            { key: 'movements', label: 'Movements' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium transition border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'stock' && (
          <>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'ok', label: 'OK' },
                { key: 'low', label: 'Low' },
                { key: 'critical', label: 'Critical' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
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
          <ResponsiveTable
            rows={filtered}
            rowKey={(item) => item._id}
            loading={false}
            emptyState={
              <span className="flex flex-col items-center gap-2">
                <Package size={36} className="opacity-30" />
                No inventory items found
              </span>
            }
            columns={[
              {
                key: 'name', header: 'Item Name',
                mobilePrimary: true,
                render: (item) => <span className="font-medium text-[var(--pos-text-primary)]">{item.itemName}</span>,
              },
              {
                key: 'status', header: 'Status',
                mobileSecondary: true,
                render: (item) => {
                  const status = getStockStatus(item.quantity, item.minThreshold);
                  return <Badge label={status.label} variant={status.variant} />;
                },
              },
              {
                key: 'qty', header: 'Qty',
                mobileRight: true,
                className: 'text-right',
                headerClassName: 'text-right',
                render: (item) => (
                  <InlineEdit
                    value={item.quantity}
                    onSave={(qty) => updateMutation.mutate({ id: item._id, data: { quantity: qty } })}
                  />
                ),
              },
              {
                key: 'unit', header: 'Unit',
                render: (item) => <span className="text-slate-400">{item.unit}</span>,
              },
              {
                key: 'threshold', header: 'Min',
                mobileLabel: 'Min Threshold',
                render: (item) => <span className="text-slate-400">{item.minThreshold}</span>,
              },
              {
                key: 'suppliers', header: 'Suppliers',
                render: (item) => <SupplierPills suppliers={item.suppliers} />,
              },
              {
                key: 'updated', header: 'Updated',
                render: (item) => (
                  <span className="text-slate-500 text-xs">
                    {new Date(item.lastUpdated || item.updatedAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                key: 'actions', header: '', mobileHide: true,
                render: (item) => (
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
                ),
              },
            ]}
          />
        )}


        {activeTab === 'adjustments' && <InventoryAdjustments />}
        {activeTab === 'consumption' && <ConsumptionReport />}
        {activeTab === 'movements' && <InventoryMovements />}
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
            <select value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              {PREDEFINED_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            {form.unit === 'other' && (
              <input
                type="text"
                value={customUnit}
                onChange={e => setCustomUnit(e.target.value)}
                placeholder="Enter custom unit (e.g. tray, dozen)"
                required
                className="mt-2 w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
              />
            )}
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
              <div className="space-y-2">
                {/* Selected suppliers as chips */}
                {form.suppliers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.suppliers.map(sId => {
                      const supplier = suppliers.find(s => s._id === sId);
                      if (!supplier) return null;
                      return (
                        <span
                          key={sId}
                          className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full px-3 py-1.5 text-sm font-medium"
                        >
                          <Truck size={12} />
                          {supplier.name}
                          <button
                            type="button"
                            onClick={() => removeSupplier(sId)}
                            className="ml-1 text-purple-300 hover:text-purple-100 transition"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* Searchable dropdown */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={e => setSupplierSearch(e.target.value)}
                      placeholder="Search suppliers to add..."
                      className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
                    />
                  </div>
                  {supplierSearch && filteredSuppliers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-[var(--pos-panel)] border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredSuppliers
                        .filter(s => !form.suppliers.includes(s._id))
                        .map(s => (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, suppliers: [...f.suppliers, s._id] }));
                              setSupplierSearch('');
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition flex items-center gap-2 text-sm text-[var(--pos-text-primary)]"
                          >
                            <Truck size={14} className="text-purple-400" />
                            <span>{s.name}</span>
                            {s.contact && <span className="text-slate-500 text-xs ml-auto">{s.contact}</span>}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
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
      
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={clearToast} />}
    </div>
  );
}
