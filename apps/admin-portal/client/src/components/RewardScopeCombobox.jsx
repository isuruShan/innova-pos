import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Search + dropdown (categories + products). Selected scope shown only as tags below the search.
 */
export default function RewardScopeCombobox({
  menuItems = [],
  isStoreReady,
  categoryNames = [],
  itemIds = [],
  itemNames = [],
  onPatch,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const categoryList = useMemo(() => {
    const s = new Set();
    menuItems.forEach((m) => {
      if (m.category) s.add(m.category);
    });
    return [...s].sort();
  }, [menuItems]);

  const q = search.trim().toLowerCase();
  const matchCats = categoryList.filter((c) => c.toLowerCase().includes(q));
  const matchItems = menuItems.filter((m) => {
    const name = (m.name || '').toLowerCase();
    const cat = (m.category || '').toLowerCase();
    return name.includes(q) || cat.includes(q);
  });

  const showDrop = open && q.length > 0 && (matchCats.length > 0 || matchItems.length > 0);
  const showNoResults = open && q.length > 0 && matchCats.length === 0 && matchItems.length === 0;

  const selectCategory = (name) => {
    const next = categoryNames.includes(name)
      ? categoryNames.filter((c) => c !== name)
      : [...categoryNames, name];
    onPatch({ applicableCategories: next });
    setSearch('');
    setOpen(false);
  };

  const selectItem = (m) => {
    const ids = itemIds || [];
    const names = itemNames || [];
    const idx = ids.findIndex((id) => String(id) === String(m._id));
    let nextIds;
    let nextNames;
    if (idx >= 0) {
      nextIds = ids.filter((_, i) => i !== idx);
      nextNames = names.filter((_, i) => i !== idx);
    } else {
      nextIds = [...ids, m._id];
      nextNames = [...names, m.name];
    }
    onPatch({ applicableItems: nextIds, applicableItemNames: nextNames });
    setSearch('');
    setOpen(false);
  };

  const removeCategory = (name) =>
    onPatch({ applicableCategories: categoryNames.filter((c) => c !== name) });

  const removeItem = (id) => {
    const idx = itemIds.findIndex((i) => String(i) === String(id));
    if (idx < 0) return;
    onPatch({
      applicableItems: itemIds.filter((_, i) => i !== idx),
      applicableItemNames: itemNames.filter((_, i) => i !== idx),
    });
  };

  const totalSelected = categoryNames.length + itemIds.length;

  if (!isStoreReady) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Select a store in the header to attach menu items to this reward.
      </p>
    );
  }
  if (!menuItems.length) {
    return <p className="text-xs text-gray-500">No menu items for this store yet.</p>;
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:border-brand-teal focus-within:ring-1 focus-within:ring-brand-teal/30 transition">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search categories or products…"
            className="flex-1 bg-transparent text-gray-900 text-sm focus:outline-none placeholder-gray-400"
          />
          {search ? (
            <button
              type="button"
              onMouseDown={() => {
                setSearch('');
                setOpen(false);
              }}
              className="p-0.5 rounded text-gray-500 hover:text-gray-800"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {showDrop && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {matchCats.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  Categories
                </div>
                {matchCats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={() => selectCategory(c)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition"
                  >
                    <span className="text-base leading-none">📁</span>
                    <span
                      className={
                        categoryNames.includes(c) ? 'text-brand-teal font-medium' : 'text-gray-800'
                      }
                    >
                      {c}
                    </span>
                    {categoryNames.includes(c) ? (
                      <span className="ml-auto text-brand-teal text-xs">✓</span>
                    ) : null}
                  </button>
                ))}
              </>
            )}
            {matchItems.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  Products
                </div>
                {matchItems.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onMouseDown={() => selectItem(m)}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition"
                  >
                    <span className="text-base leading-none">🍔</span>
                    <span
                      className={
                        itemIds.some((id) => String(id) === String(m._id))
                          ? 'text-brand-teal font-medium'
                          : 'text-gray-800'
                      }
                    >
                      {m.name}
                    </span>
                    {m.category ? <span className="text-xs text-gray-500">{m.category}</span> : null}
                    {itemIds.some((id) => String(id) === String(m._id)) ? (
                      <span className="ml-auto text-brand-teal text-xs">✓</span>
                    ) : null}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {showNoResults ? (
          <p className="text-xs text-gray-500 mt-1.5 px-0.5">No categories or products match.</p>
        ) : null}
      </div>

      {totalSelected > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {categoryNames.map((c) => (
            <span
              key={`cat-${c}`}
              className="inline-flex items-center gap-1 bg-brand-teal/10 border border-brand-teal/30 text-brand-teal text-xs px-2.5 py-1 rounded-full"
            >
              📁 {c}
              <button
                type="button"
                onClick={() => removeCategory(c)}
                className="ml-0.5 hover:text-gray-900 leading-none"
                aria-label={`Remove ${c}`}
              >
                ×
              </button>
            </span>
          ))}
          {itemIds.map((id, i) => (
            <span
              key={`item-${String(id)}`}
              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-800 text-xs px-2.5 py-1 rounded-full"
            >
              {itemNames[i] ?? 'Item'}
              <button
                type="button"
                onClick={() => removeItem(id)}
                className="ml-0.5 hover:text-gray-950 leading-none"
                aria-label="Remove item"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Nothing selected — applies to the whole order when discount type allows.
        </p>
      )}
    </div>
  );
}
