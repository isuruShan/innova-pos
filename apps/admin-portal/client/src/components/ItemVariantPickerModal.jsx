import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

/**
 * Reusable variant picker modal for admin portal promotions, loyalty rewards, etc.
 * Uses standard light theme colors.
 * 
 * @param {Object} item - Menu item with variants data
 * @param {function} onClose - Close handler
 * @param {function} onSelect - (item, variant) => void - called when variant is confirmed (variant is null if selecting entire product)
 * @param {string} title - Optional custom title
 * @param {boolean} allowAllVariants - If true, displays a button to select all variants
 */
export default function ItemVariantPickerModal({ item, onClose, onSelect, title, allowAllVariants = false }) {
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
    if (v.available === false) return false;
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">
              {title || 'Select Variant'}
            </h3>
            <p className="text-sm text-brand-orange truncate font-medium">{item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">
          {options.map((opt) => (
            <div key={opt.name} className="space-y-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
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
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        active
                          ? 'bg-brand-orange border-brand-orange text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
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
        <div className="border-t border-gray-200 p-4 bg-gray-50 shrink-0 space-y-3">
          {selectedVariant ? (
            <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                {selectedVariant.image ? (
                  <img src={selectedVariant.image} alt="" className="w-full h-full object-cover" />
                ) : item.images?.[0]?.url || item.image ? (
                  <img src={item.images?.[0]?.url || item.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl bg-gray-50">🍔</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {selectedVariant.name || item.name}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedVariant.attributes?.map((a) => a.value).join(' / ')}
                </p>
              </div>
              <span className="text-brand-orange font-bold shrink-0">
                {selectedVariant.price != null ? `Rs. ${Number(selectedVariant.price).toLocaleString()}` : ''}
              </span>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-sm text-gray-400">Select all options to see variant details</p>
            </div>
          )}

          {allowAllVariants && (
            <button
              type="button"
              onClick={() => {
                onSelect?.(item, null);
                onClose?.();
              }}
              className="w-full py-2 bg-white hover:bg-gray-50 text-brand-orange border border-gray-300 font-semibold rounded-lg transition flex items-center justify-center gap-2 text-xs"
            >
              Select Entire Product (All Variants)
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange/95 disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 text-sm"
          >
            <Check size={18} />
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
