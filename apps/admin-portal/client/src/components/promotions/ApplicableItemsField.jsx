import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import FormField from '../common/FormField';

export default function ApplicableItemsField({
  itemIds = [],
  itemNames = [],
  categoryNames = [],
  onChange,
  menuItems = [],
  categories = [],
  required = false,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const q = search.trim().toLowerCase();
  const matchCats = categories.filter((c) => c.name?.toLowerCase().includes(q));
  const matchItems = menuItems.filter((m) => m.name?.toLowerCase().includes(q));
  const showDrop = open && q.length > 0 && (matchCats.length > 0 || matchItems.length > 0);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCategory = (name) => {
    const next = categoryNames.includes(name)
      ? categoryNames.filter((c) => c !== name)
      : [...categoryNames, name];
    onChange(itemIds, itemNames, next);
    setSearch('');
    setOpen(false);
  };

  const selectItem = (m) => {
    let nextIds;
    let nextNames;
    if (itemIds.includes(m._id)) {
      nextIds = itemIds.filter((id) => String(id) !== String(m._id));
      nextNames = itemNames.filter((n) => n !== m.name);
    } else {
      nextIds = [...itemIds, m._id];
      nextNames = [...itemNames, m.name];
    }
    onChange(nextIds, nextNames, categoryNames);
    setSearch('');
    setOpen(false);
  };

  const total = itemIds.length + categoryNames.length;

  return (
    <FormField
      label="Products & categories"
      hint={required ? 'Select at least one product or category.' : 'Leave empty to apply to the whole order.'}
      required={required}
    >
      <div ref={ref} className="space-y-2">
        {total === 0 ? (
          <p className="text-xs text-gray-500">
            {required ? 'Search and add at least one product or category.' : 'Nothing selected — applies to the whole order.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {categoryNames.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs px-2 py-1 rounded-full">
                {c}
                <button type="button" onClick={() => onChange(itemIds, itemNames, categoryNames.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {itemIds.map((id, i) => (
              <span key={id} className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full">
                {itemNames[i]}
                <button
                  type="button"
                  onClick={() => onChange(itemIds.filter((x) => String(x) !== String(id)), itemNames.filter((_, j) => j !== i), categoryNames)}
                  aria-label="Remove item"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search categories or products…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {showDrop && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {matchCats.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase bg-gray-50">Categories</p>
                  {matchCats.map((c) => (
                    <button key={c._id} type="button" onMouseDown={() => selectCategory(c.name)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {c.name}
                    </button>
                  ))}
                </>
              )}
              {matchItems.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase bg-gray-50">Products</p>
                  {matchItems.map((m) => (
                    <button key={m._id} type="button" onMouseDown={() => selectItem(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {m.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </FormField>
  );
}
