import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import ItemVariantPickerModal from './ItemVariantPickerModal';

/**
 * Search + dropdown (categories + products). Selected scope shown only as tags below the search.
 */
export default function RewardScopeCombobox({
  menuItems = [],
  isStoreReady,
  categoryNames = [],
  itemIds = [],
  itemNames = [],
  applicableVariantIds = [],
  onPatch,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [variantPickerItem, setVariantPickerItem] = useState(null);
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
      const cat = m.category?.name || m.category;
      if (cat && typeof cat === 'string') s.add(cat);
    });
    return [...s].sort();
  }, [menuItems]);

  const q = search.trim().toLowerCase();
  const matchCats = categoryList.filter((c) => c.toLowerCase().includes(q));
  const matchItems = menuItems.filter((m) => {
    const name = (m.name || '').toLowerCase();
    const cat = (m.category?.name || m.category || '').toLowerCase();
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

  const selectItem = (m, variant = null) => {
    const ids = itemIds || [];
    const names = itemNames || [];
    const varIds = applicableVariantIds || [];

    let nextIds, nextNames, nextVarIds;

    if (variant) {
      const displayName = `${m.name} (${variant.attributes?.map(a => a.value).join(' / ') || variant.name})`;
      const existingIdx = varIds.findIndex((vid, idx) => String(vid) === String(variant._id) && String(ids[idx]) === String(m._id));
      if (existingIdx >= 0) {
        nextIds = ids.filter((_, i) => i !== existingIdx);
        nextNames = names.filter((_, i) => i !== existingIdx);
        nextVarIds = varIds.filter((_, i) => i !== existingIdx);
      } else {
        nextIds = [...ids, m._id];
        nextNames = [...names, displayName];
        nextVarIds = [...varIds, variant._id];
      }
    } else {
      const existingIdx = ids.findIndex((id, idx) => String(id) === String(m._id) && !varIds[idx]);
      if (existingIdx >= 0) {
        nextIds = ids.filter((_, i) => i !== existingIdx);
        nextNames = names.filter((_, i) => i !== existingIdx);
        nextVarIds = varIds.filter((_, i) => i !== existingIdx);
      } else {
        nextIds = [...ids, m._id];
        nextNames = [...names, m.name];
        nextVarIds = [...varIds, null];
      }
    }

    onPatch({
      applicableItems: nextIds,
      applicableItemNames: nextNames,
      applicableVariantIds: nextVarIds,
    });
    setSearch('');
    setOpen(false);
  };

  const removeCategory = (name) =>
    onPatch({ applicableCategories: categoryNames.filter((c) => c !== name) });

  const removeItemAt = (index) => {
    onPatch({
      applicableItems: itemIds.filter((_, i) => i !== index),
      applicableItemNames: itemNames.filter((_, i) => i !== index),
      applicableVariantIds: (applicableVariantIds || []).filter((_, i) => i !== index),
    });
  };

  const handleItemClick = (m) => {
    if (m.hasVariants && m.variants?.length > 0) {
      setVariantPickerItem(m);
      setOpen(false);
    } else {
      selectItem(m, null);
    }
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
                {matchItems.map((m) => {
                  const isSelected = itemIds.some((id) => String(id) === String(m._id));
                  return (
                    <button
                      key={m._id}
                      type="button"
                      onMouseDown={() => handleItemClick(m)}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition"
                    >
                      <span className="text-base leading-none">🍔</span>
                      <span
                        className={
                          isSelected ? 'text-brand-teal font-medium' : 'text-gray-800'
                        }
                      >
                        {m.name}
                      </span>
                      {m.hasVariants && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-500/20 font-semibold shrink-0 flex items-center gap-0.5">
                          🔸 Variants
                        </span>
                      )}
                      {m.category ? <span className="text-xs text-gray-500">{m.category?.name || m.category}</span> : null}
                      {isSelected ? (
                        <span className="ml-auto text-brand-teal text-xs">✓</span>
                      ) : null}
                    </button>
                  );
                })}
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
          {itemIds.map((id, i) => {
            const hasVariant = applicableVariantIds && applicableVariantIds[i];
            const item = menuItems.find(m => String(m._id) === String(id));
            return (
              <span
                key={`item-${String(id)}-${i}`}
                className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-800 text-xs px-2.5 py-1 rounded-full"
              >
                {hasVariant && <span className="text-blue-600">🔸</span>}
                {itemNames[i] ?? 'Item'}
                {hasVariant && item?.hasVariants && (
                  <button
                    type="button"
                    onClick={() => {
                      setVariantPickerItem({ ...item, _replaceIndex: i });
                    }}
                    className="text-brand-orange hover:text-brand-orange/80 underline text-[10px]"
                  >
                    change
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeItemAt(i)}
                  className="ml-0.5 hover:text-gray-950 leading-none"
                  aria-label="Remove item"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Nothing selected — applies to the whole order when discount type allows.
        </p>
      )}

      {variantPickerItem && (
        <ItemVariantPickerModal
          item={variantPickerItem}
          onClose={() => setVariantPickerItem(null)}
          onSelect={(item, variant) => {
            if (variantPickerItem._replaceIndex !== undefined) {
              // Replace existing variant
              const idx = variantPickerItem._replaceIndex;
              const displayName = `${item.name} (${variant.attributes?.map(a => a.value).join(' / ') || variant.name})`;
              const nextIds = [...itemIds];
              const nextNames = [...itemNames];
              const nextVarIds = [...(applicableVariantIds || [])];
              nextIds[idx] = item._id;
              nextNames[idx] = displayName;
              nextVarIds[idx] = variant._id;
              onPatch({
                applicableItems: nextIds,
                applicableItemNames: nextNames,
                applicableVariantIds: nextVarIds,
              });
            } else {
              // New selection
              selectItem(item, variant);
            }
            setVariantPickerItem(null);
          }}
          allowAllVariants={true}
          title="Select Variant"
        />
      )}
    </div>
  );
}
