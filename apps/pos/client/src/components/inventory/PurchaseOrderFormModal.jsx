import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Plus, Trash2, Lightbulb, Calendar, Package } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency } from '../../utils/format';

export default function PurchaseOrderFormModal({
  open,
  onClose,
  editing,
  suppliers,
  inventory,
  onSubmit,
  isPending,
}) {
  const { isStoreReady } = useStoreContext();
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: lowStockSuggestions = [], refetch: refetchSuggestions } = useQuery({
    queryKey: ['low-stock-suggestions'],
    queryFn: () => api.get('/purchase-orders/suggestions/low-stock').then((r) => r.data),
    enabled: false, // Only fetch when user clicks the button
  });

  useEffect(() => {
    if (open && editing) {
      setSupplierId(String(editing.supplierId._id || editing.supplierId));
      setItems(
        editing.items.map((item) => ({
          inventoryItemId: String(item.inventoryItemId),
          itemName: item.itemName,
          unit: item.unit,
          orderedQty: item.orderedQty,
          unitPrice: item.unitPrice,
        }))
      );
      setExpectedDate(editing.expectedDate ? editing.expectedDate.split('T')[0] : '');
      setNotes(editing.notes || '');
      setError('');
    } else if (open && !editing) {
      setSupplierId('');
      setItems([]);
      setExpectedDate('');
      setNotes('');
      setError('');
    }
  }, [open, editing]);

  const handleAddItem = () => {
    setItems([...items, { inventoryItemId: '', itemName: '', unit: '', orderedQty: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // If changing inventory item, update name and unit
    if (field === 'inventoryItemId') {
      const invItem = inventory.find((i) => String(i._id) === value);
      if (invItem) {
        updated[index].itemName = invItem.itemName;
        updated[index].unit = invItem.unit;
      }
    }

    setItems(updated);
  };

  const handleLoadSuggestions = async () => {
    const result = await refetchSuggestions();
    if (result.data && result.data.length > 0) {
      // Add suggestions as new items, avoiding duplicates
      const existingIds = new Set(items.map((i) => i.inventoryItemId));
      const newItems = result.data
        .filter((s) => !existingIds.has(String(s.inventoryItemId)))
        .map((s) => ({
          inventoryItemId: String(s.inventoryItemId),
          itemName: s.itemName,
          unit: s.unit,
          orderedQty: s.suggestedQty,
          unitPrice: s.unitPrice || 0,
        }));
      setItems([...items, ...newItems]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      return setError('Please select a supplier');
    }
    if (items.length === 0) {
      return setError('Please add at least one item');
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.inventoryItemId) {
        return setError(`Item ${i + 1}: Please select an inventory item`);
      }
      if (!item.orderedQty || item.orderedQty <= 0) {
        return setError(`Item ${i + 1}: Quantity must be greater than 0`);
      }
      if (item.unitPrice < 0) {
        return setError(`Item ${i + 1}: Unit price cannot be negative`);
      }
    }

    if (expectedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expDate = new Date(expectedDate);
      if (expDate < today) {
        return setError('Expected Delivery Date cannot be in the past');
      }
    }

    const payload = {
      supplierId,
      items: items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        orderedQty: Number(item.orderedQty),
        unitPrice: Number(item.unitPrice),
      })),
      expectedDate: expectedDate || null,
      notes: notes.trim(),
    };

    onSubmit(payload);
  };

  const totalAmount = items.reduce((sum, item) => {
    return sum + Number(item.orderedQty || 0) * Number(item.unitPrice || 0);
  }, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--pos-panel)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--pos-panel)] border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-[var(--pos-text-primary)]">
              {editing ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </h2>
            {editing && (
              <p className="text-sm text-slate-500 mt-0.5">{editing.orderNumber}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="w-9 h-9 bg-slate-700/50 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Supplier <span className="text-red-400">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isPending}
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Expected Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={14} />
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isPending}
            />
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Package size={14} />
                Items <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLoadSuggestions}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg text-xs font-medium transition"
                  disabled={isPending}
                >
                  <Lightbulb size={13} />
                  Suggest Low Stock
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition"
                  disabled={isPending}
                >
                  <Plus size={13} />
                  Add Item
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="bg-[var(--pos-surface-inset)] rounded-lg p-6 text-center text-slate-500 text-sm">
                No items added yet. Click "Add Item" or "Suggest Low Stock" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-[var(--pos-surface-inset)] rounded-lg p-4 border border-slate-700"
                  >
                    <div className="grid grid-cols-12 gap-3">
                      {/* Inventory Item Select */}
                      <div className="col-span-12 md:col-span-5">
                        <label className="block text-xs text-slate-500 mb-1">Item</label>
                        <select
                          value={item.inventoryItemId}
                          onChange={(e) => handleItemChange(index, 'inventoryItemId', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          disabled={isPending}
                        >
                          <option value="">Select item</option>
                          {inventory.map((invItem) => (
                            <option key={invItem._id} value={invItem._id}>
                              {invItem.itemName} ({invItem.quantity} {invItem.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-6 md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.orderedQty}
                          onChange={(e) => handleItemChange(index, 'orderedQty', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          disabled={isPending}
                        />
                      </div>

                      {/* Unit */}
                      <div className="col-span-6 md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit</label>
                        <input
                          type="text"
                          value={item.unit}
                          readOnly
                          className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-9 md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          disabled={isPending}
                        />
                      </div>

                      {/* Delete Button */}
                      <div className="col-span-3 md:col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="w-full h-[38px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center transition"
                          disabled={isPending}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Item Subtotal */}
                    <div className="mt-2 text-right text-xs text-slate-400">
                      Subtotal: <span className="text-amber-400 font-medium">
                        {formatCurrency(item.orderedQty * item.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes or special instructions..."
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500 resize-none"
              disabled={isPending}
            />
          </div>

          {/* Total Amount */}
          {items.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Total Order Amount</span>
              <span className="text-xl font-bold text-amber-400">{formatCurrency(totalAmount)}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700/50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Saving...' : editing ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
