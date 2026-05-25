import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Upload, Loader, AlertTriangle, Sparkles } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import api from '../../api/axios';
import SideDrawer from '../../components/common/SideDrawer';
import TooltipWrap from '../../components/common/TooltipWrap';
import FormField, { inputClass } from '../../components/common/FormField';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import { useToast } from '../../context/ToastContext';
import { fieldAttrs } from '../../utils/formFields';

const HIDE_SECRETS = import.meta.env.VITE_HIDE_PAYMENT_SECRETS === 'true';

const TYPE_OPTIONS = [
  { id: 'stripe', label: 'Stripe (card payments)' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'bank_transfer', label: 'Bank transfer' },
];

async function optimizeToWebP(file) {
  const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 256, useWebWorker: true });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => resolve(new File([blob], 'payment-icon.webp', { type: 'image/webp' })),
          'image/webp',
          0.85,
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}

const EMPTY = {
  type: 'stripe',
  enabled: false,
  imageUrl: '',
  imageKey: '',
  publishableKey: '',
  secretKey: '',
  webhookSecret: '',
  clientId: '',
  clientSecret: '',
  mode: 'sandbox',
  label: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  branch: '',
  swiftCode: '',
  instructions: '',
  isActive: true,
};

function methodExists(methods, type) {
  const row = methods.find((m) => m.type === type);
  if (!row) return false;
  if (type === 'bank_transfer') return true;
  return Boolean(row.configured);
}

