import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Edit2, Trash2, ShieldAlert, ToggleLeft, ToggleRight, 
  Settings2, Eye, ShieldCheck, HelpCircle, PackageOpen, Layers, X,
  Loader2, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/format';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';
import CenteredModal from '../CenteredModal';
import ConfirmDialog from '../ConfirmDialog';
import Toast from '../Toast';

const EMPTY_GROUP_FORM = {
  name: '',
  description: '',
  minSelections: 0,
  maxSelections: '', // Empty string means unlimited
  modifiers: []
};

export default function ModifierGroupsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();
  const { currencySymbol } = useTenantCurrency();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const { data: paidAddons, isPending: addonsLoading } = useTenantPaidAddons();

  const isAddonActive = paidAddons?.modifierGroups === true;

  // State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form, setForm] = useState(EMPTY_GROUP_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ingredientModalTarget, setIngredientModalTarget] = useState(null);

  // Modifiers input state inside form modal
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState('');

  // 1. Fetch Modifier Groups
  const { data: modifierGroups = [], isPending: groupsLoading } = useQuery({
    queryKey: ['modifier-groups', selectedStoreId],
    queryFn: () => api.get('/menu/modifier-groups').then((r) => r.data),
    enabled: isStoreReady && isAddonActive,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/menu/modifier-groups', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups', selectedStoreId] });
      showToast('Modifier group created successfully!', 'success');
      closeModal();
    },
    onError: (err) => {
      setFormError(getApiErrorMessage(err, 'Failed to create modifier group'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/menu/modifier-groups/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups', selectedStoreId] });
      showToast('Modifier group updated successfully!', 'success');
      closeModal();
    },
    onError: (err) => {
      setFormError(getApiErrorMessage(err, 'Failed to update modifier group'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/menu/modifier-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modifier-groups', selectedStoreId] });
      showToast('Modifier group deleted successfully!', 'success');
      setDeleteTarget(null);
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to delete modifier group'), 'error');
      setDeleteTarget(null);
    }
  });

  // Modal handlers
  const openCreate = () => {
    setEditingGroup(null);
    setForm(EMPTY_GROUP_FORM);
    setFormError('');
    setNewOptionName('');
    setNewOptionPrice('');
    setModalOpen(true);
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setForm({
      name: group.name,
      description: group.description || '',
      minSelections: group.minSelections || 0,
      maxSelections: group.maxSelections === null ? '' : group.maxSelections,
      modifiers: (group.modifiers || []).map(m => ({ ...m }))
    });
    setFormError('');
    setNewOptionName('');
    setNewOptionPrice('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingGroup(null);
    setForm(EMPTY_GROUP_FORM);
    setFormError('');
  };

  // Modifier options sub-form builders
  const handleAddOption = () => {
    if (!newOptionName.trim()) return;
    const price = parseFloat(newOptionPrice) || 0;
    if (price < 0) return;

    setForm(f => ({
      ...f,
      modifiers: [
        ...f.modifiers,
        {
          name: newOptionName.trim(),
          price,
          available: true
        }
      ]
    }));
    setNewOptionName('');
    setNewOptionPrice('');
  };

  const handleRemoveOption = (index) => {
    setForm(f => ({
      ...f,
      modifiers: f.modifiers.filter((_, i) => i !== index)
    }));
  };

  const handleToggleOptionAvailable = (index) => {
    setForm(f => ({
      ...f,
      modifiers: f.modifiers.map((m, i) => i === index ? { ...m, available: !m.available } : m)
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }

    const min = parseInt(form.minSelections, 10) || 0;
    const maxVal = form.maxSelections === '' ? null : parseInt(form.maxSelections, 10);

    if (maxVal !== null && maxVal < min) {
      setFormError('Maximum selections cannot be less than minimum selections');
      return;
    }

    if (form.modifiers.length === 0) {
      setFormError('At least one modifier option is required');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      minSelections: min,
      maxSelections: maxVal,
      modifiers: form.modifiers
    };

    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Rendering Helper
  const getRulesLabel = (min, max) => {
    if (min === 0 && (max === null || max === undefined || max === '')) {
      return 'Optional (Unlimited choices)';
    }
    if (min === 1 && max === 1) {
      return 'Required (Exactly 1 choice)';
    }
    if (min > 0 && max === min) {
      return `Required (Choose exactly ${min})`;
    }
    if (min > 0 && max) {
      return `Required (Choose between ${min} and ${max})`;
    }
    if (min > 0) {
      return `Required (Choose at least ${min})`;
    }
    return `Optional (Choose up to ${max})`;
  };

  // Addon subscription lock screen
  if (!addonsLoading && !isAddonActive) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-lg mx-auto text-center space-y-6 shadow-md mt-8">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-250">
          <Layers className="text-brand-orange animate-pulse" size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900">Unlock Modifier Groups</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Configure customizable choices (toppings, sizes, prep styles) and map options directly to inventory ingredients for automated stock depletion and pricing adjustments.
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/50 flex items-start gap-3 text-left">
          <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-gray-650 space-y-1">
            <p className="font-semibold text-gray-800">Subscription Required</p>
            <p>You can activate a 7-day free trial or subscribe to Modifier Groups inside the Add-ons catalog page.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/addons')}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition text-sm shadow-md cursor-pointer"
        >
          Go to Add-ons Catalog
        </button>
      </div>
    );
  }

  const loading = addonsLoading || groupsLoading;

  const modalFooter = (
    <div className="flex gap-3">
      <button type="button" onClick={closeModal}
        className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm">
        Cancel
      </button>
      <button type="submit" form="modifier-group-form" disabled={createMutation.isPending || updateMutation.isPending}
        className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm">
        {createMutation.isPending || updateMutation.isPending ? 'Saving…' : editingGroup ? 'Save Changes' : 'Create Group'}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-gray-900">Customizer Modifier Groups</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage selection presets and add-on pricing options for items.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
        >
          <Plus size={14} /> Add Modifier Group
        </button>
      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 font-semibold animate-pulse">
          Loading modifier groups...
        </div>
      ) : modifierGroups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <PackageOpen size={36} className="mx-auto opacity-35 mb-2" />
          <p className="text-sm">No modifier groups created yet</p>
          <button type="button" onClick={openCreate} className="text-xs text-amber-600 font-semibold underline mt-2">
            Create your first group now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modifierGroups.map((group) => (
            <div key={group._id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm truncate" title={group.name}>{group.name}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-semibold uppercase tracking-wide">
                      {getRulesLabel(group.minSelections, group.maxSelections)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => openEdit(group)}
                      className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 border border-gray-200 transition">
                      <Edit2 size={13} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(group)}
                      className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-650 border border-gray-200 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {group.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{group.description}</p>
                )}

                {/* Modifier options list preview */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Modifier Options</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar py-0.5">
                    {group.modifiers?.map((mod, idx) => (
                      <span key={idx} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        mod.available !== false 
                          ? 'bg-gray-50 text-gray-700 border-gray-200' 
                          : 'bg-red-50 text-red-500 border-red-100 opacity-60'
                      }`}>
                        {mod.name}
                        <span className="text-[10px] text-gray-400 font-normal">
                          (+{formatCurrency(mod.price)})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <CenteredModal
        open={modalOpen}
        onClose={closeModal}
        title={editingGroup ? 'Edit Modifier Group' : 'Create Modifier Group'}
        maxWidth="max-w-xl"
        footer={modalFooter}
      >
        <form id="modifier-group-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Group Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Pizza Toppings, Sugar Level"
              required
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Choose extra toppings for your pizza"
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Min Selections *</label>
              <input
                type="number"
                min="0"
                value={form.minSelections}
                onChange={(e) => setForm(f => ({ ...f, minSelections: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                required
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">Set to 0 if selection is optional.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Max Selections</label>
              <input
                type="number"
                min="0"
                value={form.maxSelections}
                onChange={(e) => setForm(f => ({ ...f, maxSelections: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                placeholder="Unlimited"
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">Leave blank for unlimited selections.</p>
            </div>
          </div>

          {/* Options sub-builder */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-4">
            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide">Modifier Options (Choices)</h4>
            
            {/* Options list */}
            {form.modifiers.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {form.modifiers.map((mod, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-2.5 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-gray-800 block truncate">{mod.name}</span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        +{currencySymbol} {formatCurrency(mod.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mod._id ? (
                        <button
                          type="button"
                          onClick={() => setIngredientModalTarget(mod)}
                          className="flex items-center gap-1 text-[10px] font-bold text-purple-650 hover:underline border border-purple-200 hover:border-purple-350 px-2 py-1 rounded-lg hover:bg-purple-50 transition cursor-pointer mr-1"
                        >
                          <Settings2 size={12} />
                          Ingredients
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic mr-1">Save to link ingredients</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleOptionAvailable(idx)}
                        className={`flex items-center gap-0.5 text-[10px] font-semibold transition ${mod.available !== false ? 'text-green-600' : 'text-gray-450'}`}
                      >
                        {mod.available !== false ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        {mod.available !== false ? 'Available' : 'Out of Stock'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-gray-400 hover:text-red-650 transition ml-2"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2 text-center bg-white border border-dashed border-gray-250 rounded-xl">
                Add at least one option (e.g. Cheddar Cheese) below.
              </p>
            )}

            {/* Input fields to add option */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Option Name</label>
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  placeholder="e.g. Cheddar Cheese"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-400"
                />
              </div>
              <div className="w-28">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Extra Price ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newOptionPrice}
                  onChange={(e) => setNewOptionPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-400 text-right"
                />
              </div>
              <button
                type="button"
                onClick={handleAddOption}
                disabled={!newOptionName.trim()}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg transition text-xs shrink-0 h-[30px]"
              >
                Add Option
              </button>
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-750 rounded-xl px-4 py-3 text-sm font-semibold">{formError}</div>
          )}
        </form>
      </CenteredModal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Modifier Group"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This will unlink it from any menu items.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast toast={toast} onDismiss={clearToast} />

      {ingredientModalTarget && (
        <ModifierIngredientsModal
          open={!!ingredientModalTarget}
          onClose={() => setIngredientModalTarget(null)}
          modifier={ingredientModalTarget}
          storeId={selectedStoreId}
        />
      )}
    </div>
  );
}

function ModifierIngredientsModal({ open, onClose, modifier, storeId }) {
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [wastagePercentage, setWastagePercentage] = useState('');
  const [addError, setAddError] = useState('');
  const qc = useQueryClient();

  // Fetch ingredient links for this modifier option (menuItemId is null/empty for global modifier link)
  const { data: ingredientLinks = [], isPending: linksLoading } = useQuery({
    queryKey: ['ingredient-links-modifier', modifier?._id],
    queryFn: () => api.get('/ingredient-links', { params: { modifierId: modifier?._id, menuItemId: 'null' } }).then(r => r.data),
    enabled: !!modifier?._id,
  });

  // Fetch all inventory items for the picker
  const { data: inventoryItems = [], isPending: inventoryLoading } = useQuery({
    queryKey: ['inventory', storeId],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: open && !!storeId,
  });

  const createLinkMutation = useMutation({
    mutationFn: (data) => api.post('/ingredient-links', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredient-links-modifier', modifier?._id] });
      setSelectedInventoryId('');
      setQuantity('');
      setWastagePercentage('');
      setAddError('');
    },
    onError: (err) => setAddError(err.response?.data?.message || 'Failed to add ingredient'),
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/ingredient-links/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredient-links-modifier', modifier?._id] }),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id) => api.delete(`/ingredient-links/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredient-links-modifier', modifier?._id] }),
  });

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
      modifierId: modifier?._id,
      menuItemId: null,
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

  const footer = (
    <button type="button" onClick={onClose}
      className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm">
      Close
    </button>
  );

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      title={`Ingredients for "${modifier?.name}"`}
      maxWidth="max-w-xl"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Link inventory ingredients that are consumed when this modifier choice is selected.
        </p>

        {linksLoading || inventoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-550">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading ingredients...
          </div>
        ) : (
          <>
            {/* Current ingredients */}
            {ingredientLinks.length > 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-200 shadow-sm">
                {ingredientLinks.map((link) => {
                  const inv = link.inventoryItemId;
                  return (
                    <div key={link._id} className="flex items-center gap-2 px-3 py-2.5">
                      <PackageOpen size={14} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-800 font-semibold truncate block">{inv?.itemName || 'Unknown'}</span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">
                          Stock: {inv?.quantity || 0} {inv?.unit || ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-555">Qty:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={link.quantity}
                            onChange={(e) => handleUpdateQuantity(link._id, e.target.value)}
                            className="w-16 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-0.5 text-xs text-right focus:outline-none shadow-sm"
                          />
                        </div>
                        <span className="text-[10px] text-gray-655 w-8 truncate font-medium">{link.unit || inv?.unit || ''}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-555">Waste:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={link.wastagePercentage || 0}
                            onChange={(e) => handleUpdateWastage(link._id, e.target.value)}
                            className="w-12 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-0.5 text-xs text-right focus:outline-none shadow-sm"
                          />
                          <span className="text-[10px] text-gray-555">%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(link._id)}
                          disabled={deleteLinkMutation.isPending}
                          className="p-1 text-gray-455 hover:text-red-655 transition disabled:opacity-50"
                          title="Remove ingredient"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 bg-gray-50 border border-dashed border-gray-250 rounded-xl text-xs">
                <PackageOpen size={24} className="mx-auto mb-2 opacity-50 text-gray-400" />
                <p className="font-semibold">No ingredients linked yet</p>
              </div>
            )}

            {/* Add new ingredient */}
            {availableInventory.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] text-gray-500 font-bold mb-1">Inventory Item</label>
                  <select
                    value={selectedInventoryId}
                    onChange={(e) => setSelectedInventoryId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                  <label className="block text-[10px] text-gray-500 font-bold mb-1">Qty Used</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-[10px] text-gray-500 font-bold mb-1">Waste %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={wastagePercentage}
                    onChange={(e) => setWastagePercentage(e.target.value)}
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={createLinkMutation.isPending || !selectedInventoryId}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg transition text-xs shrink-0 h-[30px]"
                >
                  {createLinkMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
                </button>
              </div>
            ) : inventoryItems.length === 0 ? (
              <p className="text-[10px] text-gray-500 text-center py-1">
                Create inventory items first under Menu & Stock → Inventory.
              </p>
            ) : (
              <p className="text-[10px] text-gray-500 text-center py-1">
                All inventory items are linked.
              </p>
            )}

            {addError && (
              <p className="text-xs text-red-655 font-semibold mt-2">{addError}</p>
            )}
          </>
        )}
      </div>
    </CenteredModal>
  );
}
