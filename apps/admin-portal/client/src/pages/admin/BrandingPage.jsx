import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, Save, Palette, Trash2, X, Receipt, Printer, Sparkles } from 'lucide-react';
import { PRESET_SWATCHES } from '../../utils/posThemePresets';
import { useToast } from '../../context/ToastContext';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';
import api from '../../api/axios';
import { fieldAttrs, LIMITS, validateEmail, validateBusinessName, validateAddressLine } from '../../utils/formFields';
import MobilePhoneField, { validateMobileField, phoneValueFromField } from '../../components/MobilePhoneField';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import { parsePhoneForField } from '../../utils/phone';
import { DEFAULT_COUNTRY_CODE } from '../../constants/countries';
import imageCompression from 'browser-image-compression';
import {
  RECEIPT_PRINT_AT_OPTIONS,
  mergeReceiptPrintAtByOrderType,
} from '../../utils/receiptPrintSettings';

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
  const toast = useToast();
  const { reload: reloadCurrency } = useTenantCurrency();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [phoneCountryIso, setPhoneCountryIso] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNationalDigits, setPhoneNationalDigits] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => { const { data } = await api.get('/tenant-settings'); return data; },
  });

  useEffect(() => {
    if (settings && !form) {
      const parsed = parsePhoneForField(settings.phone, settings.countryIso || DEFAULT_COUNTRY_CODE);
      setPhoneCountryIso(parsed.countryIso);
      setPhoneNationalDigits(parsed.nationalDigits);
      setForm({
        ...settings,
        receiptPrintAtByOrderType: mergeReceiptPrintAtByOrderType(settings),
      });
    }
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/tenant-settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      reloadCurrency();
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const applyPresetMutation = useMutation({
    mutationFn: (presetId) => api.post('/tenant-settings/apply-theme-preset', { presetId }),
    onSuccess: (res) => {
      const data = res.data;
      setForm((f) => ({ ...f, ...data }));
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setPresetModalOpen(false);
      toast.success(`Theme "${data.themePresetName || 'updated'}" applied`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not apply theme'),
  });

  const logoMutation = useMutation({
    mutationFn: (fd) => api.post('/tenant-settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (response) => {
      setLogoFile(null);
      setLogoPreview(null);
      // Update form with new logo URL immediately
      if (response.data?.logoUrl) {
        setForm(f => ({ ...f, logoUrl: response.data.logoUrl, logoKey: response.data.logoKey }));
      }
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Logo uploaded');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Logo upload failed'),
  });

  const removeLogoMutation = useMutation({
    mutationFn: () => api.delete('/tenant-settings/logo'),
    onSuccess: () => {
      setLogoFile(null);
      setLogoPreview(null);
      // Update form immediately to remove logo
      setForm(f => ({ ...f, logoUrl: '', logoKey: '' }));
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Logo removed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to remove logo'),
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

  const validateBrandingForm = () => {
    const e = {};
    const nameRes = validateBusinessName(form.businessName);
    if (!nameRes.ok) e.businessName = nameRes.error;
    const addrRes = validateAddressLine(form.address, { required: true });
    if (!addrRes.ok) e.address = addrRes.error;
    const mobileErr = validateMobileField(phoneCountryIso, phoneNationalDigits);
    if (mobileErr) e.phone = mobileErr;
    const email = String(form.email || '').trim();
    if (email && !validateEmail(email)) e.email = 'Enter a valid email address';
    return e;
  };

  const handleSave = () => {
    if (!form) return;
    const errs = validateBrandingForm();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setFieldErrors({});
    const phone = phoneValueFromField(phoneCountryIso, phoneNationalDigits);
    updateMutation.mutate({
      businessName: form.businessName.trim(),
      themePresetId: form.themePresetId,
      themePresetName: form.themePresetName,
      themeBaseColor: form.themeBaseColor,
      bodyColor: form.bodyColor,
      headerBarColor: form.headerBarColor,
      buttonColor: form.buttonColor,
      selectionHighlightColor: form.selectionHighlightColor,
      hoverColor: form.hoverColor,
      buttonTextColor: form.buttonTextColor,
      headerBarTextColor: form.headerBarTextColor,
      bodyTextColor: form.bodyTextColor,
      selectionTextColor: form.selectionTextColor,
      primaryColor: form.primaryColor || form.bodyColor,
      accentColor: form.accentColor || form.buttonColor,
      sidebarColor: form.sidebarColor || form.headerBarColor,
      textColor: form.textColor || form.bodyTextColor,
      address: form.address.trim(),
      phone,
      email: String(form.email || '').trim(),
      website: form.website,
      currency: form.currency,
      currencySymbol: form.currencySymbol,
      timezone: form.timezone,
      receiptHeader: form.receiptHeader,
      receiptFooter: form.receiptFooter,
      printReceiptByDefault: form.printReceiptByDefault,
      receiptPrintAtStatus: form.receiptPrintAtStatus || 'placement',
      receiptPrintAtByOrderType: form.receiptPrintAtByOrderType || mergeReceiptPrintAtByOrderType(form),
      returnsEnabled: Boolean(form.returnsEnabled),
      returnsRequireManagerApproval: form.returnsRequireManagerApproval !== false,
    });
  };

  if (isLoading || !form) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading settings...</div>;
  }

  return (
    <div>
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
          <div className="relative w-24 h-24 shrink-0">
            <div className="w-full h-full rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
              {logoPreview || form.logoUrl ? (
                <img src={logoPreview || form.logoUrl} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <Upload size={24} className="text-gray-300" />
              )}
              {(logoPreview || form.logoUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    if (logoPreview) {
                      setLogoPreview(null);
                      setLogoFile(null);
                      if (fileRef.current) fileRef.current.value = '';
                      return;
                    }
                    removeLogoMutation.mutate();
                  }}
                  disabled={removeLogoMutation.isPending}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-gray-900/80 backdrop-blur text-white hover:bg-red-600 disabled:opacity-60 flex items-center justify-center shadow-md transition-colors"
                  title="Remove logo"
                  aria-label="Remove logo"
                >
                  {removeLogoMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              )}
            </div>
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
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Recommended: 512×512px. Will be converted to WebP.</p>
          </div>
        </div>
      </div>

      {/* Business info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Business Information</h3>
        <p className="text-sm text-gray-500">
          Contact details from your signup application are filled in the first time you open this page.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business name *</label>
          <input
            type="text"
            value={form.businessName || ''}
            onChange={(e) => {
              set('businessName')(e.target.value);
              if (fieldErrors.businessName) setFieldErrors((er) => ({ ...er, businessName: '' }));
            }}
            placeholder={fieldAttrs('businessName').placeholder}
            maxLength={fieldAttrs('businessName').maxLength}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
              fieldErrors.businessName ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {fieldErrors.businessName && <p className="text-xs text-red-500 mt-1">{fieldErrors.businessName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
          <input
            type="text"
            value={form.address || ''}
            onChange={(e) => {
              set('address')(e.target.value);
              if (fieldErrors.address) setFieldErrors((er) => ({ ...er, address: '' }));
            }}
            placeholder={fieldAttrs('addressLine1').placeholder}
            maxLength={fieldAttrs('addressLine1').maxLength}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
              fieldErrors.address ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {fieldErrors.address && <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>}
        </div>
        <MobilePhoneField
          countryIso={phoneCountryIso}
          nationalDigits={phoneNationalDigits}
          onCountryIsoChange={setPhoneCountryIso}
          onNationalDigitsChange={setPhoneNationalDigits}
          error={fieldErrors.phone}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email || ''}
            onChange={(e) => {
              set('email')(e.target.value);
              if (fieldErrors.email) setFieldErrors((er) => ({ ...er, email: '' }));
            }}
            placeholder={fieldAttrs('email').placeholder}
            maxLength={fieldAttrs('email').maxLength}
            autoComplete={fieldAttrs('email').autoComplete}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
              fieldErrors.email ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input
            type="text"
            value={form.website || ''}
            onChange={(e) => set('website')(e.target.value)}
            placeholder={fieldAttrs('website').placeholder}
            maxLength={fieldAttrs('website').maxLength}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
          />
        </div>
      </div>

      {/* Currency — receipts & POS displays */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Currency</h3>
        <p className="text-sm text-gray-500">
          ISO code and symbol used on receipts and price labels. Defaults are set from your region when the account is created; you can override them here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={form.currency || 'LKR'}
              onChange={(e) => {
                const opt = CURRENCY_OPTIONS.find((c) => c.code === e.target.value);
                setForm((f) => ({
                  ...f,
                  currency: e.target.value,
                  currencySymbol: opt?.symbol || f.currencySymbol,
                }));
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.symbol}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency symbol</label>
            <select
              value={form.currencySymbol || 'Rs.'}
              onChange={(e) => set('currencySymbol')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            >
              {[...new Set(CURRENCY_OPTIONS.map((c) => c.symbol))].map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* POS theme */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-brand-orange" /> POS theme
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose a preset palette for header, buttons, highlights, and body colors in the POS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPresetModalOpen(true)}
            className="text-sm font-semibold text-brand-orange hover:underline shrink-0"
          >
            Choose theme preset
          </button>
        </div>

        {form.themePresetName && (
          <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div
              className="w-14 h-14 rounded-xl border-2 border-white shadow-md shrink-0"
              style={{ backgroundColor: form.themeBaseColor || '#0B1220' }}
              title={form.themeBaseColor}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{form.themePresetName}</p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Base {form.themeBaseColor || '—'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Header bar', bg: 'headerBarColor', fg: 'headerBarTextColor' },
            { label: 'Buttons', bg: 'buttonColor', fg: 'buttonTextColor' },
            { label: 'Selection', bg: 'selectionHighlightColor', fg: 'selectionTextColor' },
            { label: 'Body', bg: 'bodyColor', fg: 'bodyTextColor' },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="h-8" style={{ backgroundColor: form[row.bg] || '#0B1220' }} />
              <div className="px-2 py-1.5 bg-white">
                <p className="font-medium text-gray-700">{row.label}</p>
                <p className="font-mono text-gray-400 truncate">{form[row.bg]}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Hover color: <span className="font-mono">{form.hoverColor || '—'}</span>
        </p>
      </div>

      {presetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Theme presets</h3>
              <button type="button" onClick={() => setPresetModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Each preset sets header, button, selection, hover, body, and text colors for your POS.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRESET_SWATCHES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={applyPresetMutation.isPending}
                  onClick={() => applyPresetMutation.mutate(p.id)}
                  className={`text-left rounded-xl border p-3 transition-colors hover:border-brand-orange ${
                    form.themePresetId === p.id ? 'border-brand-orange ring-2 ring-brand-orange/30' : 'border-gray-200'
                  }`}
                >
                  <div className="w-full h-10 rounded-lg mb-2 border border-gray-100" style={{ backgroundColor: p.base }} />
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{p.name}</p>
                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">{p.base}</p>
                  {form.themePresetId === p.id && (
                    <p className="text-[10px] text-brand-orange font-semibold mt-1">Current</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Receipt */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-start gap-3">
          <span className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange"><Receipt size={18} /></span>
          <div>
            <h3 className="font-semibold text-gray-900">Receipt settings</h3>
            <p className="text-sm text-gray-500 mt-0.5">Control receipt copy and when bills print automatically in the POS.</p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Receipt header', key: 'receiptHeader', attrs: fieldAttrs('receiptLine') },
              { label: 'Receipt footer', key: 'receiptFooter', attrs: { ...fieldAttrs('receiptLine'), placeholder: 'Visit us again soon.' } },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type="text"
                  value={form[f.key] || ''}
                  onChange={(e) => set(f.key)(e.target.value)}
                  placeholder={f.attrs.placeholder}
                  maxLength={f.attrs.maxLength}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.printReceiptByDefault || false}
              onChange={(e) => set('printReceiptByDefault')(e.target.checked)}
              className="w-4 h-4 accent-brand-orange"
            />
            <span>
              <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5"><Printer size={14} /> Print receipt by default at checkout</span>
              <span className="block text-xs text-gray-500 mt-0.5">Cashiers can still toggle printing per order.</span>
            </span>
          </label>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Auto-print timing by order type</p>
            <p className="text-xs text-gray-500 mb-4">Choose when the POS prints a bill for each channel.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { key: 'dine-in', label: 'Dine-in', hint: 'Table service' },
                { key: 'takeaway', label: 'Take away', hint: 'Counter pickup' },
                { key: 'uber-eats', label: 'Uber Eats', hint: 'Delivery partner' },
                { key: 'pickme', label: 'PickMe', hint: 'Delivery partner' },
              ].map(({ key, label, hint }) => (
                <div key={key} className="rounded-xl border border-gray-200 p-3 bg-white">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-[11px] text-gray-500 mb-2">{hint}</p>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Print when</label>
                  <select
                    value={form.receiptPrintAtByOrderType?.[key] || 'placement'}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        receiptPrintAtByOrderType: {
                          ...(f.receiptPrintAtByOrderType || mergeReceiptPrintAtByOrderType(f)),
                          [key]: e.target.value,
                        },
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  >
                    {RECEIPT_PRINT_AT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">POS returns</h3>
        <p className="text-sm text-gray-500">
          Control whether cashiers can process returns and whether a manager must approve each return.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.returnsEnabled)}
            onChange={(e) => set('returnsEnabled')(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-orange"
          />
          <span className="text-sm text-gray-800">Allow returns at the POS</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.returnsRequireManagerApproval !== false}
            onChange={(e) => set('returnsRequireManagerApproval')(e.target.checked)}
            disabled={!form.returnsEnabled}
            className="w-4 h-4 rounded accent-brand-orange disabled:opacity-40"
          />
          <span className="text-sm text-gray-800">Require manager approval for each return</span>
        </label>
        <p className="text-xs text-gray-500">
          Managers can set a 4–8 digit approval passcode in their POS profile (otherwise their login password is used).
        </p>
      </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <button onClick={handleSave} disabled={updateMutation.isPending || saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60 transition-all shadow-lg hover:shadow-xl"
        >
          {updateMutation.isPending ? <Loader size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}
