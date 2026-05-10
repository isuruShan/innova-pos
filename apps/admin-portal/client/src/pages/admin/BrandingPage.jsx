import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, Save, Palette, X } from 'lucide-react';
import api from '../../api/axios';
import imageCompression from 'browser-image-compression';

async function optimizeToWebP(file) {
  const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 512, useWebWorker: true });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(blob => resolve(new File([blob], 'logo.webp', { type: 'image/webp' })), 'image/webp', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(compressed);
    reader.onerror = reject;
  });
}

export default function BrandingPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => { const { data } = await api.get('/tenant-settings'); return data; },
    onSuccess: (d) => setForm({ ...d }),
  });

  useEffect(() => {
    if (settings && !form) setForm({ ...settings });
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/tenant-settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const logoMutation = useMutation({
    mutationFn: (fd) => api.post('/tenant-settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (d) => {
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
  });

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
    const webp = await optimizeToWebP(file);
    setLogoFile(webp);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    const fd = new FormData();
    fd.append('logo', logoFile);
    logoMutation.mutate(fd);
  };

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form) return;
    updateMutation.mutate({
      businessName: form.businessName,
      tagline: form.tagline,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      sidebarColor: form.sidebarColor,
      textColor: form.textColor,
      selectionTextColor: form.selectionTextColor,
      address: form.address,
      phone: form.phone,
      email: form.email,
      website: form.website,
      currency: form.currency,
      currencySymbol: form.currencySymbol,
      timezone: form.timezone,
      receiptHeader: form.receiptHeader,
      receiptFooter: form.receiptFooter,
      printReceiptByDefault: form.printReceiptByDefault,
      receiptPrintAtStatus: form.receiptPrintAtStatus || 'placement',
    });
  };

  if (isLoading || !form) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Branding & Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Customize your POS appearance and business details</p>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Palette size={16} className="text-brand-orange" /> Logo
        </h3>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
            {logoPreview || form.logoUrl ? (
              <img src={logoPreview || form.logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <Upload size={24} className="text-gray-300" />
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Choose image
              </button>
              {logoFile && (
                <button onClick={handleUploadLogo} disabled={logoMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-60"
                >
                  {logoMutation.isPending ? <Loader size={13} className="animate-spin" /> : <Upload size={13} />}
                  Upload
                </button>
              )}
              {logoPreview && (
                <button onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Recommended: 512×512px. Will be converted to WebP.</p>
          </div>
        </div>
      </div>

      {/* Business info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Business Information</h3>
        {[
          { label: 'Business name', key: 'businessName', placeholder: 'The Coffee Corner' },
          { label: 'Tagline', key: 'tagline', placeholder: 'Great coffee, every time' },
          { label: 'Address', key: 'address', placeholder: '123 Main Street, Colombo' },
          { label: 'Phone', key: 'phone', placeholder: '+94 77 000 0000' },
          { label: 'Email', key: 'email', type: 'email', placeholder: 'info@business.com' },
          { label: 'Website', key: 'website', placeholder: 'https://yourbusiness.com' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
            <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => set(f.key)(e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" />
          </div>
        ))}
      </div>

      {/* Currency — receipts & POS displays */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Currency</h3>
        <p className="text-sm text-gray-500">
          ISO code and symbol used on receipts and price labels. Defaults are set from your region when the account is created; you can override them here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency code</label>
            <input
              value={form.currency || ''}
              onChange={(e) => set('currency')(e.target.value.toUpperCase())}
              placeholder="LKR"
              maxLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
            <input
              value={form.currencySymbol || ''}
              onChange={(e) => set('currencySymbol')(e.target.value)}
              placeholder="Rs."
              maxLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">POS Colors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Primary color', key: 'primaryColor' },
            { label: 'Accent color', key: 'accentColor' },
            { label: 'Sidebar color', key: 'sidebarColor' },
            { label: 'Text color', key: 'textColor' },
            {
              label: 'Selected tab & control text',
              key: 'selectionTextColor',
              hint: 'Labels on active tabs, nav links, filter chips, payment method, and highlighted menu rows.',
            },
          ].map(c => (
            <div key={c.key} className="flex items-start gap-3">
              <input type="color" value={form[c.key] || '#ffffff'} onChange={e => set(c.key)(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">{c.label}</p>
                <p className="text-xs text-gray-400 font-mono">{form[c.key] || '#ffffff'}</p>
                {c.hint && <p className="text-xs text-gray-500 mt-1 leading-snug">{c.hint}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Receipt */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Receipt Settings</h3>
        {[
          { label: 'Receipt header', key: 'receiptHeader', placeholder: 'Thank you for visiting!' },
          { label: 'Receipt footer', key: 'receiptFooter', placeholder: 'Visit us again soon.' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
            <input type="text" value={form[f.key] || ''} onChange={e => set(f.key)(e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" />
          </div>
        ))}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.printReceiptByDefault || false}
            onChange={e => set('printReceiptByDefault')(e.target.checked)}
            className="w-4 h-4 accent-brand-orange" />
          <span className="text-sm font-medium text-gray-700">Print receipt by default</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Print bill when order reaches</label>
          <select
            value={form.receiptPrintAtStatus || 'placement'}
            onChange={(e) => set('receiptPrintAtStatus')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
          >
            <option value="placement">When order is placed (checkout)</option>
            <option value="preparing">When sent to kitchen (preparing)</option>
            <option value="ready">When order is ready</option>
            <option value="completed">When order is completed</option>
            <option value="none">Never print automatically</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            POS opens the receipt printer at this step (unless set to never). Checkout still records payment either way.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
        >
          {updateMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          Save changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle size={15} /> Saved!
          </span>
        )}
        {updateMutation.isError && (
          <span className="text-sm text-red-600">Failed to save. Please try again.</span>
        )}
      </div>
    </div>
  );
}
