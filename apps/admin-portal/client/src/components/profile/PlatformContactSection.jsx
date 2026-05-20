import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, Save } from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { fieldAttrs } from '../../utils/formFields';

const emptyForm = () => ({
  brandName: 'Cafinity POS',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  supportEmail: '',
  salesEmail: '',
  phonePrimary: '',
  phoneSecondary: '',
  websiteUrl: '',
  publicWebsiteUrl: '',
  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    youtube: '',
    tiktok: '',
  },
});

export default function PlatformContactSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);

  const { data, isPending } = useQuery({
    queryKey: ['platform-contact'],
    queryFn: () => api.get('/platform-contact').then((r) => r.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        ...emptyForm(),
        ...data,
        social: { ...emptyForm().social, ...(data.social || {}) },
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => api.put('/platform-contact', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-contact'] });
      toast.success('Platform contact details saved');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSocial = (k) => (e) =>
    setForm((f) => ({ ...f, social: { ...f.social, [k]: e.target.value } }));

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30';

  if (isPending) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="animate-spin w-6 h-6 text-gray-400" />
      </div>
    );
  }

  const websiteAttrs = fieldAttrs('website');
  const phoneAttrs = fieldAttrs('phoneDisplay');
  const emailAttrs = fieldAttrs('email');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="font-semibold text-gray-900">Platform contact & email footer</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Used in all outbound emails (address, phone, website, social links). Cached in Redis for fast delivery.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
          <input className={inputClass} value={form.brandName} onChange={set('brandName')} maxLength={80} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address line 1</label>
          <input
            className={inputClass}
            value={form.addressLine1}
            onChange={set('addressLine1')}
            maxLength={fieldAttrs('addressLine1').maxLength}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address line 2</label>
          <input
            className={inputClass}
            value={form.addressLine2}
            onChange={set('addressLine2')}
            maxLength={fieldAttrs('addressLine2').maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            className={inputClass}
            value={form.city}
            onChange={set('city')}
            placeholder={fieldAttrs('city').placeholder}
            maxLength={fieldAttrs('city').maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State / province</label>
          <input
            className={inputClass}
            value={form.region}
            onChange={set('region')}
            placeholder={fieldAttrs('region').placeholder}
            maxLength={fieldAttrs('region').maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Postal code</label>
          <input
            className={inputClass}
            value={form.postalCode}
            onChange={set('postalCode')}
            maxLength={fieldAttrs('postalCode').maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input className={inputClass} value={form.country} onChange={set('country')} maxLength={80} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support email</label>
          <input
            type="email"
            className={inputClass}
            value={form.supportEmail}
            onChange={set('supportEmail')}
            placeholder={emailAttrs.placeholder}
            maxLength={emailAttrs.maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sales email</label>
          <input
            type="email"
            className={inputClass}
            value={form.salesEmail}
            onChange={set('salesEmail')}
            maxLength={emailAttrs.maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary phone</label>
          <input
            className={inputClass}
            value={form.phonePrimary}
            onChange={set('phonePrimary')}
            placeholder={phoneAttrs.placeholder}
            maxLength={phoneAttrs.maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Secondary phone</label>
          <input
            className={inputClass}
            value={form.phoneSecondary}
            onChange={set('phoneSecondary')}
            maxLength={phoneAttrs.maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin / internal website</label>
          <input
            className={inputClass}
            value={form.websiteUrl}
            onChange={set('websiteUrl')}
            placeholder={websiteAttrs.placeholder}
            maxLength={websiteAttrs.maxLength}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Public website (email footer)</label>
          <input
            className={inputClass}
            value={form.publicWebsiteUrl}
            onChange={set('publicWebsiteUrl')}
            placeholder="https://cafinity.com"
            maxLength={websiteAttrs.maxLength}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-800 mb-3">Social media</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['facebook', 'Facebook'],
            ['instagram', 'Instagram'],
            ['linkedin', 'LinkedIn'],
            ['twitter', 'X (Twitter)'],
            ['youtube', 'YouTube'],
            ['tiktok', 'TikTok'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                className={inputClass}
                value={form.social[key] || ''}
                onChange={setSocial(key)}
                placeholder="https://"
                maxLength={websiteAttrs.maxLength}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold disabled:opacity-50"
      >
        {saveMut.isPending ? <Loader className="animate-spin w-4 h-4" /> : <Save size={16} />}
        Save platform contact
      </button>
    </div>
  );
}
