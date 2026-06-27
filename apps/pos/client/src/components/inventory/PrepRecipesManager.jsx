import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Package, Calculator, Loader2, Save, X } from 'lucide-react';
import api from '../../api/axios';
import CenteredModal from '../CenteredModal';
import { formatCurrency } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

export default function PrepRecipesManager({ storeId }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    itemName: '',
    storageUnit: 'kg',
    recipeUnit: 'g',
    storageToRecipeMultiplier: 1000,
    recipe: [],
  });

  const [newIngredientId, setNewIngredientId] = useState('');
  const [newIngredientQty, setNewIngredientQty] = useState('');
  const [newIngredientWaste, setNewIngredientWaste] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch only prep and raw items for the store
  const { data: inventoryItems = [], isPending: itemsLoading } = useQuery({
    queryKey: ['inventory', storeId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: !!storeId,
  });

  // Filter out prep items to show in the list
  const prepItems = useMemo(() => {
    return inventoryItems.filter((i) => i.itemType === 'prep');
  }, [inventoryItems]);

  // Filter out available ingredients (exclude current editing item to prevent self-recursion)
  const availableIngredients = useMemo(() => {
    return inventoryItems.filter((i) => !editingItem || i._id !== editingItem._id);
  }, [inventoryItems, editingItem]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingItem) {
        return api.put(`/inventory/${editingItem._id}`, data);
      } else {
        return api.post('/inventory', { ...data, quantity: 0, minThreshold: 0, itemType: 'prep', unit: data.storageUnit });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast(editingItem ? 'Sub-recipe updated' : 'Sub-recipe created', 'success');
      closeModal();
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || 'Failed to save sub-recipe');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Sub-recipe deleted', 'success');
    },
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm({
      itemName: '',
      storageUnit: 'kg',
      recipeUnit: 'g',
      storageToRecipeMultiplier: 1000,
      recipe: [],
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      itemName: item.itemName,
      storageUnit: item.storageUnit || item.unit || 'kg',
      recipeUnit: item.recipeUnit || 'g',
      storageToRecipeMultiplier: item.storageToRecipeMultiplier || 1000,
      recipe: (item.recipe || []).map((r) => ({
        inventoryItemId: r.inventoryItemId?._id || r.inventoryItemId,
        quantity: r.quantity,
        wastagePercentage: r.wastagePercentage || 0,
      })),
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setNewIngredientId('');
    setNewIngredientQty('');
    setNewIngredientWaste('');
  };

  const handleAddIngredient = () => {
    if (!newIngredientId) return;
    const qty = parseFloat(newIngredientQty);
    if (isNaN(qty) || qty <= 0) return;
    const waste = parseFloat(newIngredientWaste) || 0;

    // Check duplicate
    if (form.recipe.some((r) => r.inventoryItemId === newIngredientId)) {
      showToast('Ingredient already added', 'warning');
      return;
    }

    setForm((f) => ({
      ...f,
      recipe: [
        ...f.recipe,
        {
          inventoryItemId: newIngredientId,
          quantity: qty,
          wastagePercentage: waste,
        },
      ],
    }));

    setNewIngredientId('');
    setNewIngredientQty('');
    setNewIngredientWaste('');
  };

  const handleRemoveIngredient = (idx) => {
    setForm((f) => ({
      ...f,
      recipe: f.recipe.filter((_, i) => i !== idx),
    }));
  };

  const calculateRecipeCost = (recipeArray) => {
    let total = 0;
    recipeArray.forEach((r) => {
      const match = inventoryItems.find((i) => i._id === r.inventoryItemId);
      if (match) {
        // Cost of 1 unit of ingredient * quantity used * wastage multiplier
        const costPerUnit = match.wacCost || match.lastCost || 0;
        const storageToRecipe = match.storageToRecipeMultiplier || 1;
        const ingredientStorageQty = r.quantity / storageToRecipe;
        const itemCost = costPerUnit * ingredientStorageQty * (1 + r.wastagePercentage / 100);
        total += itemCost;
      }
    });
    return total;
  };

  const recipeCost = useMemo(() => calculateRecipeCost(form.recipe), [form.recipe, inventoryItems]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.itemName.trim()) {
      setFormError('Sub-recipe name is required');
      return;
    }
    if (form.recipe.length === 0) {
      setFormError('At least one ingredient is required');
      return;
    }

    saveMutation.mutate({
      itemName: form.itemName.trim(),
      storageUnit: form.storageUnit,
      recipeUnit: form.recipeUnit,
      storageToRecipeMultiplier: Number(form.storageToRecipeMultiplier) || 1,
      recipe: form.recipe,
    });
  };

  if (itemsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading sub-recipes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Prepared Items & Sub-Recipes</h4>
          <p className="text-xs text-gray-500">Define batch components (e.g. Burger Sauce) to recursively track nested stock usage.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition"
        >
          <Plus size={14} /> Add Sub-Recipe
        </button>
      </div>

      {/* Grid listing */}
      {prepItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <Package size={36} className="mx-auto opacity-35 mb-2" />
          <p className="text-sm">No sub-recipes configured yet</p>
          <button type="button" onClick={openCreate} className="text-xs text-amber-600 font-semibold underline mt-1">
            Create your first prep recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prepItems.map((item) => {
            const cost = calculateRecipeCost(item.recipe || []);
            return (
              <div key={item._id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h5 className="font-bold text-gray-900 text-sm truncate">{item.itemName}</h5>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Storage: 1 {item.storageUnit} = {item.storageToRecipeMultiplier} {item.recipeUnit}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-1.5 bg-gray-55 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-950 border border-gray-200"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(item._id)}
                        className="p-1.5 bg-gray-55 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-655 border border-gray-200"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Cost Summary */}
                  <div className="mt-3 bg-amber-50/50 border border-amber-100/50 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <span className="text-amber-800 font-medium flex items-center gap-1">
                      <Calculator size={13} /> Cost Price:
                    </span>
                    <span className="font-bold text-amber-700">
                      {formatCurrency(cost)} / {item.storageUnit}
                    </span>
                  </div>

                  {/* Recipe Details Preview */}
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ingredients</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {item.recipe?.map((r, idx) => {
                        const subName = inventoryItems.find((i) => i._id === (r.inventoryItemId?._id || r.inventoryItemId))?.itemName || 'Unknown';
                        return (
                          <div key={idx} className="flex justify-between items-center text-xs text-gray-600">
                            <span className="truncate">{subName}</span>
                            <span className="font-medium shrink-0">
                              {r.quantity} {inventoryItems.find((i) => i._id === (r.inventoryItemId?._id || r.inventoryItemId))?.recipeUnit || 'unit'}
                              {r.wastagePercentage > 0 && ` (+${r.wastagePercentage}%)`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <CenteredModal
        open={modalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit Sub-Recipe' : 'Create Sub-Recipe'}
        maxWidth="max-w-xl"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="prep-recipe-form"
              disabled={saveMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-1"
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving…' : 'Save Recipe'}
            </button>
          </div>
        }
      >
        <form id="prep-recipe-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sub-Recipe Name *</label>
            <input
              type="text"
              value={form.itemName}
              onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
              placeholder="e.g. Secret Burger Sauce"
              required
              className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-550 mb-1">Storage Unit</label>
              <input
                type="text"
                value={form.storageUnit}
                onChange={(e) => setForm((f) => ({ ...f, storageUnit: e.target.value }))}
                placeholder="e.g. kg, L"
                required
                className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-550 mb-1">Recipe Unit</label>
              <input
                type="text"
                value={form.recipeUnit}
                onChange={(e) => setForm((f) => ({ ...f, recipeUnit: e.target.value }))}
                placeholder="e.g. g, ml"
                required
                className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-550 mb-1">Storage $\rightarrow$ Recipe Factor</label>
              <input
                type="number"
                value={form.storageToRecipeMultiplier}
                onChange={(e) => setForm((f) => ({ ...f, storageToRecipeMultiplier: Math.max(1, parseFloat(e.target.value) || 1) }))}
                placeholder="e.g. 1000"
                required
                className="w-full bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
              />
            </div>
          </div>

          {/* Recipe Ingredients Builder */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-4">
            <div className="flex justify-between items-center">
              <h5 className="text-xs font-bold text-amber-600 uppercase tracking-wide">Recipe Ingredients</h5>
              <div className="text-xs font-bold text-gray-700 bg-amber-100/50 border border-amber-200/55 rounded-lg px-2.5 py-1">
                Cost: {formatCurrency(recipeCost)} / {form.storageUnit}
              </div>
            </div>

            {/* List */}
            {form.recipe.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {form.recipe.map((r, idx) => {
                  const match = inventoryItems.find((i) => i._id === r.inventoryItemId);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 rounded-xl p-2 shadow-sm text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-gray-800 block truncate">{match?.itemName || 'Unknown'}</span>
                        <span className="text-[10px] text-gray-400">
                          Cost: {formatCurrency(match?.wacCost || match?.lastCost || 0)} / {match?.storageUnit || match?.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-gray-700">
                          {r.quantity} {match?.recipeUnit || 'unit'}
                          {r.wastagePercentage > 0 && ` (+${r.wastagePercentage}%)`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-gray-400 hover:text-red-655 p-1 ml-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2 text-center bg-white border border-dashed border-gray-250 rounded-xl">
                Add ingredients (raw materials or other preps) below.
              </p>
            )}

            {/* Inputs */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Select Ingredient</label>
                <select
                  value={newIngredientId}
                  onChange={(e) => setNewIngredientId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Select...</option>
                  {availableIngredients.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.itemName} ({inv.recipeUnit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Qty Used</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newIngredientQty}
                  onChange={(e) => setNewIngredientQty(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                />
              </div>
              <div className="w-16">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Waste %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newIngredientWaste}
                  onChange={(e) => setNewIngredientWaste(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                />
              </div>
              <button
                type="button"
                onClick={handleAddIngredient}
                disabled={!newIngredientId || !newIngredientQty}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg transition text-xs shrink-0 h-[30px]"
              >
                Add
              </button>
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-750 rounded-xl px-4 py-3 text-xs font-semibold">
              {formError}
            </div>
          )}
        </form>
      </CenteredModal>
    </div>
  );
}
