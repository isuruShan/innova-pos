import { useState } from 'react';
import { X } from 'lucide-react';

const PAYMENT_OPTS = ['cash', 'card', 'bank_transfer', 'mobile_wallet'];

export default function StoreCreateDrawer({ open, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    paymentMethods: ['cash'],
  });

  if (!open) return null;

  const toggleMethod = (m) => {
    setForm((p) => {
      const has = p.paymentMethods.includes(m);
      let next = has ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m];
      if (!next.includes('cash')) next = ['cash', ...next];
      return { ...p, paymentMethods: [...new Set(next)] };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <aside className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Create store</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Store name</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Main Street branch" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={120} required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Store code</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. COL-01" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} maxLength={32} required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Building name and street" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} maxLength={200} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 77 123 4567" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} maxLength={20} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment methods</label>
            <div className="flex flex-wrap gap-3">
              {PAYMENT_OPTS.map((m) => (
                <label key={m} className="text-sm flex items-center gap-1.5 capitalize">
                  <input type="checkbox" checked={form.paymentMethods.includes(m)} disabled={m === 'cash'} onChange={() => toggleMethod(m)} />
                  {m.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isPending} className="w-full py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold disabled:opacity-60">
            {isPending ? 'Creating…' : 'Create store'}
          </button>
        </form>
      </aside>
    </div>
  );
}
