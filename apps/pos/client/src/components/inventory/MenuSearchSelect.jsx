import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, UtensilsCrossed } from 'lucide-react';

export default function MenuSearchSelect({
  menuItemId,
  variantId,
  menuItems = [],
  onChange,
  disabled = false,
  placeholder = 'Select menu item',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Flatten menu items with their variants for easy listing and searching
  const flattenedOptions = useMemo(() => {
    const list = [];
    menuItems.forEach((item) => {
      if (item.hasVariants && item.variants && item.variants.length > 0) {
        item.variants.forEach((v) => {
          list.push({
            menuItemId: String(item._id),
            variantId: String(v._id),
            name: `${item.name} (${v.name})`,
            price: v.price,
            category: item.category,
          });
        });
      } else {
        list.push({
          menuItemId: String(item._id),
          variantId: null,
          name: item.name,
          price: item.price,
          category: item.category,
        });
      }
    });
    return list;
  }, [menuItems]);

  // Filter flattened options by search text
  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return flattenedOptions;
    return flattenedOptions.filter((opt) =>
      opt.name.toLowerCase().includes(q) || (opt.category || '').toLowerCase().includes(q)
    );
  }, [flattenedOptions, search]);

  const selectedOption = useMemo(() => {
    return flattenedOptions.find(
      (opt) =>
        opt.menuItemId === String(menuItemId) &&
        (variantId ? opt.variantId === String(variantId) : !opt.variantId)
    );
  }, [flattenedOptions, menuItemId, variantId]);

  const handleSelect = (opt) => {
    onChange(opt.menuItemId, opt.variantId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className="w-full flex items-center justify-between bg-slate-805 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-55 disabled:cursor-not-allowed text-left transition"
      >
        <span className="truncate">
          {selectedOption ? (
            selectedOption.name
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1.5 w-full bg-[var(--pos-panel)] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-72">
          {/* Search bar */}
          <div className="p-2 border-b border-slate-700/60 bg-slate-800/20 flex items-center gap-2">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu items..."
              autoFocus
              className="w-full bg-transparent border-0 text-[var(--pos-text-primary)] text-xs focus:outline-none placeholder-slate-600"
            />
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto py-1 divide-y divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                No items match your search
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <button
                  key={`${opt.menuItemId}-${opt.variantId || 'base'}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full text-left px-4 py-2 hover:bg-slate-700/50 transition flex items-center gap-2 text-xs ${
                    opt.menuItemId === String(menuItemId) &&
                    (variantId ? opt.variantId === String(variantId) : !opt.variantId)
                      ? 'bg-amber-500/10 text-amber-400 font-semibold'
                      : 'text-[var(--pos-text-primary)]'
                  }`}
                >
                  <UtensilsCrossed size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate flex-1">{opt.name}</span>
                  {opt.category && (
                    <span className="text-slate-500 text-[10px] bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/40 shrink-0">
                      {opt.category}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
