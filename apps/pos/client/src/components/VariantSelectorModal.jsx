import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../utils/format';

export default function VariantSelectorModal({ item, onClose, onConfirm, orderType, partners, getItemPrice }) {
  const [selections, setSelections] = useState({});

  useEffect(() => {
    setSelections({});
  }, [item?._id]);

  if (!item) return null;

  const options = item.variantOptions || [];
  const variants = item.variants || [];

  const handleSelect = (optionName, val) => {
    setSelections((p) => ({ ...p, [optionName]: val }));
  };

  const selectedVariant = variants.find((v) => {
    if (v.available === false) return false;
    return options.every((opt) => selections[opt.name] === v.attributes?.find((a) => a.name === opt.name)?.value);
  });

  const canConfirm = options.every((opt) => selections[opt.name] !== undefined);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">{item.name}</h3>
            <p className="text-xs text-slate-500">Please choose options</p>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
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
                      onClick={() => handleSelect(opt.name, val)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                        active
                          ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)] shadow-lg'
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
        </div>

        {selectedVariant ? (
          <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shrink-0">
              {selectedVariant.image ? (
                <img src={selectedVariant.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
              ) : item.images?.[0]?.url || item.image ? (
                <img src={item.images?.[0]?.url || item.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">🍔</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{selectedVariant.name}</p>
              <p className="text-xs text-slate-500 truncate">{selectedVariant.description || item.description || 'No description'}</p>
            </div>
            <span className="text-sm font-bold text-amber-400 shrink-0">
              {formatCurrency(getItemPrice ? getItemPrice(item, selectedVariant, orderType, partners) : selectedVariant.price)}
            </span>
          </div>
        ) : (
          canConfirm && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
              Selected combination is currently unavailable
            </div>
          )
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(item, selectedVariant)}
            disabled={!selectedVariant}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm flex justify-center items-center"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}
