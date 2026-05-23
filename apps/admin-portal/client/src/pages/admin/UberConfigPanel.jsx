import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Save, Loader, RefreshCw, CheckCircle2, AlertCircle, HelpCircle, Key, Settings, Sparkles } from 'lucide-react';
import api from '../../api/axios';
import FormField, { inputClass } from '../../components/common/FormField';
import { useToast } from '../../context/ToastContext';

export default function UberConfigPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [autoAccept, setAutoAccept] = useState(false);
  const [defaultPrepTime, setDefaultPrepTime] = useState(15);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [stores, setStores] = useState([]);

  // Check query params for redirected connections
  useEffect(() => {
    if (searchParams.get('uber_connected') === 'true') {
      toast.success('Successfully connected store to Uber Eats!');
      setSearchParams(prev => {
        const n = new URLSearchParams(prev);
        n.delete('uber_connected');
        return n;
      }, { replace: true });
    }
  }, [searchParams, toast, setSearchParams]);

  // Fetch current merchant Uber config
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['merchant-uber-config'],
    queryFn: async () => {
      const { data } = await api.get('/merchant-uber/config');
      setAutoAccept(data.autoAccept || false);
      setDefaultPrepTime(data.defaultPrepTime || 15);
      setWebhookSecret(data.webhookSecret || '');
      setStores(data.stores || []);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/merchant-uber/config', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-uber-config'] });
      toast.success('Uber Eats settings saved successfully');
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Failed to save settings');
    },
  });

  const syncMenuMutation = useMutation({
    mutationFn: (storeId) => api.post('/merchant-uber/menu/sync', { storeId }),
    onSuccess: () => {
      toast.success('Menu successfully synchronized to Uber Eats!');
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Menu synchronization failed');
    },
  });

  const connectMutation = useMutation({
    mutationFn: (storeId) => api.get('/merchant-uber/auth/initiate', { params: { storeId } }).then(r => r.data),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url; // Redirect to Uber OAuth
      } else {
        toast.error('Failed to generate OAuth redirect link');
      }
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Could not initiate connection');
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      autoAccept,
      defaultPrepTime,
      webhookSecret,
      stores: stores.map(s => ({
        storeId: s.storeId,
        uberStoreId: s.uberStoreId,
      })),
    });
  };

  const handleStoreUberIdChange = (storeId, val) => {
    setStores(prev => prev.map(s => s.storeId === storeId ? { ...s, uberStoreId: val } : s));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-4 flex items-center gap-2 max-w-2xl">
        <AlertCircle size={20} className="shrink-0" />
        <span>Failed to load configuration. Make sure you have the Uber Eats Integration add-on active.</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-brand-teal" size={22} />
          Uber Eats Integration Settings
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Connect your POS store locations to Uber Eats. Set auto-accept options and trigger menu synchronizations manually.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2">
            General Preferences
          </h3>

          <div className="flex items-start gap-3">
            <input
              id="uber-auto-accept"
              type="checkbox"
              checked={autoAccept}
              onChange={(e) => setAutoAccept(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
            />
            <div className="text-sm">
              <label htmlFor="uber-auto-accept" className="font-semibold text-gray-900 cursor-pointer">
                Auto-Accept Incoming Orders
              </label>
              <p className="text-gray-500 mt-0.5">
                If enabled, incoming Uber Eats orders will bypass the cashier confirmation overlay modal and immediately flow to the Preparing queue.
              </p>
            </div>
          </div>

          <FormField label="Default Preparation Time" htmlFor="uber-prep-time">
            <select
              id="uber-prep-time"
              className={inputClass}
              value={defaultPrepTime}
              onChange={(e) => setDefaultPrepTime(parseInt(e.target.value, 10))}
            >
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
              <option value={20}>20 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={45}>45 Minutes</option>
            </select>
          </FormField>

          <FormField
            label="Webhook Signature Verification Secret"
            htmlFor="uber-wh-secret"
            hint="Provided by Uber when setting up your developer webhook URL. Used to verify signature headers and protect your endpoints."
          >
            <input
              id="uber-wh-secret"
              type="text"
              className={inputClass}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Enter webhook secret verification key"
              autoComplete="off"
            />
          </FormField>
        </div>

        {/* Store Mappings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2">
            Store Locations & Connections
          </h3>

          <div className="divide-y divide-gray-100">
            {stores.map((store) => (
              <div key={store.storeId} className="py-4 first:pt-0 last:pb-0 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-gray-950 text-sm">{store.storeName}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">POS Store ID: {store.storeId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {store.isConnected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 size={12} /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                        <AlertCircle size={12} /> Disconnected
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField label="Uber Store UUID" htmlFor={`uber-store-id-${store.storeId}`} required>
                    <input
                      id={`uber-store-id-${store.storeId}`}
                      type="text"
                      className={inputClass}
                      value={store.uberStoreId}
                      onChange={(e) => handleStoreUberIdChange(store.storeId, e.target.value)}
                      placeholder="e.g. 8a90184b-703c-449e-8c88-e21b0337c768"
                      autoComplete="off"
                    />
                  </FormField>

                  <div className="flex flex-wrap items-end gap-2 pb-1.5 md:h-[68px]">
                    <button
                      type="button"
                      disabled={!store.uberStoreId || connectMutation.isPending}
                      onClick={() => connectMutation.mutate(store.storeId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-800 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} />
                      {store.isConnected ? 'Reconnect Uber' : 'Connect Uber'}
                    </button>
                    {store.isConnected && (
                      <button
                        type="button"
                        disabled={syncMenuMutation.isPending}
                        onClick={() => syncMenuMutation.mutate(store.storeId)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-teal hover:bg-brand-teal/90 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {syncMenuMutation.isPending ? (
                          <Loader className="animate-spin" size={12} />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Sync Menu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {stores.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">No active stores found for this account.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
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
