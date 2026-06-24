import { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { formatCurrency } from '../utils/format';
import { useStoreContext } from '../context/StoreContext';
import { useTenantPaidAddons } from '../hooks/useTenantPaidAddons';

export default function VariantSelectorModal({ item, onClose, onConfirm, orderType, partners, getItemPrice }) {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const { data: paidAddons } = useTenantPaidAddons();
  const modifierGroupsActive = paidAddons?.modifierGroups === true;

  // 1. Variant Selections State
  const [selections, setSelections] = useState({});
  // 2. Modifiers Selections State: array of { modifierGroupId, modifierId, name, price, qty }
  const [selectedMods, setSelectedMods] = useState([]);

  useEffect(() => {
    setSelections({});
    setSelectedMods([]);
  }, [item?._id]);

  // Fetch modifier groups from server
  const { data: modifierGroups = [] } = useQuery({
    queryKey: ['modifier-groups', selectedStoreId],
    queryFn: () => api.get('/menu/modifier-groups').then((r) => r.data),
    enabled: isStoreReady && modifierGroupsActive && !!item?.modifierGroups?.length,
  });

  if (!item) return null;

  const options = item.variantOptions || [];
  const variants = item.variants || [];

  const handleSelectVariantOption = (optionName, val) => {
    setSelections((p) => ({ ...p, [optionName]: val }));
  };

  const selectedVariant = useMemo(() => {
    if (!item.hasVariants) return null;
    return variants.find((v) => {
      if (v.available === false) return false;
      return options.every((opt) => selections[opt.name] === v.attributes?.find((a) => a.name === opt.name)?.value);
    });
  }, [item.hasVariants, variants, options, selections]);

  const canConfirmVariant = !item.hasVariants || options.every((opt) => selections[opt.name] !== undefined);

  // Filter modifier groups to only those linked to this item
  const linkedGroups = useMemo(() => {
    if (!modifierGroups.length || !item?.modifierGroups?.length) return [];
    return modifierGroups.filter((g) =>
      item.modifierGroups.some((lg) => String(lg.modifierGroupId) === String(g._id))
    );
  }, [modifierGroups, item?.modifierGroups]);

  // Helper to get size-specific override price or default price
  const getModifierPrice = (groupId, optionId, defaultPrice) => {
    const link = item.modifierGroups?.find((g) => String(g.modifierGroupId) === String(groupId));
    const override = link?.overrides?.find((o) =>
      String(o.modifierId) === String(optionId) &&
      String(o.variantId || '') === String(selectedVariant?._id || '')
    );
    return override ? override.price : defaultPrice;
  };

  const handleToggleModifier = (group, opt, price) => {
    setSelectedMods((prev) => {
      const existingIdx = prev.findIndex((x) => String(x.modifierId) === String(opt._id));
      if (existingIdx !== -1) {
        return prev.filter((_, i) => i !== existingIdx);
      }

      const groupSelectedCount = prev.filter((x) => String(x.modifierGroupId) === String(group._id)).length;
      if (group.maxSelections && groupSelectedCount >= group.maxSelections) {
        if (group.maxSelections === 1) {
          // Replace selection
          return [
            ...prev.filter((x) => String(x.modifierGroupId) !== String(group._id)),
            { modifierGroupId: group._id, modifierId: opt._id, name: opt.name, price, qty: 1 },
          ];
        }
        return prev; // Block selecting if limit reached
      }

      return [...prev, { modifierGroupId: group._id, modifierId: opt._id, name: opt.name, price, qty: 1 }];
    });
  };

  // Dynamically resolve modifier prices when variant selection changes
  const finalSelectedModifiers = useMemo(() => {
    return selectedMods.map((m) => {
      const group = linkedGroups.find((g) => String(g._id) === String(m.modifierGroupId));
      const opt = group?.modifiers?.find((o) => String(o._id) === String(m.modifierId));
      const defaultPrice = opt?.price || 0;
      const price = getModifierPrice(m.modifierGroupId, m.modifierId, defaultPrice);
      return { ...m, price };
    });
  }, [selectedMods, selectedVariant, linkedGroups]);

  // Modifiers rule validations
  const validationErrors = useMemo(() => {
    const errs = {};
    linkedGroups.forEach((g) => {
      const count = selectedMods.filter((x) => String(x.modifierGroupId) === String(g._id)).length;
      if (g.minSelections > 0 && count < g.minSelections) {
        errs[g._id] = `Choose at least ${g.minSelections}`;
      } else if (g.maxSelections && count > g.maxSelections) {
        errs[g._id] = `Choose at most ${g.maxSelections}`;
      }
    });
    return errs;
  }, [linkedGroups, selectedMods]);

  const canConfirmModifiers = Object.keys(validationErrors).length === 0;

  // Total unit price: variant price + selected modifiers prices
  const baseItemPrice = selectedVariant
    ? (getItemPrice ? getItemPrice(item, selectedVariant, orderType, partners) : selectedVariant.price)
    : (getItemPrice ? getItemPrice(item, null, orderType, partners) : item.price);

  const modifiersTotalPrice = useMemo(() => {
    return finalSelectedModifiers.reduce((sum, m) => sum + m.price * (m.qty || 1), 0);
  }, [finalSelectedModifiers]);

  const totalDisplayPrice = Number(baseItemPrice || 0) + modifiersTotalPrice;

  const handleConfirm = () => {
    if (item.hasVariants && !selectedVariant) return;
    if (!canConfirmModifiers) return;
    onConfirm(item, selectedVariant, finalSelectedModifiers);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">{item.name}</h3>
            <p className="text-xs text-slate-500">Customize item selections</p>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable selections body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 no-scrollbar">
          {/* 1. Variant Options */}
          {options.map((opt) => (
            <div key={opt.name} className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{opt.name}</span>
              <div className="flex flex-wrap gap-2">
                {opt.values?.map((val) => {
                  const active = selections[opt.name] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectVariantOption(opt.name, val)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                        active
                          ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)] shadow-lg font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 2. Modifier Groups */}
          {modifierGroupsActive && linkedGroups.map((group) => {
            const error = validationErrors[group._id];
            const rulesLabel =
              group.minSelections > 0
                ? group.maxSelections === group.minSelections
                  ? `Choose exactly ${group.minSelections}`
                  : `Choose ${group.minSelections} - ${group.maxSelections || 'unlimited'}`
                : `Optional (up to ${group.maxSelections || 'unlimited'})`;

            return (
              <div key={group._id} className="space-y-2 border-t border-slate-800/60 pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {group.name}
                  </span>
                  <span className={`text-[10px] ${error ? 'text-amber-500 font-bold' : 'text-slate-500'}`}>
                    {rulesLabel} {error && `(${error})`}
                  </span>
                </div>
                {group.description && (
                  <p className="text-[11px] text-slate-500 leading-normal">{group.description}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {group.modifiers?.map((opt) => {
                    const price = getModifierPrice(group._id, opt._id, opt.price);
                    const selected = selectedMods.some((x) => String(x.modifierId) === String(opt._id));
                    return (
                      <button
                        key={opt._id}
                        type="button"
                        onClick={() => handleToggleModifier(group, opt, price)}
                        disabled={opt.available === false}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between gap-2 ${
                          selected
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : opt.available === false
                            ? 'bg-slate-800/40 border-slate-800/60 text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-slate-800 border-slate-700/80 text-slate-350 hover:border-slate-600'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate">{opt.name}</p>
                          {price > 0 && (
                            <p className="text-[10px] text-slate-500 mt-0.5 font-normal">+{formatCurrency(price)}</p>
                          )}
                        </div>
                        {selected && <Check size={14} className="shrink-0 text-amber-400" />}
                        {opt.available === false && <span className="text-[8px] uppercase tracking-wider bg-red-950/20 text-red-500 border border-red-900/20 px-1 py-0.5 rounded shrink-0">Sold Out</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected preview bar */}
        <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 flex items-center gap-3 shrink-0 mt-2">
          <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shrink-0">
            {selectedVariant?.image ? (
              <img src={selectedVariant.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
            ) : item.images?.[0]?.url || item.image ? (
              <img src={item.images?.[0]?.url || item.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🍔</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">
              {selectedVariant ? selectedVariant.name : item.name}
            </p>
            {finalSelectedModifiers.length > 0 ? (
              <p className="text-xs text-slate-500 truncate mt-0.5">
                + {finalSelectedModifiers.map((m) => m.name).join(', ')}
              </p>
            ) : (
              <p className="text-xs text-slate-500 truncate mt-0.5">{selectedVariant?.description || item.description || 'No customization'}</p>
            )}
          </div>
          <span className="text-sm font-bold text-amber-400 shrink-0">
            {formatCurrency(totalDisplayPrice)}
          </span>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-850 shrink-0 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirmVariant || !canConfirmModifiers || (item.hasVariants && !selectedVariant)}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm flex justify-center items-center cursor-pointer"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}
