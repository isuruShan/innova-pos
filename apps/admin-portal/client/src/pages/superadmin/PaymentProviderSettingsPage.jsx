import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';

export default function PaymentProviderSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['platform-payment-settings'],
    queryFn: async () => { const { data } = await api.get('/platform-payments/settings'); return data; },
  });

  const [form, setForm] = useState({ bankAccounts: [], stripe: { enabled: false, publishableKey: '', secretKey: '', webhookSecret: '' }, paypal: { enabled: false, clientId: '', clientSecret: '', mode: 'sandbox' } });

  useEffect(() => {
    if (data) setForm({
      bankAccounts: data.bankAccounts || [],
      stripe: { enabled: data.stripe?.enabled || false, publishableKey: data.stripe?.publishableKey || '', secretKey: '', webhookSecret: '' },
      paypal: { enabled: data.paypal?.enabled || false, clientId: data.paypal?.clientId || '', clientSecret: '', mode: data.paypal?.mode || 'sandbox' },
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/platform-payments/settings', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-payment-settings'] }),
  });

  const addBank = () => setForm((f) => ({ ...f, bankAccounts: [...f.bankAccounts, { label: '', bankName: '', accountName: '', accountNumber: '', branch: '', instructions: '', isActive: true }] }));

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Payment provider setup</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure how merchants pay for subscriptions (bank transfer, Stripe, PayPal).</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Bank accounts</h3>
          {form.bankAccounts.map((b, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-gray-100 rounded-lg p-3">
              <input placeholder="Label (e.g. Main account)" className="border rounded-lg px-3 py-2 text-sm" value={b.label} onChange={(e) => { const next = [...form.bankAccounts]; next[i] = { ...next[i], label: e.target.value }; setForm((f) => ({ ...f, bankAccounts: next })); }} />
              <input placeholder="Bank name" className="border rounded-lg px-3 py-2 text-sm" value={b.bankName} onChange={(e) => { const next = [...form.bankAccounts]; next[i] = { ...next[i], bankName: e.target.value }; setForm((f) => ({ ...f, bankAccounts: next })); }} />
              <input placeholder="Account name" className="border rounded-lg px-3 py-2 text-sm" value={b.accountName} onChange={(e) => { const next = [...form.bankAccounts]; next[i] = { ...next[i], accountName: e.target.value }; setForm((f) => ({ ...f, bankAccounts: next })); }} />
              <input placeholder="Account number" className="border rounded-lg px-3 py-2 text-sm" value={b.accountNumber} onChange={(e) => { const next = [...form.bankAccounts]; next[i] = { ...next[i], accountNumber: e.target.value }; setForm((f) => ({ ...f, bankAccounts: next })); }} />
            </div>
          ))}
          <button type="button" onClick={addBank} className="text-sm text-brand-orange font-semibold">+ Add bank account</button>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.stripe.enabled} onChange={(e) => setForm((f) => ({ ...f, stripe: { ...f.stripe, enabled: e.target.checked } }))} /> Enable Stripe</label>
          <input placeholder="Stripe publishable key" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.stripe.publishableKey} onChange={(e) => setForm((f) => ({ ...f, stripe: { ...f.stripe, publishableKey: e.target.value } }))} />
          <input type="password" placeholder="Stripe secret key (leave blank to keep)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.stripe.secretKey} onChange={(e) => setForm((f) => ({ ...f, stripe: { ...f.stripe, secretKey: e.target.value } }))} />
          <input type="password" placeholder="Stripe webhook secret (leave blank to keep)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.stripe.webhookSecret} onChange={(e) => setForm((f) => ({ ...f, stripe: { ...f.stripe, webhookSecret: e.target.value } }))} />
          {data?.stripe?.secretKeySet && <p className="text-xs text-green-700">Secret key is configured on the server.</p>}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.paypal.enabled} onChange={(e) => setForm((f) => ({ ...f, paypal: { ...f.paypal, enabled: e.target.checked } }))} /> Enable PayPal</label>
          <input placeholder="PayPal client ID" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.paypal.clientId} onChange={(e) => setForm((f) => ({ ...f, paypal: { ...f.paypal, clientId: e.target.value } }))} />
          <input type="password" placeholder="PayPal client secret (leave blank to keep)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.paypal.clientSecret} onChange={(e) => setForm((f) => ({ ...f, paypal: { ...f.paypal, clientSecret: e.target.value } }))} />
          <select className="border rounded-lg px-3 py-2 text-sm" value={form.paypal.mode} onChange={(e) => setForm((f) => ({ ...f, paypal: { ...f.paypal, mode: e.target.value } }))}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
        </section>

        <button type="submit" disabled={saveMutation.isPending} className="px-5 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold disabled:opacity-60">Save settings</button>
      </form>
    </div>
  );
}
