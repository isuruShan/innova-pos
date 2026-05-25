import { useRef, useState } from 'react';
import {
  Link2, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Upload, ImageIcon, Loader2, Package,
} from 'lucide-react';
import CenteredModal from '../CenteredModal';
import ItemVariantPickerModal from '../ItemVariantPickerModal';
import IngredientsBuilder from './IngredientsBuilder';
import { COMBO_CATEGORY_NAME } from '../../constants/categories';
import { MENU_ITEM_LIMITS, VARIANT_CRITERIA } from '../../constants/menuItems';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, getItemDisplayPrice } from '../../utils/format';
import {
  rebuildVariants,
  findVariantIndex,
} from '../../utils/variantCombinations';

function ComboBuilder({ comboItems, onChange, allItems, currentItemId }) {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);
  const [variantPickerItem, setVariantPickerItem] = useState(null);
  const [pendingQty, setPendingQty] = useState(1);

  const addedKeys = new Set(comboItems.map((c) => `${c.menuItem}:${c.variantId || ''}`));
  const available = allItems.filter(
    (i) => i._id !== currentItemId && !i.isCombo,
  );

  const handleAddClick = () => {
    if (!selectedId) return;
    const item = allItems.find((i) => i._id === selectedId);
    if (!item) return;
    
    // Check if item has variants
    if (item.hasVariants && item.variants?.length > 0) {
      // Show variant picker modal
      setPendingQty(parseInt(qty, 10) || 1);
      setVariantPickerItem(item);
    } else {
      // Add directly without variant
      addItem(item, null);
    }
  };

  const addItem = (item, variant) => {
    const key = `${item._id}:${variant?._id || ''}`;
    if (addedKeys.has(key)) {
      // Already added this specific variant, just reset
      setSelectedId('');
      setQty(1);
      return;
    }
    
    const displayName = variant 
      ? `${item.name} (${variant.attributes?.map(a => a.value).join(' / ') || variant.name})`
      : item.name;
    const price = variant ? variant.price : item.price;
    
    onChange([...comboItems, { 
      menuItem: item._id, 
      variantId: variant?._id || null,
      name: displayName,
      variantName: variant?.name || null,
      price: Number(price),
      qty: variant ? pendingQty : (parseInt(qty, 10) || 1),
    }]);
    setSelectedId('');
    setQty(1);
    setVariantPickerItem(null);
    setPendingQty(1);
  };

  const handleVariantSelect = (item, variant) => {
    addItem(item, variant);
  };

  const remove = (menuItem, variantId) => onChange(
    comboItems.filter((c) => !(c.menuItem === menuItem && (c.variantId || null) === (variantId || null)))
  );
  const updateQty = (menuItem, variantId, newQty) => onChange(
    comboItems.map((c) => 
      (c.menuItem === menuItem && (c.variantId || null) === (variantId || null)) 
        ? { ...c, qty: Math.max(1, parseInt(newQty, 10) || 1) } 
        : c
    ),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Quantities multiply with the ordered amount. Click on items with variants to select a specific variant.</p>
      {comboItems.length > 0 && (
        <div className="bg-[var(--pos-surface-inset)] rounded-xl divide-y divide-slate-800">
          {comboItems.map((ci, idx) => (
            <div key={`${ci.menuItem}:${ci.variantId || ''}:${idx}`} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-200 truncate block" title={ci.name}>{ci.name}</span>
                {ci.variantId && (
                  <span className="text-xs text-sky-400">variant selected</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateQty(ci.menuItem, ci.variantId, ci.qty - 1)}
                  className="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-xs">−</button>
                <span className="w-6 text-center text-sm text-[var(--pos-text-primary)] font-semibold">{ci.qty}</span>
                <button type="button" onClick={() => updateQty(ci.menuItem, ci.variantId, ci.qty + 1)}
                  className="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-xs">+</button>
              </div>
              <button type="button" onClick={() => remove(ci.menuItem, ci.variantId)}
                className="text-slate-600 hover:text-red-400 transition ml-1"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <div className="flex gap-2">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 min-w-0 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">— Select item —</option>
            {available.map((i) => {
              const { price, prefix, hasVariants } = getItemDisplayPrice(i);
              const label = `${i.name} (${prefix}${formatCurrency(price)})${hasVariants ? ' ★' : ''}`;
              return (
                <option key={i._id} value={i._id} title={label}>
                  {label.length > 60 ? `${label.slice(0, 57)}…` : label}
                </option>
              );
            })}
          </select>
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
            className="w-16 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <button type="button" onClick={handleAddClick} disabled={!selectedId}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-2 rounded-xl transition text-sm font-semibold shrink-0">
            Add
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">No more items available to add.</p>
      )}
      <p className="text-xs text-slate-600">★ = item has variants (click Add to select)</p>

      {/* Variant picker modal */}
      {variantPickerItem && (
        <ItemVariantPickerModal
          item={variantPickerItem}
          onClose={() => setVariantPickerItem(null)}
          onSelect={handleVariantSelect}
          title="Select Variant for Combo"
        />
      )}
    </div>
  );
}

function MenuGalleryAppend({ onAppend }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Invalid file type. Please select an image.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { optimizeImage } = await import('../../utils/imageUpload');
      const optimized = await optimizeImage(file, 'menu');
      const fd = new FormData();
      fd.append('image', optimized);
      fd.append('type', 'menu');
      const { postUpload } = await import('../../api/uploadRequest');
      const { data } = await postUpload(fd);
      onAppend({ url: data.url, key: data.key });
      setTab('file');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      alert(msg.includes('timeout') ? `${msg}\n\nIf this persists after deploy, check upload-service logs and Azure storage roles.` : msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="border border-dashed border-slate-600 rounded-xl p-3 space-y-2">
      <p className="text-xs text-slate-500">Add another image</p>
      <div className="flex gap-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg p-0.5 w-fit">
        {[{ id: 'url', label: 'URL' }, { id: 'file', label: 'Upload' }].map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${tab === t.id ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'url' ? (
        <div className="flex gap-2">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <button type="button" disabled={!url.trim()} onClick={() => { onAppend({ url: url.trim(), key: '' }); setUrl(''); }}
            className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-40">Add</button>
        </div>
      ) : (
        <div>
          <input type="file" ref={fileRef} onChange={handleFile} accept="image/*" className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-amber-400 disabled:opacity-50">
            {uploading ? <><Upload size={15} className="animate-bounce" /> Uploading…</> : <><ImageIcon size={15} /> Upload file</>}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuGalleryField({ images, onChange }) {
  const move = (idx, delta) => {
    const j = idx + delta;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const removeAt = (idx) => onChange(images.filter((_, i) => i !== idx));
  const append = (img) => onChange([...images, { url: img.url || '', key: img.key || '' }]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300">Photos (first is primary on menus)</label>
      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((img, idx) => (
            <div
              key={`${idx}-${img.key || img.url}`}
              className="flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl p-2"
            >
              <div className="w-14 h-14 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-600">
                {img.url ? (
                  <img src={img.url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">—</div>
                )}
              </div>
              <span className="text-xs text-slate-500 flex-1 truncate">{img.key ? `S3: …${String(img.key).slice(-20)}` : img.url || '—'}</span>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)}
                  className="p-1 rounded bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600">
                  <ChevronUp size={14} />
                </button>
                <button type="button" disabled={idx === images.length - 1} onClick={() => move(idx, 1)}
                  className="p-1 rounded bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600">
                  <ChevronDown size={14} />
                </button>
              </div>
              <button type="button" onClick={() => removeAt(idx)} className="p-2 text-slate-500 hover:text-red-400 shrink-0">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <MenuGalleryAppend onAppend={append} />
    </div>
  );
}

function VariantImagePicker({ images, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const imgUrl = images?.[0]?.url || '';

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Invalid file type. Please select an image.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { optimizeImage } = await import('../../utils/imageUpload');
      const optimized = await optimizeImage(file, 'menu');
      const fd = new FormData();
      fd.append('image', optimized);
      fd.append('type', 'menu');
      const { postUpload } = await import('../../api/uploadRequest');
      const { data } = await postUpload(fd);
      onChange([{ url: data.url, key: data.key }]);
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input type="file" ref={fileRef} onChange={handleUpload} accept="image/*" className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 text-slate-400 hover:text-amber-500 transition"
      >
        {uploading ? (
          <Loader2 className="animate-spin text-amber-500" size={12} />
        ) : imgUrl ? (
          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={14} />
        )}
      </button>
      {imgUrl && (
        <button type="button" onClick={() => onChange([])}
          className="text-[10px] text-red-400 hover:text-red-300 transition">
          Clear
        </button>
      )}
    </div>
  );
}

function VariantsBuilder({ form, setForm, savedCriteria, saveCriteriaMutation, priceLabel }) {
  const [newValueInput, setNewValueInput] = useState({});
  const [customVariantType, setCustomVariantType] = useState('');
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);

  const hasGroup = (name) => form.variantOptions.some(
    (opt) => opt.name.toLowerCase() === name.toLowerCase(),
  );

  const addOptionGroup = (criteriaName) => {
    if (!criteriaName || hasGroup(criteriaName)) return;
    const matched = savedCriteria.find(
      (sc) => sc.name.toLowerCase() === criteriaName.toLowerCase(),
    );
    const initialValues = matched ? matched.values || [] : [];
    const newOptions = [...form.variantOptions, { name: criteriaName, values: initialValues }];
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm((f) => ({ ...f, variantOptions: newOptions, variants: nextVariants }));
    
    // If it's a custom type, save it
    if (!VARIANT_CRITERIA.includes(criteriaName) && !matched) {
      saveCriteriaMutation.mutate({ name: criteriaName, values: [] });
    }
  };

  const removeOptionGroup = (idx) => {
    const newOptions = form.variantOptions.filter((_, i) => i !== idx);
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm((f) => ({ ...f, variantOptions: newOptions, variants: nextVariants }));
  };

  const addValueToGroup = (idx, val) => {
    const cleanVal = val.trim();
    if (!cleanVal) return;
    const group = form.variantOptions[idx];
    if (group.values.includes(cleanVal)) return;

    const newValues = [...group.values, cleanVal];
    const newOptions = form.variantOptions.map((opt, i) => (i === idx ? { ...opt, values: newValues } : opt));
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm((f) => ({ ...f, variantOptions: newOptions, variants: nextVariants }));
    saveCriteriaMutation.mutate({ name: group.name, values: [cleanVal] });
  };

  const removeValueFromGroup = (groupIndex, valIndex) => {
    const group = form.variantOptions[groupIndex];
    const newValues = group.values.filter((_, i) => i !== valIndex);
    const newOptions = form.variantOptions.map((opt, i) => (i === groupIndex ? { ...opt, values: newValues } : opt));
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm((f) => ({ ...f, variantOptions: newOptions, variants: nextVariants }));
  };

  const patchVariant = (idx, patch) => {
    const nextV = form.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    setForm((f) => ({ ...f, variants: nextV }));
  };

  const updateMatrixPrice = (size, flavor, price) => {
    const idx = findVariantIndex(form.variants, size, flavor);
    if (idx >= 0) patchVariant(idx, { price });
  };

  const toggleMatrixAvailable = (size, flavor) => {
    const idx = findVariantIndex(form.variants, size, flavor);
    if (idx >= 0) {
      patchVariant(idx, { available: !form.variants[idx].available });
    }
  };

  const sizeGroup = form.variantOptions.find((o) => o.name === 'Size');
  const flavorGroup = form.variantOptions.find((o) => o.name === 'Flavor');
  const sizes = sizeGroup?.values || [];
  const flavors = flavorGroup?.values || [];
  const legacyGroups = form.variantOptions.filter(
    (o) => !VARIANT_CRITERIA.includes(o.name),
  );
  const showMatrix = sizes.length > 0 && flavors.length > 0 && legacyGroups.length === 0;
  
  // Get all available criteria (system + saved custom)
  const allAvailableCriteria = [
    ...VARIANT_CRITERIA,
    ...savedCriteria.map(sc => sc.name).filter(name => !VARIANT_CRITERIA.includes(name))
  ];

  const addCustomVariantType = () => {
    const trimmed = customVariantType.trim();
    if (!trimmed) return;
    addOptionGroup(trimmed);
    setCustomVariantType('');
    setShowCustomTypeInput(false);
  };

  return (
    <div className="space-y-4 bg-slate-900/40 p-4 border border-slate-700/60 rounded-2xl">
      <h3 className="text-sm font-semibold text-amber-400">Variant options</h3>

      <div className="flex flex-wrap gap-2">
        {allAvailableCriteria.filter((c) => !hasGroup(c)).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => addOptionGroup(c)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-amber-500/50 hover:text-amber-400 transition"
          >
            + Add {c}
          </button>
        ))}
        
        {/* Custom variant type button/input */}
        {!showCustomTypeInput ? (
          <button
            type="button"
            onClick={() => setShowCustomTypeInput(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-dashed border-amber-500/40 text-amber-400 hover:border-amber-500 hover:bg-amber-500/5 transition"
          >
            + Custom Type...
          </button>
        ) : (
          <div className="flex gap-1">
            <input
              type="text"
              value={customVariantType}
              onChange={(e) => setCustomVariantType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomVariantType();
                }
                if (e.key === 'Escape') {
                  setShowCustomTypeInput(false);
                  setCustomVariantType('');
                }
              }}
              placeholder="Type name (e.g. Topping, Style)"
              autoFocus
              className="bg-slate-900 border border-amber-500/50 text-[var(--pos-text-primary)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-40"
            />
            <button
              type="button"
              onClick={addCustomVariantType}
              disabled={!customVariantType.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomTypeInput(false);
                setCustomVariantType('');
              }}
              className="text-slate-500 hover:text-slate-300 text-xs px-2"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {form.variantOptions.map((group, groupIdx) => {
          const isSystemType = VARIANT_CRITERIA.includes(group.name);
          const isCustomType = !isSystemType;
          return (
            <div key={groupIdx} className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">
                  {group.name}
                  {isCustomType && <span className="ml-2 text-[10px] text-amber-400 font-normal">(custom)</span>}
                </span>
                <button type="button" onClick={() => removeOptionGroup(groupIdx)}
                  className="text-xs text-red-400 hover:text-red-300 font-medium">
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.values.map((val, valIdx) => (
                  <span key={valIdx}
                    className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-300 rounded-lg px-2 py-1 border border-slate-700 font-medium">
                    {val}
                    <button type="button" onClick={() => removeValueFromGroup(groupIdx, valIdx)}
                      className="text-slate-500 hover:text-slate-300 ml-0.5">
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {group.values.length === 0 && (
                  <span className="text-xs text-slate-600 italic">No values added yet</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newValueInput[groupIdx] || ''}
                  onChange={(e) => setNewValueInput((p) => ({ ...p, [groupIdx]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addValueToGroup(groupIdx, newValueInput[groupIdx]);
                      setNewValueInput((p) => ({ ...p, [groupIdx]: '' }));
                    }
                  }}
                  placeholder={`Add value for ${group.name}…`}
                  className="flex-1 bg-slate-900 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    addValueToGroup(groupIdx, newValueInput[groupIdx]);
                    setNewValueInput((p) => ({ ...p, [groupIdx]: '' }));
                  }}
                  disabled={!(newValueInput[groupIdx] || '').trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {form.variants.length > 0 && (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-xs font-semibold text-slate-400">
            Pricing ({form.variants.length} variant{form.variants.length !== 1 ? 's' : ''})
          </p>

          {showMatrix ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-slate-500 font-medium p-2 border-b border-slate-800">Size \ Flavor</th>
                    {flavors.map((f) => (
                      <th key={f} className="text-center text-slate-400 font-medium p-2 border-b border-slate-800 min-w-[100px]">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size}>
                      <td className="text-slate-300 font-medium p-2 border-b border-slate-800/50">{size}</td>
                      {flavors.map((flavor) => {
                        const idx = findVariantIndex(form.variants, size, flavor);
                        const v = idx >= 0 ? form.variants[idx] : null;
                        const available = v?.available !== false;
                        const isDefault = v && form.defaultVariantId && String(form.defaultVariantId) === String(v._id);
                        return (
                          <td key={flavor} className={`p-2 border-b border-slate-800/50 align-top ${isDefault ? 'bg-amber-500/10' : ''}`}>
                            {v ? (
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={v.price}
                                  onChange={(e) => updateMatrixPrice(size, flavor, e.target.value)}
                                  placeholder="0.00"
                                  required={available}
                                  disabled={!available}
                                  className={`w-full bg-slate-950 border text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40 ${isDefault ? 'border-amber-500/50' : 'border-slate-800'}`}
                                />
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleMatrixAvailable(size, flavor)}
                                    className={`flex items-center gap-0.5 text-[10px] ${available ? 'text-green-400' : 'text-slate-500'}`}
                                  >
                                    {available ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                                    {available ? 'On' : 'Off'}
                                  </button>
                                  {available && (
                                    isDefault ? (
                                      <span className="text-[9px] font-bold text-amber-400">★</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, defaultVariantId: v._id }))}
                                        className="text-[9px] text-slate-500 hover:text-amber-400"
                                        title="Set as default"
                                      >
                                        ☆
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-500 mt-2">{priceLabel} per cell · ★ = default variant shown in listings</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {form.variants.map((v, idx) => {
                const isDefault = form.defaultVariantId && String(form.defaultVariantId) === String(v._id);
                return (
                <div key={idx} className={`bg-slate-900/80 rounded-xl p-3 border space-y-2 ${isDefault ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-slate-850'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-200 truncate" title={v.name}>{v.name}</span>
                      {isDefault && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {v.available !== false && !isDefault && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, defaultVariantId: v._id }))}
                          className="text-[10px] text-slate-400 hover:text-amber-400 font-medium transition"
                        >
                          Set default
                        </button>
                      )}
                      <button type="button" onClick={() => patchVariant(idx, { available: !v.available })}
                        className={`flex items-center gap-1 text-[10px] font-medium transition ${v.available !== false ? 'text-green-400' : 'text-slate-500'}`}>
                        {v.available !== false ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {v.available !== false ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                    <div className="flex gap-2">
                      <div className="w-24">
                        <label className="text-[9px] text-slate-500 block mb-0.5">{priceLabel} *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.price}
                          onChange={(e) => patchVariant(idx, { price: e.target.value })}
                          placeholder="0.00"
                          required={v.available !== false}
                          disabled={v.available === false}
                          className="w-full bg-slate-950 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 block mb-0.5">Desc override</label>
                        <input
                          type="text"
                          value={v.description || ''}
                          onChange={(e) => patchVariant(idx, { description: e.target.value })}
                          placeholder="Falls back to product"
                          disabled={v.available === false}
                          className="w-full bg-slate-950 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <label className="text-[9px] text-slate-500 block mb-0.5 self-start">Photo</label>
                      <VariantImagePicker
                        images={v.images}
                        onChange={(imgList) => {
                          const primaryImg = imgList?.[0]?.url || '';
                          const primaryKey = imgList?.[0]?.key || '';
                          patchVariant(idx, { images: imgList, image: primaryImg, imageKey: primaryKey });
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MenuItemFormModal({
  open,
  onClose,
  editing,
  form,
  setForm,
  formError,
  items,
  selectableCategoryNames,
  savedCriteria,
  saveCriteriaMutation,
  onSubmit,
  isPending,
}) {
  const { currencySymbol } = useBranding();
  const { selectedStoreId } = useStoreContext();
  const priceLabel = `Price (${currencySymbol})`;

  const footer = (
    <div className="flex gap-3">
      <button type="button" onClick={onClose}
        className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
        Cancel
      </button>
      <button type="submit" form="menu-item-form" disabled={isPending}
        className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
        {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Item'}
      </button>
    </div>
  );

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Menu Item' : 'Add Menu Item'}
      maxWidth="max-w-2xl"
      footer={footer}
    >
      <form id="menu-item-form" onSubmit={onSubmit} className="space-y-4">
        <div
          onClick={() => setForm((f) => ({
            ...f,
            isCombo: !f.isCombo,
            category: !f.isCombo ? COMBO_CATEGORY_NAME : (selectableCategoryNames[0] || ''),
            comboItems: f.isCombo ? [] : f.comboItems,
            hasVariants: false,
            variantOptions: [],
            variants: [],
          }))}
          className={`flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer border transition ${
            form.isCombo ? 'bg-amber-500/10 border-amber-500/40' : 'bg-[var(--pos-surface-inset)] border-slate-700 hover:border-slate-600'
          }`}>
          <div className="flex items-center gap-2">
            <Link2 size={16} className={form.isCombo ? 'text-amber-400' : 'text-slate-500'} />
            <div>
              <p className={`text-sm font-semibold ${form.isCombo ? 'text-amber-400' : 'text-slate-300'}`}>Combo Product</p>
              <p className="text-xs text-slate-500">Bundle multiple items into one product</p>
            </div>
          </div>
          <div className={`w-10 h-5 rounded-full transition relative flex-shrink-0 ${form.isCombo ? 'bg-amber-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isCombo ? 'left-5' : 'left-0.5'}`} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Item Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={form.isCombo ? 'e.g. Burger Meal Deal' : 'e.g. Classic Burger'}
            required
            maxLength={MENU_ITEM_LIMITS.name}
            className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
          />
        </div>

        {form.isCombo ? (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
            <input type="text" value={COMBO_CATEGORY_NAME} disabled
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-slate-400 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed opacity-70" />
            <p className="text-xs text-slate-500 mt-1">Combo products are always assigned to the Combos category.</p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Category *</label>
            {selectableCategoryNames.length > 0 ? (
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {selectableCategoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-500 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-4 py-3">
                No active categories. Add categories first using the Categories button.
              </p>
            )}
          </div>
        )}

        {!form.hasVariants && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{priceLabel} *</label>
            <input type="number" step="0.01" min="0" value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00" required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
            {form.isCombo && <p className="text-xs text-slate-500 mt-1">Set the combo price (can differ from sum of parts)</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            maxLength={MENU_ITEM_LIMITS.description}
            placeholder="Short description…"
            className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none"
          />
        </div>

        <MenuGalleryField images={form.images} onChange={(images) => setForm((f) => ({ ...f, images }))} />

        {form.isCombo && (
          <div className="bg-[var(--pos-surface-inset)] rounded-xl p-4 border border-amber-500/20">
            <p className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
              <Link2 size={14} /> Combo Items
            </p>
            <ComboBuilder
              comboItems={form.comboItems}
              onChange={(comboItems) => setForm((f) => ({ ...f, comboItems }))}
              allItems={items}
              currentItemId={editing?._id}
            />
          </div>
        )}

        {!form.isCombo && (
          <>
            <div className="flex items-center justify-between bg-[var(--pos-surface-inset)] rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-300">Has Variants</p>
                <p className="text-xs text-slate-500">Sell in different sizes and flavors</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, hasVariants: !f.hasVariants, price: f.hasVariants ? f.price : '' }))}
                className={`w-12 h-6 rounded-full transition relative ${form.hasVariants ? 'bg-amber-500' : 'bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.hasVariants ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            {form.hasVariants && (
              <VariantsBuilder
                form={form}
                setForm={setForm}
                savedCriteria={savedCriteria}
                saveCriteriaMutation={saveCriteriaMutation}
                priceLabel={priceLabel}
              />
            )}
          </>
        )}

        <div className="flex items-center justify-between bg-[var(--pos-surface-inset)] rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-300">Available on menu</p>
            <p className="text-xs text-slate-500">Show to cashiers</p>
          </div>
          <button type="button" onClick={() => setForm((f) => ({ ...f, available: !f.available }))}
            className={`w-12 h-6 rounded-full transition relative ${form.available ? 'bg-amber-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.available ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Ingredients section - only show when editing existing item */}
        {editing?._id && !form.isCombo && (
          <div className="bg-[var(--pos-surface-inset)] rounded-xl p-4 border border-purple-500/20">
            <p className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-1.5">
              <Package size={14} /> Ingredients
            </p>
            <IngredientsBuilder
              menuItemId={editing._id}
              storeId={selectedStoreId}
            />
          </div>
        )}

        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{formError}</div>
        )}
      </form>
    </CenteredModal>
  );
}
