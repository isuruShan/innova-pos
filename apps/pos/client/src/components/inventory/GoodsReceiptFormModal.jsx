import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Package, FileText, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

export default function GoodsReceiptFormModal({
  open,
  onClose,
  editing,
  createFromPO,
  type,
  suppliers,
  inventory,
  purchaseOrders,
  onSubmit,
  isPending,
}) {
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [items, setItems] = useState([]);
  const [receiptDate, setReceiptDate] = useState('');
  const [notes, setNotes] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && editing) {
      setSupplierId(String(editing.supplierId._id || editing.supplierId));
      setPurchaseOrderId(editing.purchaseOrderId ? String(editing.purchaseOrderId._id || editing.purchaseOrderId) : '');
      setItems(
        editing.items.map((item) => ({
          inventoryItemId: String(item.inventoryItemId),
          itemName: item.itemName,
          unit: item.unit,
          orderedQty: item.orderedQty,
          receivedQty: item.receivedQty,
          acceptedQty: item.acceptedQty,
          rejectedQty: item.rejectedQty,
          unitPrice: item.unitPrice,
          rejectionReason: item.rejectionReason || '',
        }))
      );
      setReceiptDate(editing.receiptDate ? editing.receiptDate.split('T')[0] : '');
      setNotes(editing.notes || '');
      setReturnReason(editing.returnReason || '');
      setError('');
    } else if (open && createFromPO) {
      // Populate from purchase order
      setSupplierId(String(createFromPO.supplierId._id || createFromPO.supplierId));
      setPurchaseOrderId(String(createFromPO._id));
      setItems(
        createFromPO.items.map((item) => ({
          inventoryItemId: String(item.inventoryItemId),
          itemName: item.itemName,
          unit: item.unit,
          orderedQty: item.orderedQty,
          receivedQty: Math.max(item.orderedQty - item.receivedQty, 0),
          acceptedQty: Math.max(item.orderedQty - item.receivedQty, 0),
          rejectedQty: 0,
          unitPrice: item.unitPrice,
          rejectionReason: '',
        }))
      );
      setReceiptDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setReturnReason('');
      setError('');
    } else if (open && !editing) {
      setSupplierId('');
      setPurchaseOrderId('');
      setItems([]);
      setReceiptDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setReturnReason('');
      setError('');
    }
  }, [open, editing, createFromPO]);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        inventoryItemId: '',
        itemName: '',
        unit: '',
        orderedQty: 0,
        receivedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        unitPrice: 0,
        rejectionReason: '',
      },
    ]);
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

    // Auto-calculate accepted/rejected for receipts
    if (type === 'receipt' && field === 'receivedQty') {
      const received = Number(value) || 0;
      const rejected = Number(updated[index].rejectedQty) || 0;
      updated[index].acceptedQty = Math.max(received - rejected, 0);
    }
    if (type === 'receipt' && field === 'rejectedQty') {
      const received = Number(updated[index].receivedQty) || 0;
      const rejected = Number(value) || 0;
      updated[index].acceptedQty = Math.max(received - rejected, 0);
    }

    setItems(updated);
  };

  const handlePOChange = (poId) => {
    setPurchaseOrderId(poId);
    if (poId) {
      const po = purchaseOrders.find((p) => String(p._id) === poId);
      if (po) {
        setSupplierId(String(po.supplierId._id || po.supplierId));
        setItems(
          po.items.map((item) => ({
            inventoryItemId: String(item.inventoryItemId),
            itemName: item.itemName,
            unit: item.unit,
            orderedQty: item.orderedQty,
            receivedQty: Math.max(item.orderedQty - item.receivedQty, 0),
            acceptedQty: Math.max(item.orderedQty - item.receivedQty, 0),
            rejectedQty: 0,
            unitPrice: item.unitPrice,
            rejectionReason: '',
          }))
        );
      }
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

    if (receiptDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const recDate = new Date(receiptDate);
      if (recDate > today) {
        return setError(`${type === 'receipt' ? 'Receipt' : 'Return'} Date cannot be in the future`);
      }
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.inventoryItemId) {
        return setError(`Item ${i + 1}: Please select an inventory item`);
      }
      if (type === 'receipt') {
        if (!item.receivedQty || item.receivedQty <= 0) {
          return setError(`Item ${i + 1}: Received quantity must be greater than 0`);
        }
        if (item.rejectedQty < 0) {
          return setError(`Item ${i + 1}: Rejected quantity cannot be negative`);
        }
        if (item.rejectedQty > item.receivedQty) {
          return setError(`Item ${i + 1}: Rejected quantity cannot exceed received quantity`);
        }
      } else {
        if (!item.receivedQty || item.receivedQty <= 0) {
          return setError(`Item ${i + 1}: Return quantity must be greater than 0`);
        }
      }
      if (item.unitPrice < 0) {
        return setError(`Item ${i + 1}: Unit price cannot be negative`);
      }
    }

    if (type === 'return' && !returnReason.trim()) {
      return setError('Please provide a reason for the return');
    }

    const payload = {
      type,
      purchaseOrderId: purchaseOrderId || null,
      supplierId,
      items: items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        orderedQty: Number(item.orderedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        acceptedQty: type === 'receipt' ? Number(item.acceptedQty) || 0 : 0,
        rejectedQty: type === 'receipt' ? Number(item.rejectedQty) || 0 : 0,
        unitPrice: Number(item.unitPrice) || 0,
        rejectionReason: item.rejectionReason || '',
      })),
      receiptDate: receiptDate || new Date().toISOString().split('T')[0],
      notes: notes.trim(),
      returnReason: type === 'return' ? returnReason.trim() : '',
    };

    onSubmit(payload);
  };

  const totalAmount = items.reduce((sum, item) => {
    const qty = type === 'receipt' ? Number(item.acceptedQty) || 0 : Number(item.receivedQty) || 0;
    return sum + qty * (Number(item.unitPrice) || 0);
  }, 0);

  if (!open) return null;

  const isReceipt = type === 'receipt';
  const title = editing
    ? `Edit ${isReceipt ? 'Goods Receipt' : 'Goods Return'}`
    : createFromPO
      ? `Create GRN from PO ${createFromPO.orderNumber}`
      : `New ${isReceipt ? 'Goods Receipt' : 'Goods Return'}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--pos-panel)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--pos-panel)] border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-[var(--pos-text-primary)]">{title}</h2>
            {editing && <p className="text-sm text-slate-500 mt-0.5">{editing.receiptNumber}</p>}
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
          {/* Purchase Order Selection (for receipts only, when not editing) */}
          {isReceipt && !editing && !createFromPO && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <FileText size={14} />
                Link to Purchase Order (Optional)
              </label>
              <select
                value={purchaseOrderId}
                onChange={(e) => handlePOChange(e.target.value)}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                disabled={isPending}
              >
                <option value="">None (standalone receipt)</option>
                {purchaseOrders
                  .filter((po) => ['sent', 'partial'].includes(po.status))
                  .map((po) => (
                    <option key={po._id} value={po._id}>
                      {po.orderNumber} - {po.supplierId?.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Supplier <span className="text-red-400">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isPending || !!purchaseOrderId}
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Receipt Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={14} />
              {isReceipt ? 'Receipt' : 'Return'} Date
            </label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
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
              {!purchaseOrderId && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition"
                  disabled={isPending}
                >
                  <Plus size={13} />
                  Add Item
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="bg-[var(--pos-surface-inset)] rounded-lg p-6 text-center text-slate-500 text-sm">
                No items added yet. {purchaseOrderId ? 'Select a purchase order to load items.' : 'Click "Add Item" to get started.'}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-[var(--pos-surface-inset)] rounded-lg p-4 border border-slate-700"
                  >
                    <div className="grid grid-cols-12 gap-3">
                      {/* Inventory Item */}
                      <div className="col-span-12 md:col-span-4">
                        <label className="block text-xs text-slate-500 mb-1">Item</label>
                        <select
                          value={item.inventoryItemId}
                          onChange={(e) => handleItemChange(index, 'inventoryItemId', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          disabled={isPending || !!purchaseOrderId}
                        >
                          <option value="">Select item</option>
                          {inventory.map((invItem) => (
                            <option key={invItem._id} value={invItem._id}>
                              {invItem.itemName} ({invItem.quantity} {invItem.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantities based on type */}
                      {isReceipt ? (
                        <>
                          {item.orderedQty > 0 && (
                            <div className="col-span-4 md:col-span-2">
                              <label className="block text-xs text-slate-500 mb-1">Ordered</label>
                              <input
                                type="number"
                                value={item.orderedQty}
                                readOnly
                                className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                              />
                            </div>
                          )}
                          <div className={`col-span-4 ${item.orderedQty > 0 ? 'md:col-span-2' : 'md:col-span-2'}`}>
                            <label className="block text-xs text-slate-500 mb-1">Received</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.receivedQty}
                              onChange={(e) => handleItemChange(index, 'receivedQty', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                              disabled={isPending}
                            />
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">Rejected</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.rejectedQty}
                              onChange={(e) => handleItemChange(index, 'rejectedQty', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                              disabled={isPending}
                            />
                          </div>
                          <div className="col-span-4 md:col-span-2">
                            <label className="block text-xs text-green-400 mb-1">Accepted</label>
                            <input
                              type="number"
                              value={item.acceptedQty}
                              readOnly
                              className="w-full bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-3 py-2 text-sm font-medium cursor-not-allowed"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="col-span-6 md:col-span-3">
                          <label className="block text-xs text-red-400 mb-1">Return Qty</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.receivedQty}
                            onChange={(e) => handleItemChange(index, 'receivedQty', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            disabled={isPending}
                          />
                        </div>
                      )}

                      {/* Unit Price */}
                      <div className={`col-span-${isReceipt ? '5' : '6'} md:col-span-2`}>
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
                      {!purchaseOrderId && (
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
                      )}
                    </div>

                    {/* Rejection Reason (for receipts with rejected items) */}
                    {isReceipt && item.rejectedQty > 0 && (
                      <div className="mt-3">
                        <label className="block text-xs text-red-400 mb-1 flex items-center gap-1">
                          <AlertTriangle size={11} />
                          Rejection Reason
                        </label>
                        <input
                          type="text"
                          value={item.rejectionReason}
                          onChange={(e) => handleItemChange(index, 'rejectionReason', e.target.value)}
                          placeholder="Damaged, expired, wrong item, etc."
                          className="w-full bg-red-500/10 border border-red-500/30 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-slate-600"
                          disabled={isPending}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Return Reason (for returns) */}
          {!isReceipt && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                Return Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={2}
                placeholder="Reason for returning these items..."
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500 resize-none"
                disabled={isPending}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500 resize-none"
              disabled={isPending}
            />
          </div>

          {/* Total Amount */}
          {items.length > 0 && (
            <div className={`${isReceipt ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-lg p-4 flex items-center justify-between`}>
              <span className="text-sm font-medium text-slate-300">
                Total {isReceipt ? 'Receipt' : 'Return'} Value
              </span>
              <span className={`text-xl font-bold ${isReceipt ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalAmount)}
              </span>
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
              {isPending ? 'Saving...' : editing ? 'Update' : 'Create Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
