import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, Truck, Package,
  Phone, Mail, MapPin, User, FileText, ChevronDown, ChevronRight,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { SupplierCardsSkeleton } from '../../components/StoreSkeletons';

const EMPTY_FORM = { name: '', contactPerson: '', email: '', phone: '', address: '', notes: '' };

function SupplierForm({ form, setForm, onSubmit, onCancel, isPending, error, editing }) {
  const field = (key, label, placeholder, icon, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-500">
        {icon}
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {field('name', 'Supplier Name *', 'e.g. Fresh Foods Co.', <Truck size={14} className="text-slate-500 flex-shrink-0" />)}
      {field('contactPerson', 'Contact Person', 'e.g. John Smith', <User size={14} className="text-slate-500 flex-shrink-0" />)}
      {field('phone', 'Phone', 'e.g. +94 77 123 4567', <Phone size={14} className="text-slate-500 flex-shrink-0" />)}
      {field('email', 'Email', 'e.g. orders@freshfoods.com', <Mail size={14} className="text-slate-500 flex-shrink-0" />, 'email')}
      {field('address', 'Address', 'Street, City', <MapPin size={14} className="text-slate-500 flex-shrink-0" />)}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Delivery schedule, payment terms, etc."
          className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
          {isPending ? 'Saving…' : (editing ? 'Save Changes' : 'Add Supplier')}
        </button>
      </div>
    </form>
  );
}

function SupplierCard({ supplier, onEdit, onDelete, onToggleItems, expanded }) {
  return (
    <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-purple-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[var(--pos-text-primary)] font-semibold text-sm truncate">{supplier.name}</h3>
            {supplier.contactPerson && (
              <p className="text-slate-500 text-xs truncate">{supplier.contactPerson}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(supplier)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(supplier._id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5">
        {supplier.phone && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Phone size={11} className="text-slate-600" /> {supplier.phone}
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Mail size={11} className="text-slate-600" /> {supplier.email}
          </div>
        )}
        {supplier.address && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin size={11} className="text-slate-600" /> {supplier.address}
          </div>
        )}
        {supplier.notes && (
          <div className="flex items-start gap-2 text-xs text-slate-500 italic border-t border-slate-700/40 pt-2 mt-2">
            <FileText size={11} className="text-slate-600 mt-0.5 flex-shrink-0" /> {supplier.notes}
          </div>
        )}
      </div>

      {/* Inventory item count toggle */}
      <button
        onClick={() => onToggleItems(supplier._id)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-amber-400 transition w-full"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Package size={12} />
        <span>{supplier.itemCount} inventory item{supplier.itemCount !== 1 ? 's' : ''} linked</span>
      </button>

      {/* Expanded items list */}
      {expanded && supplier.items && (
        <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 space-y-1.5">
          {supplier.items.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">No inventory items linked</p>
          ) : (
            supplier.items.map(item => (
              <div key={item._id} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{item.itemName}</span>
                <span className="text-slate-600">{item.quantity} {item.unit}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function SupplierManagement() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const qc = useQueryClient();

  const { data: suppliers = [], isPending } = useQuery({
    queryKey: ['suppliers', selectedStoreId],
    queryFn: () => api.get('/suppliers').then(r => r.data),
    enabled: isStoreReady,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['suppliers'] });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/suppliers', data),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/suppliers/${id}`, data),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setSlideOpen(true); };
  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setFormError('');
    setSlideOpen(true);
  };
  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Supplier name is required');
    if (editing) updateMutation.mutate({ id: editing._id, data: form });
    else createMutation.mutate(form);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this supplier? It will be unlinked from all inventory items.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleItems = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedItems[id]) {
      const data = await api.get(`/suppliers/${id}`).then(r => r.data);
      setExpandedItems(prev => ({ ...prev, [id]: data.items }));
    }
  };

  const suppliersWithItems = suppliers.map(s => ({
    ...s,
    items: expandedItems[s._id],
  }));

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              <Truck size={22} className="text-purple-400" />
              Suppliers
            </h1>
            <p className="text-slate-500 text-sm mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} registered</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm">
            <Plus size={16} />
            Add Supplier
          </button>
        </div>

        {!isStoreReady || isPending ? (
          <SupplierCardsSkeleton />
        ) : suppliers.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Truck size={52} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-semibold">No suppliers yet</p>
            <p className="text-sm mt-1 opacity-60">Add your first supplier to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliersWithItems.map(supplier => (
              <SupplierCard
                key={supplier._id}
                supplier={supplier}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleItems={handleToggleItems}
                expanded={expandedId === supplier._id}
              />
            ))}
          </div>
        )}
      </div>

      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <SupplierForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onCancel={closeSlide}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={formError}
          editing={editing}
        />
      </SlideOver>
    </div>
  );
}
