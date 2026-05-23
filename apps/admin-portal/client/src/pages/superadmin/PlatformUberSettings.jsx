import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader, Eye, EyeOff, Sparkles } from 'lucide-react';
import api from '../../api/axios';
import FormField, { inputClass } from '../../components/common/FormField';
import { useToast } from '../../context/ToastContext';

export default function PlatformUberSettings() {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    environment: 'sandbox',
  });
  const [showSecret, setShowSecret] = useState(false);

  // Fetch current platform settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-uber-settings'],
    queryFn: async () => {
      const { data } = await api.get('/platform-uber/settings');
      setForm({
        clientId: data.clientId || '',
        clientSecret: '', // Keep blank on load
        redirectUri: data.redirectUri || '',
        environment: data.environment || 'sandbox',
      });
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/platform-uber/settings', payload),
    onSuccess: (data) => {
      qc.setQueryData(['platform-uber-settings'], data);
      setForm((f) => ({ ...f, clientSecret: '' })); // clear input secret
      toast.success('Platform Uber Eats settings saved successfully');
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Failed to save settings');
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.clientId.trim()) {
      toast.error('Client ID is required');
      return;
    }
    if (!form.redirectUri.trim()) {
      toast.error('Redirect URI is required');
      return;
    }
    saveMutation.mutate({
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret.trim() || undefined,
      redirectUri: form.redirectUri.trim(),
      environment: form.environment,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-brand-teal" size={22} />
          Uber Eats Developer Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure the platform-wide developer application keys. These keys are used by all merchants to authenticate and authorize their individual stores.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <FormField label="Client ID" htmlFor="uber-client-id" required>
          <input
            id="uber-client-id"
            type="text"
            className={inputClass}
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            placeholder="Enter Uber Application Client ID"
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Client Secret"
          htmlFor="uber-client-secret"
          required={!settings?.clientSecretSet}
          hint={settings?.clientSecretSet ? 'A secret is already configured. Enter a value only if you wish to change it.' : 'Enter the client secret for the Uber application.'}
        >
          <div className="relative">
            <input
              id="uber-client-secret"
              type={showSecret ? 'text' : 'password'}
              className={`${inputClass} pr-10`}
              value={form.clientSecret}
              onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
              placeholder={settings?.clientSecretSet ? '••••••••••••••••' : 'Enter Uber Application Client Secret'}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <FormField
          label="Redirect URI"
          htmlFor="uber-redirect-uri"
          required
          hint="Must exactly match the redirect URI registered in the Uber Eats developer portal (e.g. https://api.yourdomain.com/api/uber/auth/callback)."
        >
          <input
            id="uber-redirect-uri"
            type="text"
            className={inputClass}
            value={form.redirectUri}
            onChange={(e) => setForm((f) => ({ ...f, redirectUri: e.target.value }))}
            placeholder="e.g. https://api.yourdomain.com/api/uber/auth/callback"
            autoComplete="off"
          />
        </FormField>

        <FormField label="Environment" htmlFor="uber-env">
          <select
            id="uber-env"
            className={inputClass}
            value={form.environment}
            onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
          >
            <option value="sandbox">Sandbox (testing & development)</option>
            <option value="production">Production (live stores)</option>
          </select>
        </FormField>

        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
          >
            {saveMutation.isPending ? (
              <Loader className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