export default function PaymentProviderSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [logoFile, setLogoFile] = useState(null);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['platform-payment-methods'],
    queryFn: async () => {
      const { data } = await api.get('/platform-payments/methods');
      return data;
    },
  });

  const { data: platformSettings } = useQuery({
    queryKey: ['platform-payment-settings'],
    queryFn: async () => {
      const { data } = await api.get('/platform-payments/settings');
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform-payment-methods'] });
    qc.invalidateQueries({ queryKey: ['platform-payment-settings'] });
  };

  const togglePaidAddons = useMutation({
    mutationFn: (enabled) => api.put('/platform-payments/paid-addons-enabled', { enabled }),
    onSuccess: (res) => {
      invalidate();
      toast.success(res.data.paidAddonsEnabled ? 'Paid add-ons enabled for merchants' : 'Paid add-ons hidden from merchants');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update setting'),
  });

  const saveStripe = useMutation({
    mutationFn: (payload) => api.put('/platform-payments/stripe', { stripe: payload }),
    onSuccess: () => { invalidate(); closeDrawer(true); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save Stripe'),
  });
  const savePaypal = useMutation({
    mutationFn: (payload) => api.put('/platform-payments/paypal', { paypal: payload }),
    onSuccess: () => { invalidate(); closeDrawer(true); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save PayPal'),
  });
  const uploadLogo = useMutation({
    mutationFn: async ({ file, type }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const { data } = await api.post('/platform-payments/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setLogoFile(null);
      setForm((f) => ({ ...f, imageKey: data.key, imageUrl: data.url }));
      toast.success('Logo uploaded — save the payment method to apply');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Logo upload failed'),
  });

  const saveBank = useMutation({
    mutationFn: (payload) => {
      if (drawer?.mode === 'edit' && drawer?.id) {
        return api.put(`/platform-payments/bank-accounts/${drawer.id}`, payload);
      }
      return api.post('/platform-payments/bank-accounts', payload);
    },
    onSuccess: () => { invalidate(); closeDrawer(true); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save bank account'),
  });

  const closeDrawer = (saved) => {
    setDrawer(null);
    setForm(EMPTY);
    setLogoFile(null);
    if (!saved) toast.info('Changes discarded');
  };

  const imagePayload = () => (
    form.imageKey
      ? { imageKey: form.imageKey }
      : { imageUrl: form.imageUrl, imageKey: '' }
  );

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type. Please select an image.');
      e.target.value = '';
      return;
    }
    try {
      const webp = await optimizeToWebP(file);
      setLogoFile(webp);
      setForm((f) => ({ ...f, imageKey: '', imageUrl: URL.createObjectURL(webp) }));
    } catch {
      toast.error('Could not process image');
    }
  };

  const handleUploadLogo = () => {
    if (!logoFile) return;
    uploadLogo.mutate({ file: logoFile, type: form.type });
  };

  const openCreate = () => {
    const available = TYPE_OPTIONS.find((t) => !methodExists(methods, t.id));
    setForm({ ...EMPTY, type: available?.id || 'stripe' });
    setDrawer({ mode: 'create' });
  };

  const openEdit = (row) => {
    const d = row.details || {};
    if (row.type === 'stripe') {
      setForm({
        ...EMPTY,
        type: 'stripe',
        enabled: row.enabled,
        imageUrl: row.imageUrl || d.imageUrl || '',
        imageKey: d.imageKey || '',
        publishableKey: d.publishableKey || '',
        secretKey: '',
        webhookSecret: '',
      });
    } else if (row.type === 'paypal') {
      setForm({
        ...EMPTY,
        type: 'paypal',
        enabled: row.enabled,
        imageUrl: row.imageUrl || d.imageUrl || '',
        imageKey: d.imageKey || '',
        clientId: d.clientId || '',
        clientSecret: '',
        mode: d.mode || 'sandbox',
      });
    } else {
      setForm({
        ...EMPTY,
        type: 'bank_transfer',
        enabled: row.enabled,
        imageUrl: row.imageUrl || d.imageUrl || '',
        imageKey: d.imageKey || '',
        label: d.label || '',
        bankName: d.bankName || '',
        accountName: d.accountName || '',
        accountNumber: d.accountNumber || '',
        branch: d.branch || '',
        swiftCode: d.swiftCode || '',
        instructions: d.instructions || '',
        isActive: d.isActive !== false,
      });
    }
    setDrawer({ mode: 'edit', id: row.id, type: row.type });
  };

  const canAdd = useMemo(
    () => TYPE_OPTIONS.some((t) => !methodExists(methods, t.id)),
    [methods],
  );

  const handleSave = () => {
    if (form.type === 'stripe') {
      saveStripe.mutate({
        enabled: form.enabled,
        publishableKey: form.publishableKey,
        ...imagePayload(),
        secretKey: form.secretKey || undefined,
        webhookSecret: form.webhookSecret || undefined,
      });
    } else if (form.type === 'paypal') {
      savePaypal.mutate({
        enabled: form.enabled,
        clientId: form.clientId,
        ...imagePayload(),
        clientSecret: form.clientSecret || undefined,
        mode: form.mode,
      });
    } else {
      saveBank.mutate({
        label: form.label,
        bankName: form.bankName,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        branch: form.branch,
        swiftCode: form.swiftCode,
        instructions: form.instructions,
        ...imagePayload(),
        isActive: form.isActive,
      });
    }
  };

  const pending = saveStripe.isPending || savePaypal.isPending || saveBank.isPending;
  const isEdit = drawer?.mode === 'edit';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payment methods</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            One Stripe, one PayPal, and one bank transfer option for merchant subscriptions.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            <Link to="/plans" className="text-brand-orange font-medium hover:underline">Subscription plans</Link>
            {HIDE_SECRETS ? ' · Secret fields hidden (VITE_HIDE_PAYMENT_SECRETS=true)' : ' · All credential fields visible'}
          </p>
        </div>
        {canAdd && (
          <TooltipWrap title="Add a payment method type that is not configured yet">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold"
            >
              <Plus size={16} /> Add payment method
            </button>
          </TooltipWrap>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Method</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-gray-500">Loading…</td></tr>
            ) : (
              TYPE_OPTIONS.map((opt) => {
                const row = methods.find((m) => m.type === opt.id);
                if (!row && opt.id === 'bank_transfer') {
                  return (
                    <tr key={opt.id} className="border-t border-gray-100 text-gray-500">
                      <td className="px-4 py-3 flex items-center gap-3">
                        <PaymentMethodLogo method={opt.id} size="sm" />
                        <span>{opt.label}</span>
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-xs">Not configured</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => { setForm({ ...EMPTY, type: 'bank_transfer' }); setDrawer({ mode: 'create' }); }} className="text-brand-orange text-xs font-semibold">Set up</button>
                      </td>
                    </tr>
                  );
                }
                if (!row) return null;
                return (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PaymentMethodLogo method={row.type} imageUrl={row.imageUrl} size="sm" />
                        <span className="font-medium text-gray-900">{opt.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {row.configured ? (row.enabled ? 'Enabled' : 'Disabled') : 'Not set up'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-sm">
                      {row.type === 'bank_transfer' && `${row.details?.bankName || '—'} · ${row.details?.accountNumber || '—'}`}
                      {row.type === 'stripe' && `Publishable key: ${row.details?.publishableKey ? 'set' : '—'}`}
                      {row.type === 'paypal' && `Client ID: ${row.details?.clientId ? 'set' : '—'} (${row.details?.mode})`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TooltipWrap title="Edit payment method">
                        <button type="button" onClick={() => openEdit(row)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                          <Pencil size={16} />
                        </button>
                      </TooltipWrap>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paid Add-ons Global Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-700">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Paid add-ons visibility</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Control whether merchants can see and purchase paid add-ons (QR ordering, loyalty, etc.)
              </p>
              {platformSettings?.paidAddonsEnabled === false && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Add-ons are currently hidden from merchants
                </p>
              )}
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={platformSettings?.paidAddonsEnabled !== false}
              onChange={(e) => togglePaidAddons.mutate(e.target.checked)}
              disabled={togglePaidAddons.isPending}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-orange/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange peer-disabled:opacity-50" />
          </label>
        </div>
      </div>

      <SideDrawer
        open={Boolean(drawer)}
        onClose={() => closeDrawer(false)}
        title={isEdit ? 'Edit payment method' : 'Add payment method'}
        subtitle="Credentials are stored securely on the server."
        width="max-w-lg"
        footer={(
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => closeDrawer(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
            <button type="button" disabled={pending} onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-brand-orange text-white font-semibold disabled:opacity-60">
              Save payment method
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <FormField label="Payment type" htmlFor="pay-type" required>
            <select
              id="pay-type"
              disabled={isEdit}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className={inputClass}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id} disabled={!isEdit && methodExists(methods, t.id)}>
                  {t.label}{!isEdit && methodExists(methods, t.id) ? ' (already added)' : ''}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Display logo" hint="Shown on the merchant subscription page. Upload an image or paste a URL; leave both empty for the default logo.">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="pay-logo-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoChange}
                className="text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700"
              />
              <button
                type="button"
                disabled={!logoFile || uploadLogo.isPending}
                onClick={handleUploadLogo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white disabled:opacity-50"
              >
                {uploadLogo.isPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
              {form.imageKey && !logoFile && (
                <span className="text-xs text-green-700">Uploaded — save to persist</span>
              )}
            </div>
            <input
              id="pay-image"
              className={`${inputClass} mt-2`}
              value={form.imageKey ? '' : form.imageUrl}
              disabled={Boolean(form.imageKey)}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value, imageKey: '' }))}
              placeholder={form.imageKey ? 'Using uploaded image' : 'Or paste image URL (https://… or /payment-icons/…)'}
            />
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50 flex justify-center">
              <PaymentMethodLogo method={form.type} imageUrl={form.imageUrl} size="lg" />
            </div>
          </FormField>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="accent-brand-orange" />
            Enabled for merchants
          </label>

          {form.type === 'stripe' && (
            <>
              <FormField label="Stripe publishable key" htmlFor="stripe-pk" required>
                <input id="stripe-pk" className={inputClass} value={form.publishableKey} onChange={(e) => setForm((f) => ({ ...f, publishableKey: e.target.value }))} autoComplete="off" />
              </FormField>
              {!HIDE_SECRETS && (
                <>
                  <FormField label="Stripe secret key" htmlFor="stripe-sk" hint="Leave blank when editing to keep the existing secret.">
                    <input id="stripe-sk" type="password" className={inputClass} value={form.secretKey} onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))} autoComplete="new-password" />
                  </FormField>
                  <FormField label="Stripe webhook secret" htmlFor="stripe-wh" hint="Leave blank when editing to keep the existing value.">
                    <input id="stripe-wh" type="password" className={inputClass} value={form.webhookSecret} onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))} autoComplete="new-password" />
                  </FormField>
                </>
              )}
            </>
          )}

          {form.type === 'paypal' && (
            <>
              <FormField label="PayPal client ID" htmlFor="paypal-cid" required>
                <input id="paypal-cid" className={inputClass} value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} autoComplete="off" />
              </FormField>
              {!HIDE_SECRETS && (
                <FormField label="PayPal client secret" htmlFor="paypal-cs" hint="Leave blank when editing to keep the existing secret.">
                  <input id="paypal-cs" type="password" className={inputClass} value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} autoComplete="new-password" />
                </FormField>
              )}
              <FormField label="PayPal environment" htmlFor="paypal-mode">
                <select id="paypal-mode" className={inputClass} value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="live">Live (production)</option>
                </select>
              </FormField>
            </>
          )}

          {form.type === 'bank_transfer' && (
            <>
              <FormField label="Account label" htmlFor="bank-label" required hint="Short name merchants will see, e.g. Main LKR account">
                <input id="bank-label" className={inputClass} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} {...fieldAttrs('bankLabel')} />
              </FormField>
              <FormField label="Bank name" htmlFor="bank-name" required>
                <input id="bank-name" className={inputClass} value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} {...fieldAttrs('bankName')} />
              </FormField>
              <FormField label="Account holder name" htmlFor="bank-holder" required>
                <input id="bank-holder" className={inputClass} value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} {...fieldAttrs('ownerName')} />
              </FormField>
              <FormField label="Account number" htmlFor="bank-num" required>
                <input id="bank-num" className={inputClass} value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} {...fieldAttrs('accountNumber')} />
              </FormField>
              <FormField label="Branch" htmlFor="bank-branch">
                <input id="bank-branch" className={inputClass} value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} maxLength={fieldAttrs('city').maxLength} placeholder={fieldAttrs('city').placeholder} />
              </FormField>
              <FormField label="SWIFT / BIC" htmlFor="bank-swift">
                <input id="bank-swift" className={inputClass} value={form.swiftCode} onChange={(e) => setForm((f) => ({ ...f, swiftCode: e.target.value }))} {...fieldAttrs('swiftCode')} />
              </FormField>
              <FormField label="Payment instructions" htmlFor="bank-inst" hint="Shown to merchants when they choose bank transfer.">
                <textarea id="bank-inst" rows={3} className={inputClass} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} {...fieldAttrs('reason')} />
              </FormField>
            </>
          )}
        </div>
      </SideDrawer>
    </div>
  );
}
