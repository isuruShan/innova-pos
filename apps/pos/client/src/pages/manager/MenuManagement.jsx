import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Link2, X,
  ChevronDown, ChevronUp, Tag, Check, Upload, ImageIcon, Loader2, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import { MenuGridSkeleton } from '../../components/StoreSkeletons';

const EMPTY_FORM = {
  name: '', category: '', price: '', description: '', images: [],
  available: true, isCombo: false, comboItems: [],
  hasVariants: false, variantOptions: [], variants: [],
};

// ─── Combo builder ───────────────────────────────────────────────────────────

function ComboBuilder({ comboItems, onChange, allItems, currentItemId }) {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);

  const addedIds = new Set(comboItems.map(c => c.menuItem));
  const available = allItems.filter(i => i._id !== currentItemId && !addedIds.has(i._id) && !i.isCombo);

  const add = () => {
    if (!selectedId) return;
    const item = allItems.find(i => i._id === selectedId);
    if (!item) return;
    onChange([...comboItems, { menuItem: item._id, name: item.name, qty: parseInt(qty) || 1 }]);
    setSelectedId(''); setQty(1);
  };
  const remove = (id) => onChange(comboItems.filter(c => c.menuItem !== id));
  const updateQty = (id, newQty) => onChange(
    comboItems.map(c => c.menuItem === id ? { ...c, qty: Math.max(1, parseInt(newQty) || 1) } : c)
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Quantities multiply with the ordered amount.</p>
      {comboItems.length > 0 && (
        <div className="bg-[var(--pos-surface-inset)] rounded-xl divide-y divide-slate-800">
          {comboItems.map(ci => (
            <div key={ci.menuItem} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 text-sm text-slate-200 truncate">{ci.name}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateQty(ci.menuItem, ci.qty - 1)}
                  className="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-xs">−</button>
                <span className="w-6 text-center text-sm text-[var(--pos-text-primary)] font-semibold">{ci.qty}</span>
                <button type="button" onClick={() => updateQty(ci.menuItem, ci.qty + 1)}
                  className="w-6 h-6 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-xs">+</button>
              </div>
              <button type="button" onClick={() => remove(ci.menuItem)}
                className="text-slate-600 hover:text-red-400 transition ml-1"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <div className="flex gap-2">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">— Select item —</option>
            {available.map(i => <option key={i._id} value={i._id}>{i.name} ({formatCurrency(i.price)})</option>)}
          </select>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
            className="w-16 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500" />
          <button type="button" onClick={add} disabled={!selectedId}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-2 rounded-xl transition text-sm font-semibold">
            Add
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">No more items available to add.</p>
      )}
    </div>
  );
}

function ComboItemsPreview({ comboItems }) {
  const [open, setOpen] = useState(false);
  if (!comboItems?.length) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-400">
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {comboItems.length} item{comboItems.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {comboItems.map((ci, i) => (
            <li key={i} className="text-xs text-slate-500">• {ci.name} ×{ci.qty}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Menu gallery (multiple sortable images) ─────────────────────────────────

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

function MenuGalleryAppend({ onAppend }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

// ─── Rebuild combinations preserving existing data ───────────────────────────

function generateCombinations(options) {
  if (!options || options.length === 0) return [];
  const validOptions = options.filter(opt => opt.name && opt.values?.length > 0);
  if (validOptions.length === 0) return [];

  const results = [];
  function helper(index, currentAttributes, currentName) {
    if (index === validOptions.length) {
      results.push({
        name: currentName,
        attributes: currentAttributes,
        price: '',
        description: '',
        images: [],
        available: true,
      });
      return;
    }
    const option = validOptions[index];
    for (const val of option.values) {
      helper(
        index + 1,
        [...currentAttributes, { name: option.name, value: val }],
        currentName ? `${currentName} / ${val}` : val
      );
    }
  }
  helper(0, [], '');
  return results;
}

function rebuildVariants(newOptions, currentVariants) {
  const generated = generateCombinations(newOptions);
  return generated.map(gen => {
    const match = currentVariants.find(v => {
      if (v.attributes?.length !== gen.attributes.length) return false;
      return gen.attributes.every(genAttr => 
        v.attributes.some(vAttr => vAttr.name === genAttr.name && vAttr.value === genAttr.value)
      );
    });
    if (match) {
      return {
        ...gen,
        _id: match._id,
        price: match.price,
        description: match.description,
        images: match.images || [],
        image: match.image || '',
        imageKey: match.imageKey || '',
        available: match.available !== false,
      };
    }
    return gen;
  });
}

// ─── Inline variant image upload ─────────────────────────────────────────────

function VariantImagePicker({ images, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const imgUrl = images?.[0]?.url || '';

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[10px] text-red-400 hover:text-red-300 transition"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Option Options Builder Panel ────────────────────────────────────────────

function VariantsBuilder({ form, setForm, savedCriteria, saveCriteriaMutation }) {
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [newValueInput, setNewValueInput] = useState({});

  const availableCriteria = savedCriteria.filter(
    (sc) => !form.variantOptions.some((opt) => opt.name.toLowerCase() === sc.name.toLowerCase())
  );

  const addOptionGroup = (criteriaName) => {
    if (!criteriaName) return;
    const matched = savedCriteria.find(sc => sc.name.toLowerCase() === criteriaName.toLowerCase());
    const initialValues = matched ? matched.values || [] : [];
    
    const newOptions = [...form.variantOptions, { name: criteriaName, values: initialValues }];
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm(f => ({
      ...f,
      variantOptions: newOptions,
      variants: nextVariants
    }));
    setSelectedCriteriaId('');
  };

  const createCustomGroup = () => {
    if (!customName.trim()) return;
    const name = customName.trim();
    saveCriteriaMutation.mutate({ name, values: [] });
    const newOptions = [...form.variantOptions, { name, values: [] }];
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm(f => ({
      ...f,
      variantOptions: newOptions,
      variants: nextVariants
    }));
    setCustomName('');
    setShowCustomInput(false);
  };

  const removeOptionGroup = (idx) => {
    const newOptions = form.variantOptions.filter((_, i) => i !== idx);
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm(f => ({
      ...f,
      variantOptions: newOptions,
      variants: nextVariants
    }));
  };

  const addValueToGroup = (idx, val) => {
    const cleanVal = val.trim();
    if (!cleanVal) return;
    const group = form.variantOptions[idx];
    if (group.values.includes(cleanVal)) return;

    const newValues = [...group.values, cleanVal];
    const newOptions = form.variantOptions.map((opt, i) => i === idx ? { ...opt, values: newValues } : opt);
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm(f => ({
      ...f,
      variantOptions: newOptions,
      variants: nextVariants
    }));

    saveCriteriaMutation.mutate({ name: group.name, values: [cleanVal] });
  };

  const removeValueFromGroup = (groupIndex, valIndex) => {
    const group = form.variantOptions[groupIndex];
    const newValues = group.values.filter((_, i) => i !== valIndex);
    const newOptions = form.variantOptions.map((opt, i) => i === groupIndex ? { ...opt, values: newValues } : opt);
    const nextVariants = rebuildVariants(newOptions, form.variants);
    setForm(f => ({
      ...f,
      variantOptions: newOptions,
      variants: nextVariants
    }));
  };

  const updateVariantPrice = (vIdx, val) => {
    const nextV = form.variants.map((v, idx) => idx === vIdx ? { ...v, price: val } : v);
    setForm(f => ({ ...f, variants: nextV }));
  };

  const updateVariantDesc = (vIdx, val) => {
    const nextV = form.variants.map((v, idx) => idx === vIdx ? { ...v, description: val } : v);
    setForm(f => ({ ...f, variants: nextV }));
  };

  const updateVariantImages = (vIdx, images) => {
    const primaryImg = images?.[0]?.url || '';
    const primaryKey = images?.[0]?.key || '';
    const nextV = form.variants.map((v, idx) => idx === vIdx ? {
      ...v,
      images,
      image: primaryImg,
      imageKey: primaryKey
    } : v);
    setForm(f => ({ ...f, variants: nextV }));
  };

  const toggleVariantAvailable = (vIdx) => {
    const nextV = form.variants.map((v, idx) => idx === vIdx ? { ...v, available: !v.available } : v);
    setForm(f => ({ ...f, variants: nextV }));
  };

  return (
    <div className="space-y-4 bg-slate-900/40 p-4 border border-slate-700/60 rounded-2xl">
      <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
        🛠️ Variant Builder
      </h3>

      <div className="space-y-3">
        {form.variantOptions.map((group, groupIdx) => (
          <div key={groupIdx} className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">{group.name}</span>
              <button
                type="button"
                onClick={() => removeOptionGroup(groupIdx)}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {group.values.map((val, valIdx) => (
                <span
                  key={valIdx}
                  className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-300 rounded-lg px-2 py-1 border border-slate-700 font-medium"
                >
                  {val}
                  <button
                    type="button"
                    onClick={() => removeValueFromGroup(groupIdx, valIdx)}
                    className="text-slate-500 hover:text-slate-300 ml-0.5"
                  >
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
                onChange={(e) => setNewValueInput(p => ({ ...p, [groupIdx]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addValueToGroup(groupIdx, newValueInput[groupIdx]);
                    setNewValueInput(p => ({ ...p, [groupIdx]: '' }));
                  }
                }}
                placeholder={`Add value for ${group.name}...`}
                className="flex-1 bg-slate-900 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  addValueToGroup(groupIdx, newValueInput[groupIdx]);
                  setNewValueInput(p => ({ ...p, [groupIdx]: '' }));
                }}
                disabled={!(newValueInput[groupIdx] || '').trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showCustomInput ? (
        <div className="flex gap-2">
          <select
            value={selectedCriteriaId}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                setShowCustomInput(true);
              } else {
                addOptionGroup(val);
              }
            }}
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">+ Add variant criteria (Size, Flavor…)</option>
            {availableCriteria.map(sc => (
              <option key={sc._id} value={sc.name}>{sc.name}</option>
            ))}
            <option value="__custom__">— Add Custom Criteria… —</option>
          </select>
        </div>
      ) : (
        <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-300">Create custom variant criteria</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Roast Level, Milk Type"
              className="flex-1 bg-slate-900 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={createCustomGroup}
              disabled={!customName.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg transition font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowCustomInput(false); setCustomName(''); }}
              className="border border-slate-700 text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {form.variants.length > 0 && (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-xs font-semibold text-slate-400">Variant Matrix ({form.variants.length})</p>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {form.variants.map((v, idx) => (
              <div key={idx} className="bg-slate-900/80 rounded-xl p-3 border border-slate-850 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200 truncate flex-1">{v.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleVariantAvailable(idx)}
                    className={`flex items-center gap-1 text-[10px] font-medium transition ${v.available ? 'text-green-400' : 'text-slate-500'}`}
                  >
                    {v.available ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {v.available ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div className="flex gap-2">
                    <div className="w-20">
                      <label className="text-[9px] text-slate-500 block mb-0.5">Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.price}
                        onChange={(e) => updateVariantPrice(idx, e.target.value)}
                        placeholder="0.00"
                        required
                        disabled={!v.available}
                        className="w-full bg-slate-950 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-500 block mb-0.5">Desc override</label>
                      <input
                        type="text"
                        value={v.description || ''}
                        onChange={(e) => updateVariantDesc(idx, e.target.value)}
                        placeholder="Falls back to product"
                        disabled={!v.available}
                        className="w-full bg-slate-950 border border-slate-800 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <label className="text-[9px] text-slate-500 block mb-0.5 self-start">Photo</label>
                    <VariantImagePicker
                      images={v.images}
                      onChange={(imgList) => updateVariantImages(idx, imgList)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category management panel ────────────────────────────────────────────────

function CategoryManager({ categories, onClose }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: (name) => api.post('/categories', { name }),
    onSuccess: () => { invalidate(); setNewName(''); setError(''); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to add'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/categories/${id}`, data),
    onSuccess: () => { invalidate(); setEditingId(null); setError(''); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/categories/${id}`),
    onSuccess: invalidate,
  });

  const startEdit = (cat) => { setEditingId(cat._id); setEditName(cat.name); setError(''); };
  const saveEdit = () => {
    if (!editName.trim()) return;
    updateMutation.mutate({ id: editingId, data: { name: editName.trim() } });
  };

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">New Category</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
            placeholder="e.g. Wraps"
            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
          />
          <button
            onClick={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
            disabled={!newName.trim() || createMutation.isPending}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No categories yet</p>
        ) : (
          categories.map(cat => (
            <div key={cat._id}
              className={`flex items-center gap-3 bg-[var(--pos-surface-inset)] rounded-xl px-3 py-2.5 border transition ${
                cat.active ? 'border-slate-700' : 'border-slate-800 opacity-60'
              }`}>
              {editingId === cat._id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none"
                  />
                  <button onClick={saveEdit} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
                </>
              ) : (
                <>
                  <Tag size={13} className={cat.active ? 'text-amber-400' : 'text-slate-600'} />
                  <span className="flex-1 text-sm text-[var(--pos-text-primary)] truncate">{cat.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cat.active
                      ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                      : 'bg-slate-700 text-slate-500 border border-slate-600'
                  }`}>
                    {cat.active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => updateMutation.mutate({ id: cat._id, data: { active: !cat.active } })}
                    className="p-1 rounded text-slate-500 hover:text-amber-400 transition" title={cat.active ? 'Deactivate' : 'Activate'}>
                    {cat.active ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => startEdit(cat)}
                    className="p-1 rounded text-slate-500 hover:text-[var(--pos-text-primary)] transition"><Edit2 size={13} /></button>
                  <button
                    onClick={() => { if (confirm(`Delete category "${cat.name}"?`)) deleteMutation.mutate(cat._id); }}
                    className="p-1 rounded text-slate-500 hover:text-red-400 transition"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <button onClick={onClose}
        className="w-full bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-medium py-2.5 rounded-xl transition text-sm mt-2">
        Done
      </button>
    </div>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteMenuItemDialog({ item, allItems, onConfirm, onCancel, isDeleting }) {
  // Find combos that include this item
  const affectedCombos = allItems.filter(
    (i) => i.isCombo && i.comboItems?.some((ci) => ci.menuItem === item._id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Dialog */}
      <div className="relative bg-[var(--pos-surface)] border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Trash2 className="text-red-400" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--pos-text-primary)]">Delete Menu Item</h3>
            <p className="text-sm text-slate-400 mt-1">
              Are you sure you want to delete <span className="font-semibold text-slate-200">{item.name}</span>?
            </p>
          </div>
        </div>

        {/* Context warnings */}
        <div className="mt-4 space-y-2">
          {item.isCombo && item.comboItems?.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-400 font-medium flex items-center gap-2">
                <Link2 size={14} /> This is a combo with {item.comboItems.length} item{item.comboItems.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {item.hasVariants && item.variants?.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-400 font-medium flex items-center gap-2">
                <Layers size={14} /> This item has {item.variants.length} variant{item.variants.length > 1 ? 's' : ''} that will be removed
              </p>
            </div>
          )}

          {affectedCombos.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-sm text-red-400 font-medium flex items-center gap-2">
                <Link2 size={14} /> Used in {affectedCombos.length} combo{affectedCombos.length > 1 ? 's' : ''}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {affectedCombos.slice(0, 3).map((combo) => (
                  <li key={combo._id} className="text-xs text-red-300 pl-5">• {combo.name}</li>
                ))}
                {affectedCombos.length > 3 && (
                  <li className="text-xs text-red-300 pl-5">• and {affectedCombos.length - 3} more...</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-4">This action cannot be undone.</p>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MenuManagement() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [activeCategory, setActiveCategory] = useState('All');
  const [slideOpen, setSlideOpen] = useState(false);
  const [catSlideOpen, setCatSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();

  const { data: savedCriteria = [] } = useQuery({
    queryKey: ['variant-criteria', selectedStoreId],
    queryFn: () => api.get('/variant-criteria').then(r => r.data),
    enabled: isStoreReady,
  });

  const saveCriteriaMutation = useMutation({
    mutationFn: (data) => api.post('/variant-criteria', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variant-criteria'] }),
  });

  useEffect(() => {
    setActiveCategory('All');
  }, [selectedStoreId]);

  const { data: items = [], isPending: menuPending } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: isStoreReady,
  });

  // Fetch ALL categories (including inactive) for management; active-only for filter/form
  const { data: allCategories = [], isPending: categoriesPending } = useQuery({
    queryKey: ['categories', 'all', selectedStoreId],
    queryFn: () => api.get('/categories?all=true').then(r => r.data),
    enabled: isStoreReady,
  });

  const menuLoading = !isStoreReady || menuPending || categoriesPending;
  const activeCategories = allCategories.filter(c => c.active);
  const categoryNames = activeCategories.map(c => c.name);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/menu', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save item'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/menu/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save item'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/menu/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }) => api.put(`/menu/${id}`, { available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });

  const openAdd = () => {
    setEditing(null);
    // Respect the category tab selected in the sidebar — do not always use the first category in the list.
    const defaultCategory =
      activeCategory !== 'All' && categoryNames.includes(activeCategory)
        ? activeCategory
        : categoryNames[0] || '';
    setForm({ ...EMPTY_FORM, category: defaultCategory });
    setFormError('');
    setSlideOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const images =
      item.images?.length > 0
        ? item.images.map((x) => ({ url: x.url || '', key: x.key || '' }))
        : item.image || item.imageKey
          ? [{ url: item.image || '', key: item.imageKey || '' }]
          : [];
    setForm({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description,
      images,
      available: item.available,
      isCombo: item.isCombo || false,
      comboItems: item.comboItems || [],
      hasVariants: item.hasVariants || false,
      variantOptions: item.variantOptions || [],
      variants: item.variants || [],
    });
    setFormError('');
    setSlideOpen(true);
  };

  const closeSlide = () => { setSlideOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const rawPrice = Number(form.price);
    const price = Number.isFinite(rawPrice) ? Math.round(rawPrice * 100) / 100 : NaN;
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.hasVariants && (isNaN(price) || price < 0)) return setFormError('Price must be a positive number');
    if (form.isCombo && form.comboItems.length === 0)
      return setFormError('A combo must have at least one item added');

    if (form.hasVariants) {
      if (!form.variantOptions?.length) {
        return setFormError('At least one option criteria (e.g. Size) is required when "Has Variants" is enabled');
      }
      const hasEmptyValues = form.variantOptions.some(opt => !opt.values || opt.values.length === 0);
      if (hasEmptyValues) {
        return setFormError('All option criteria must have at least one value');
      }
      if (!form.variants || form.variants.length === 0) {
        return setFormError('No variants generated');
      }
      for (const v of form.variants) {
        const vp = Number(v.price);
        if (v.available && (isNaN(vp) || vp < 0)) {
          return setFormError(`Price for variant "${v.name}" must be a positive number`);
        }
      }
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: form.hasVariants ? 0 : price,
      description: form.description,
      images: form.images,
      available: form.available,
      isCombo: form.isCombo,
      comboItems: form.isCombo ? form.comboItems : [],
      hasVariants: form.hasVariants,
      variantOptions: form.hasVariants ? form.variantOptions : [],
      variants: form.hasVariants ? form.variants : [],
    };
    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = useMemo(
    () => activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory),
    [items, activeCategory]
  );
  const isPending = createMutation.isPending || updateMutation.isPending;
  const nonComboItems = items.filter(i => !i.isCombo);
  const filterTabs = ['All', ...categoryNames];

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)]">Menu Items</h1>
            <p className="text-slate-500 text-sm mt-1">{items.length} items · {items.filter(i => i.isCombo).length} combos</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCatSlideOpen(true)}
              className="flex items-center gap-2 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-amber-400 font-medium px-4 py-2.5 rounded-xl transition text-sm">
              <Tag size={15} />
              Categories
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm">
              <Plus size={16} />
              Add Item
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {filterTabs.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeCategory === cat
                  ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {menuLoading ? (
          <MenuGridSkeleton cards={15} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-slate-600 py-16">No items in this category</div>
            )}
            {filtered.map(item => (
              <div key={item._id}
                className={`bg-[var(--pos-panel)] rounded-2xl overflow-hidden border transition group ${
                  item.isCombo ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-slate-700/50 hover:border-slate-600'
                }`}>
                <div className="relative h-32 bg-slate-800 overflow-hidden">
                  {(item.images?.[0]?.url || item.image) ? (
                    <img src={item.images?.[0]?.url || item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {item.isCombo ? '🍱' : '🍔'}
                    </div>
                  )}
                  {item.isCombo && (
                    <div className="absolute top-2 left-2">
                      <span className="flex items-center gap-1 bg-amber-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Link2 size={10} /> Combo
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 transition flex gap-1">
                    <button onClick={() => openEdit(item)}
                      className="w-7 h-7 bg-slate-900/80 backdrop-blur rounded-lg flex items-center justify-center text-slate-300 hover:text-[var(--pos-text-primary)]">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteTarget(item)}
                      className="w-7 h-7 bg-slate-900/80 backdrop-blur rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-[var(--pos-text-primary)] text-sm truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 mb-1">{item.category}</p>
                  {item.isCombo && <ComboItemsPreview comboItems={item.comboItems} />}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-amber-400 font-bold">{formatCurrency(item.price)}</span>
                    <button
                      onClick={() => toggleMutation.mutate({ id: item._id, available: !item.available })}
                      className={`flex items-center gap-1 text-xs font-medium transition ${item.available ? 'text-green-400' : 'text-slate-500'}`}>
                      {item.available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {item.available ? 'Active' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category management slide-over */}
      <SlideOver open={catSlideOpen} onClose={() => setCatSlideOpen(false)} title="Manage Categories">
        <CategoryManager categories={allCategories} onClose={() => setCatSlideOpen(false)} />
      </SlideOver>

      {/* Menu item slide-over */}
      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Menu Item' : 'Add Menu Item'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Combo toggle */}
          <div
            onClick={() => setForm(f => ({ ...f, isCombo: !f.isCombo, category: !f.isCombo ? 'Combos' : f.category, comboItems: [] }))}
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
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={form.isCombo ? 'e.g. Burger Meal Deal' : 'e.g. Classic Burger'} required
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Category *</label>
            {categoryNames.length > 0 ? (
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <p className="text-xs text-slate-500 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-4 py-3">
                No active categories. Add categories first using the Categories button.
              </p>
            )}
          </div>

          {!form.hasVariants && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Price ($) *</label>
              <input type="number" step="0.01" min="0" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0.00" required
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
              {form.isCombo && <p className="text-xs text-slate-500 mt-1">Set the combo price (can differ from sum of parts)</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Short description..."
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none" />
          </div>

          <MenuGalleryField
            images={form.images}
            onChange={(images) => setForm((f) => ({ ...f, images }))}
          />

          {/* Combo builder */}
          {form.isCombo && (
            <div className="bg-[var(--pos-surface-inset)] rounded-xl p-4 border border-amber-500/20">
              <p className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                <Link2 size={14} /> Combo Items
              </p>
              <ComboBuilder comboItems={form.comboItems}
                onChange={comboItems => setForm(f => ({ ...f, comboItems }))}
                allItems={items} currentItemId={editing?._id} />
            </div>
          )}

          {/* Variants Configuration */}
          {!form.isCombo && (
            <>
              <div className="flex items-center justify-between bg-[var(--pos-surface-inset)] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-300">Has Variants</p>
                  <p className="text-xs text-slate-500">Sell in different sizes, flavors, etc.</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({ ...f, hasVariants: !f.hasVariants, price: f.hasVariants ? f.price : '' }))}
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
                />
              )}
            </>
          )}

          {/* Availability toggle */}
          <div className="flex items-center justify-between bg-[var(--pos-surface-inset)] rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Available on menu</p>
              <p className="text-xs text-slate-500">Show to cashiers</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, available: !f.available }))}
              className={`w-12 h-6 rounded-full transition relative ${form.available ? 'bg-amber-500' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.available ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{formError}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeSlide}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteMenuItemDialog
          item={deleteTarget}
          allItems={items}
          onConfirm={() => {
            deleteMutation.mutate(deleteTarget._id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
