import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Plus, Package } from 'lucide-react';

export default function InventorySearchSelect({
  value,
  inventory = [],
  onChange,
  onAddNewClick,
  disabled = false,
  placeholder = 'Select item',
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

  // Filter inventory items by search text
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return inventory;
    return inventory.filter(item =>
      (item.itemName || '').toLowerCase().includes(q)
    );
  }, [inventory, search]);

  const selectedItem = useMemo(() => {
    return inventory.find(item => String(item._id) === String(value));
  }, [inventory, value]);

  const handleSelect = (item) => {
    onChange(item._id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        className="w-full flex items-center justify-between bg-slate-800 border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-55 disabled:cursor-not-allowed text-left transition"
      >
        <span className="truncate">
          {selectedItem ? (
            `${selectedItem.itemName} (${selectedItem.quantity} ${selectedItem.unit})`
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
              placeholder="Search items..."
              autoFocus
              className="w-full bg-transparent border-0 text-[var(--pos-text-primary)] text-xs focus:outline-none placeholder-slate-600"
            />
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto py-1 divide-y divide-slate-800/40">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                No items match your search
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-4 py-2 hover:bg-slate-700/50 transition flex items-center gap-2 text-xs ${
                    String(item._id) === String(value)
                      ? 'bg-amber-500/10 text-amber-400 font-semibold'
                      : 'text-[var(--pos-text-primary)]'
                  }`}
                >
                  <Package size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate flex-1">{item.itemName}</span>
                  <span className="text-slate-500 text-[10px] tabular-nums bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/40 shrink-0">
                    {item.quantity} {item.unit}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Add New Item Button shortcut at bottom */}
          <button
            type="button"
            onClick={() => {
              onAddNewClick();
              setIsOpen(false);
            }}
            className="w-full border-t border-slate-700 bg-slate-800/40 hover:bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            Create New Inventory Item
          </button>
        </div>
      )}
    </div>
  );
}
