import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { formatCurrency } from '../utils/format';

/**
 * Reusable variant picker modal for selecting a specific variant of a menu item.
 * Used in combo building, promotions, loyalty rewards, etc.
 * 
 * @param {Object} item - Menu item with variants data
 * @param {function} onClose - Close handler
 * @param {function} onSelect - (item, variant) => void - called when variant is confirmed
 * @param {string} title - Optional custom title
 */
export default function ItemVariantPickerModal({ item, onClose, onSelect, title }) {
  const [selections, setSelections] = useState({});

  // Reset selections when item changes
  useEffect(() => {
    setSelections({});
  }, [item?._id]);

  if (!item) return null;

  const options = item.variantOptions || [];
  const variants = item.variants || [];

  const handleSelect = (optionName, val) => {
    setSelections((p) => ({ ...p, [optionName]: val }));
  };

  // Find variant matching current selections
  const selectedVariant = variants.find((v) => {
    if (!v.available) return false;
    return options.every(
      (opt) => selections[opt.name] === v.attributes?.find((a) => a.name === opt.name)?.value
    );
  });

  const canConfirm = options.every((opt) => selections[opt.name] !== undefined) && selectedVariant;

  const handleConfirm = () => {
    if (selectedVariant) {
      onSelect?.(item, selectedVariant);
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">
              {title || 'Select Variant'}
            </h3>
            <p className="text-sm text-amber-400 truncate">{item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">
          {options.map((opt) => (
            <div key={opt.name} className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {opt.name}
              </span>
              <div className="flex flex-wrap gap-2">
                {opt.values?.map((val) => {
                  const active = selections[opt.name] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelect(opt.name, val)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                        active
                          ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)] shadow-lg'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected variant preview & confirm */}
        <div className="border-t border-slate-700/60 p-4 shrink-0 space-y-3">
          {selectedVariant ? (
            <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                {selectedVariant.image ? (
                  <img src={selectedVariant.image} alt="" className="w-full h-full object-cover" />
                ) : item.images?.[0]?.url || item.image ? (
                  <img src={item.images?.[0]?.url || item.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🍔</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--pos-text-primary)] truncate">
                  {selectedVariant.name || item.name}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedVariant.attributes?.map((a) => a.value).join(' / ')}
                </p>
              </div>
              <span className="text-amber-400 font-bold shrink-0">
                {formatCurrency(selectedVariant.price)}
              </span>
            </div>
          ) : (
            <div className="bg-[var(--pos-surface-inset)] rounded-xl p-4 border border-slate-800 text-center">
              <p className="text-sm text-slate-500">Select all options to see variant</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-[var(--pos-selection-text)] font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
