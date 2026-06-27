import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Search, Truck } from 'lucide-react';
import api from '../../api/axios';
import SlideOver from '../SlideOver';

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

const EMPTY_FORM = { itemName: '', unit: 'pcs', quantity: '0', minThreshold: '10', suppliers: [] };

export default function AddInventoryItemDrawer({
  open,
  onClose,
  onSuccess,
  suppliers = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/inventory', data).then(r => r.data),
    onSuccess: (newItem) => {
      // Invalidate queries so inventory gets refreshed everywhere
      qc.invalidateQueries({ queryKey: ['inventory'] });
      // Reset form
      setForm(EMPTY_FORM);
      setSupplierSearch('');
      setCustomUnit('');
      setFormError('');
      // Call parent callback
      onSuccess(newItem);
      onClose();
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || 'Failed to save inventory item');
    },
  });

  const toggleSupplier = (id) => {
    setForm(f => ({
      ...f,
      suppliers: f.suppliers.includes(id)
        ? f.suppliers.filter(s => s !== id)
        : [...f.suppliers, id],
    }));
  };

  const removeSupplier = (id) => {
    setForm(f => ({ ...f, suppliers: f.suppliers.filter(s => s !== id) }));
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.contact?.toLowerCase().includes(search)
    );
  }, [suppliers, supplierSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const finalUnit = form.unit === 'other' ? customUnit.trim() : form.unit;
    if (!finalUnit) return setFormError('Please enter a custom unit');
    
    const payload = {
      itemName: form.itemName.trim(),
      unit: finalUnit,
      quantity: parseFloat(form.quantity),
      minThreshold: parseFloat(form.minThreshold),
      suppliers: form.suppliers,
    };

    if (!payload.itemName) return setFormError('Item name is required');
    if (isNaN(payload.quantity) || payload.quantity < 0) return setFormError('Quantity must be 0 or more');
    if (isNaN(payload.minThreshold) || payload.minThreshold < 0) return setFormError('Threshold must be 0 or more');

    createMutation.mutate(payload);
  };

  return (
    <SlideOver open={open} onClose={onClose} title="Add Inventory Item">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Item Name *</label>
          <input
            type="text"
            value={form.itemName}
            onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
            placeholder="e.g. Burger Buns"
            required
            disabled={createMutation.isPending}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit *</label>
          <select
            value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            required
            disabled={createMutation.isPending}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
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
              disabled={createMutation.isPending}
              className="mt-2 w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Quantity *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            placeholder="0"
            required
            disabled={createMutation.isPending}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum Threshold *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.minThreshold}
            onChange={e => setForm(f => ({ ...f, minThreshold: e.target.value }))}
            placeholder="e.g. 50"
            required
            disabled={createMutation.isPending}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">Alert when quantity drops below this value</p>
        </div>

        {/* Suppliers selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Truck size={13} /> Suppliers</span>
          </label>
          {suppliers.length === 0 ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
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
                          disabled={createMutation.isPending}
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
                    disabled={createMutation.isPending}
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
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Add Item'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
