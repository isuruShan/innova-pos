import { Plus, Trash2 } from 'lucide-react';
import FormField, { inputClass } from '../common/FormField';
import RewardScopeCombobox from '../RewardScopeCombobox';

export default function PromotionTypeFields({ form, setForm, menuItems, categories, tiers = [] }) {
  const patch = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  if (form.type === 'bundle') {
    const bundleItems = form.bundleItems || [];
    const updateBundle = (i, data) => {
      setForm((f) => ({
        ...f,
        bundleItems: bundleItems.map((b, idx) => (idx === i ? { ...b, ...data } : b)),
      }));
    };
    return (
      <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50/80">
        <p className="text-sm font-semibold text-gray-900">Bundle deal</p>
        <FormField label="Bundle items" required>
          {bundleItems.map((bi, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <select
                value={bi.menuItem || ''}
                onChange={(e) => {
                  const item = menuItems.find((m) => String(m._id) === e.target.value);
                  updateBundle(i, { menuItem: e.target.value, name: item?.name || '' });
                }}
                className={`flex-1 ${inputClass}`}
              >
                <option value="">Select product…</option>
                {menuItems.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={bi.qty || 1}
                onChange={(e) => updateBundle(i, { qty: parseInt(e.target.value, 10) || 1 })}
                className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                aria-label="Quantity"
              />
              <button type="button" onClick={() => setForm((f) => ({ ...f, bundleItems: bundleItems.filter((_, idx) => idx !== i) }))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, bundleItems: [...(f.bundleItems || []), { menuItem: '', name: '', qty: 1 }] }))}
            className="text-sm text-brand-orange font-medium flex items-center gap-1"
          >
            <Plus size={14} /> Add bundle item
          </button>
        </FormField>
        <FormField label="Bundle price" htmlFor="bundle-price" required>
          <input id="bundle-price" type="number" min={0} step="0.01" className={inputClass} value={form.bundlePrice} onChange={patch('bundlePrice')} />
        </FormField>
      </div>
    );
  }

  if (form.type === 'buyXgetY') {
    return (
      <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50/80">
        <p className="text-sm font-semibold text-gray-900">Buy X get Y</p>
        <FormField label="Buy product" required>
          <select className={inputClass} value={form.buyItem || ''} onChange={(e) => {
            const item = menuItems.find((m) => String(m._id) === e.target.value);
            setForm((f) => ({ ...f, buyItem: e.target.value, buyItemName: item?.name || '' }));
          }}>
            <option value="">Select…</option>
            {menuItems.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </FormField>
        <FormField label="Buy quantity" htmlFor="buy-qty">
          <input id="buy-qty" type="number" min={1} className={inputClass} value={form.buyQty} onChange={patch('buyQty')} />
        </FormField>
        <FormField label="Free product" required>
          <select className={inputClass} value={form.getFreeItem || ''} onChange={(e) => {
            const item = menuItems.find((m) => String(m._id) === e.target.value);
            setForm((f) => ({ ...f, getFreeItem: e.target.value, getFreeItemName: item?.name || '' }));
          }}>
            <option value="">Select…</option>
            {menuItems.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </FormField>
        <FormField label="Free quantity" htmlFor="get-qty">
          <input id="get-qty" type="number" min={1} className={inputClass} value={form.getFreeQty} onChange={patch('getFreeQty')} />
        </FormField>
      </div>
    );
  }

  if (form.type === 'flatPrice') {
    return (
      <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50/80">
        <p className="text-sm font-semibold text-gray-900">Flat price</p>
        <RewardScopeCombobox
          menuItems={menuItems}
          isStoreReady={true}
          categoryNames={form.applicableCategories || []}
          itemIds={form.applicableItems || []}
          itemNames={form.applicableItemNames || []}
          onPatch={(patch) => {
            setForm((f) => ({
              ...f,
              applicableCategories: patch.applicableCategories !== undefined ? patch.applicableCategories : f.applicableCategories,
              applicableItems: patch.applicableItems !== undefined ? patch.applicableItems : f.applicableItems,
              applicableItemNames: patch.applicableItemNames !== undefined ? patch.applicableItemNames : f.applicableItemNames,
            }));
          }}
        />
        <FormField label="Flat price" htmlFor="flat-price" required>
          <input id="flat-price" type="number" min={0} step="0.01" className={inputClass} value={form.flatPrice} onChange={patch('flatPrice')} />
        </FormField>
      </div>
    );
  }

  if (form.type === 'flatDiscount') {
    return (
      <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50/80">
        <p className="text-sm font-semibold text-gray-900">Flat discount</p>
        <FormField label="Discount amount" htmlFor="disc-amt" required>
          <input id="disc-amt" type="number" min={0} step="0.01" className={inputClass} value={form.discountAmount} onChange={patch('discountAmount')} />
        </FormField>
        <RewardScopeCombobox
          menuItems={menuItems}
          isStoreReady={true}
          categoryNames={form.applicableCategories || []}
          itemIds={form.applicableItems || []}
          itemNames={form.applicableItemNames || []}
          onPatch={(patch) => {
            setForm((f) => ({
              ...f,
              applicableCategories: patch.applicableCategories !== undefined ? patch.applicableCategories : f.applicableCategories,
              applicableItems: patch.applicableItems !== undefined ? patch.applicableItems : f.applicableItems,
              applicableItemNames: patch.applicableItemNames !== undefined ? patch.applicableItemNames : f.applicableItemNames,
            }));
          }}
        />
      </div>
    );
  }

  if (form.type === 'percentageDiscount') {
    return (
      <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50/80">
        <p className="text-sm font-semibold text-gray-900">Percentage discount</p>
        <FormField label="Discount percent" htmlFor="disc-pct" required>
          <input id="disc-pct" type="number" min={0} max={100} className={inputClass} value={form.discountPercent} onChange={patch('discountPercent')} />
        </FormField>
        <RewardScopeCombobox
          menuItems={menuItems}
          isStoreReady={true}
          categoryNames={form.applicableCategories || []}
          itemIds={form.applicableItems || []}
          itemNames={form.applicableItemNames || []}
          onPatch={(patch) => {
            setForm((f) => ({
              ...f,
              applicableCategories: patch.applicableCategories !== undefined ? patch.applicableCategories : f.applicableCategories,
              applicableItems: patch.applicableItems !== undefined ? patch.applicableItems : f.applicableItems,
              applicableItemNames: patch.applicableItemNames !== undefined ? patch.applicableItemNames : f.applicableItemNames,
            }));
          }}
        />
      </div>
    );
  }

  return null;
}
