import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Package, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../api/axios';

/**
 * Component for managing ingredient links for a menu item.
 * Shows when editing an existing menu item.
 */
export default function IngredientsBuilder({ menuItemId, storeId }) {
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [wastagePercentage, setWastagePercentage] = useState('');
  const [addError, setAddError] = useState('');
  const qc = useQueryClient();

  // Fetch ingredient links for this menu item
  const { data: ingredientLinks = [], isPending: linksLoading } = useQuery({
    queryKey: ['ingredient-links', menuItemId],
    queryFn: () => api.get('/ingredient-links', { params: { menuItemId } }).then(r => r.data),
    enabled: !!menuItemId,
  });

  // Fetch all inventory items for the picker
  const { data: inventoryItems = [], isPending: inventoryLoading } = useQuery({
    queryKey: ['inventory', storeId],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: !!storeId,
  });

  const createLinkMutation = useMutation({
    mutationFn: (data) => api.post('/ingredient-links', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredient-links', menuItemId] });
      setSelectedInventoryId('');
      setQuantity('');
      setWastagePercentage('');
      setAddError('');
    },
    onError: (err) => setAddError(err.response?.data?.message || 'Failed to add ingredient'),
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/ingredient-links/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredient-links', menuItemId] }),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id) => api.delete(`/ingredient-links/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredient-links', menuItemId] }),
  });

  // Filter out already linked inventory items
  const linkedIds = new Set(ingredientLinks.map(l => l.inventoryItemId?._id || l.inventoryItemId));
  const availableInventory = inventoryItems.filter(i => !linkedIds.has(i._id));

  const handleAdd = () => {
    setAddError('');
    if (!selectedInventoryId) {
      setAddError('Select an inventory item');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setAddError('Quantity must be greater than 0');
      return;
    }
    createLinkMutation.mutate({
      menuItemId,
      inventoryItemId: selectedInventoryId,
      quantity: qty,
      wastagePercentage: parseFloat(wastagePercentage) || 0,
    });
  };

  const handleUpdateQuantity = (linkId, newQty) => {
    const qty = parseFloat(newQty);
    if (!isNaN(qty) && qty > 0) {
      updateLinkMutation.mutate({ id: linkId, data: { quantity: qty } });
    }
  };

  const handleUpdateWastage = (linkId, newWaste) => {
    const waste = parseFloat(newWaste);
    if (!isNaN(waste) && waste >= 0) {
      updateLinkMutation.mutate({ id: linkId, data: { wastagePercentage: waste } });
    }
  };

  const handleRemove = (linkId) => {
    deleteLinkMutation.mutate(linkId);
  };

  if (linksLoading || inventoryLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-550">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading ingredients...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Link inventory items to track ingredient usage. Quantities define how much is used per unit sold.
      </p>

      {/* Current ingredients */}
      {ingredientLinks.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-200">
          {ingredientLinks.map((link) => {
            const inv = link.inventoryItemId;
            const isLowStock = inv && inv.quantity < inv.minThreshold;
            return (
              <div key={link._id} className="flex items-center gap-2 px-3 py-2.5">
                <Package size={14} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800 font-semibold truncate">{inv?.itemName || 'Unknown'}</span>
                    {isLowStock && (
                      <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                        <AlertTriangle size={10} /> Low
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    Stock: {inv?.quantity || 0} {inv?.unit || ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Qty:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={link.quantity}
                      onChange={(e) => handleUpdateQuantity(link._id, e.target.value)}
                      className="w-16 bg-white border border-gray-305 text-gray-900 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 truncate">{link.unit || inv?.unit || ''}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Waste:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={link.wastagePercentage || 0}
                      onChange={(e) => handleUpdateWastage(link._id, e.target.value)}
                      className="w-12 bg-white border border-gray-305 text-gray-900 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(link._id)}
                    disabled={deleteLinkMutation.isPending}
                    className="p-1.5 text-gray-400 hover:text-red-650 transition disabled:opacity-50"
                    title="Remove ingredient"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ingredientLinks.length === 0 && (
        <div className="text-center py-6 text-gray-500 bg-gray-50 border border-dashed border-gray-250 rounded-xl">
          <Package size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">No ingredients linked</p>
          <p className="text-xs">Add inventory items used to make this product</p>
        </div>
      )}

      {/* Add new ingredient */}
      {availableInventory.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1 font-semibold">Inventory Item</label>
            <select
              value={selectedInventoryId}
              onChange={(e) => setSelectedInventoryId(e.target.value)}
              className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
            >
              <option value="">Select item...</option>
              {availableInventory.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.itemName} ({inv.quantity} {inv.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="w-20">
            <label className="block text-xs text-gray-500 mb-1 font-semibold">Qty Used</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-gray-500 mb-1 font-semibold">Wastage %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={wastagePercentage}
              onChange={(e) => setWastagePercentage(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={createLinkMutation.isPending}
            className="flex items-center gap-1 bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-60 text-white font-semibold px-3 py-2 rounded-lg transition text-sm h-[38px]"
          >
            {createLinkMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add
          </button>
        </div>
      ) : inventoryItems.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">
          No inventory items available. Create inventory items first under Menu & Stock → Inventory.
        </p>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">
          All inventory items are already linked to this menu item.
        </p>
      )}

      {addError && (
        <p className="text-xs text-red-650 font-semibold">{addError}</p>
      )}
    </div>
  );
}
