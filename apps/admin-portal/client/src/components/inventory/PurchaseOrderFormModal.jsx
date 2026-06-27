import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Plus, Trash2, Lightbulb, Calendar, Package, Download, FileText } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import InventorySearchSelect from './InventorySearchSelect';
import AddInventoryItemDrawer from './AddInventoryItemDrawer';

export default function PurchaseOrderFormModal({
  open,
  onClose,
  editing,
  suppliers,
  inventory,
  onSubmit,
  isPending,
  readOnly = false,
}) {
  const { isStoreReady } = useStoreContext();
  const { user } = useAuth();
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [activeAddDrawerIndex, setActiveAddDrawerIndex] = useState(null);

  const handleAddNewItemSuccess = (newItem) => {
    if (activeAddDrawerIndex !== null && newItem) {
      const updated = [...items];
      updated[activeAddDrawerIndex].inventoryItemId = String(newItem._id);
      updated[activeAddDrawerIndex].itemName = newItem.itemName;
      updated[activeAddDrawerIndex].unit = newItem.unit;
      setItems(updated);
    }
  };

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
    if (readOnly) return;
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

  const handleExportCSV = () => {
    if (!editing) return;
    const supplierName = suppliers.find(s => String(s._id) === supplierId)?.name || 'Unknown';
    const csvContent = [
      ['Purchase Order Details'],
      ['Order Number', editing.orderNumber || ''],
      ['Merchant', user?.businessName || user?.tenantName || 'Merchant'],
      ['Supplier', supplierName],
      ['Expected Date', expectedDate || ''],
      ['Notes', notes || ''],
      [],
      ['Item Name', 'Quantity', 'Unit'],
      ...items.map(item => [
        item.itemName,
        item.orderedQty,
        item.unit
      ])
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PO_${editing.orderNumber || 'Export'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!editing) return;
    const supplierName = suppliers.find(s => String(s._id) === supplierId)?.name || 'Unknown';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.itemName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${item.orderedQty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.unit}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order - ${editing.orderNumber || ''}</title>
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #111; }
            .meta-info { margin-bottom: 30px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
            .meta-block h3 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #666; }
            .meta-block p { margin: 0; font-size: 16px; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f5f5f5; text-align: left; padding: 10px; font-weight: 600; border-bottom: 2px solid #ddd; }
            .notes { margin-top: 40px; padding: 15px; background: #f9f9f9; border-left: 4px solid #ccc; font-size: 14px; }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">PURCHASE ORDER</div>
              <div style="font-size: 16px; color: #666; margin-top: 5px;">Order #: ${editing.orderNumber || ''}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: bold;">${user?.businessName || user?.tenantName || 'Merchant'}</div>
              <div style="font-size: 12px; color: #666;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="meta-info">
            <div class="meta-block">
              <h3>Supplier</h3>
              <p>${supplierName}</p>
            </div>
            <div class="meta-block">
              <h3>Expected Delivery Date</h3>
              <p>${expectedDate ? new Date(expectedDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th style="text-align: right;">Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          ${notes ? `
            <div class="notes">
              <strong>Notes / Special Instructions:</strong>
              <p style="margin: 5px 0 0 0; white-space: pre-wrap;">${notes}</p>
            </div>
          ` : ''}

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const totalAmount = items.reduce((sum, item) => {
    return sum + Number(item.orderedQty || 0) * Number(item.unitPrice || 0);
  }, 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (window.innerWidth >= 640 && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {readOnly ? 'View Purchase Order' : editing ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </h2>
            {editing && (
              <p className="text-sm text-gray-500 mt-0.5">{editing.orderNumber}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier <span className="text-red-500">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isPending || readOnly}
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={14} />
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isPending || readOnly}
            />
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package size={14} />
                Items <span className="text-red-500">*</span>
              </label>
              {!readOnly && (
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
              )}
            </div>

            {items.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 text-sm border border-gray-200">
                No items added yet. Click "Add Item" or "Suggest Low Stock" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="grid grid-cols-12 gap-3">
                      {/* Inventory Item Select */}
                      <div className={readOnly ? "col-span-12 md:col-span-6" : "col-span-12 md:col-span-5"}>
                        <label className="block text-xs text-slate-500 mb-1">Item</label>
                        <InventorySearchSelect
                          value={item.inventoryItemId}
                          inventory={inventory}
                          onChange={(val) => handleItemChange(index, 'inventoryItemId', val)}
                          onAddNewClick={() => setActiveAddDrawerIndex(index)}
                          disabled={isPending || readOnly}
                        />
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
                          className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          disabled={isPending || readOnly}
                        />
                      </div>

                      {/* Unit */}
                      <div className="col-span-6 md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit</label>
                        <input
                          type="text"
                          value={item.unit}
                          readOnly
                          className="w-full bg-gray-100 border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className={readOnly ? "col-span-12 md:col-span-2" : "col-span-9 md:col-span-2"}>
                        <label className="block text-xs text-slate-500 mb-1">Unit Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          disabled={isPending || readOnly}
                        />
                      </div>

                      {/* Delete Button */}
                      {!readOnly && (
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes or special instructions..."
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400 resize-none"
              disabled={isPending || readOnly}
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
          {readOnly ? (
            <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition"
              >
                <Download size={16} />
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition"
              >
                <FileText size={16} />
                Export PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold rounded-lg transition disabled:opacity-50"
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
          )}
        </form>
      </div>
      <AddInventoryItemDrawer
        open={activeAddDrawerIndex !== null}
        onClose={() => setActiveAddDrawerIndex(null)}
        onSuccess={handleAddNewItemSuccess}
        suppliers={suppliers}
      />
    </div>
  );
}
