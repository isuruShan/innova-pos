import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader,
  AlertTriangle,
  ExternalLink,
  FileText,
  X,
  ArrowLeft,
  Upload,
} from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import AddonCatalogTiles from '../../components/addons/AddonCatalogTiles';
import { useToast } from '../../context/ToastContext';

/**
 * Paid add-ons (e.g. QR Ordering): review first, then choose an admin-configured
 * payment method, then complete PayPal or bank transfer in a dedicated step.
 */
export default function MerchantAddonsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paypalReady, setPaypalReady] = useState(false);

  /** @type {{ code: string, name: string, longDescription?: string, shortDescription?: string, priced: { amount: number, currency: string }, billingLabel: string, plan: object|null, alreadyActive: boolean } | null} */
  const [selectedAddon, setSelectedAddon] = useState(null);
  /** 'review' | 'method' | 'pay' */
  const [flowStep, setFlowStep] = useState(null);
  const [chosenMethod, setChosenMethod] = useState(null);

  const [addonForm, setAddonForm] = useState({ bankReference: '', bankName: '', paymentDate: '', notes: '' });
  const [addonFile, setAddonFile] = useState(null);
  const [addonApiError, setAddonApiError] = useState('');
  const addonFileRef = useRef(null);
  const addonPaypalContainerRef = useRef(null);

  const { data: tenantData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/my');
      return data;
    },
  });
  const tenant = tenantData?.tenant;

  const { data: catalog = [], isPending: catalogPending, error: catalogError } = useQuery({
    queryKey: ['paid-addons-merchant-catalog'],
    queryFn: () => api.get('/paid-addons/merchant-catalog').then((r) => r.data),
  });

  const { data: paymentOptions } = useQuery({
    queryKey: ['merchant-payment-options'],
    queryFn: () => api.get('/platform-payments/merchant-options').then((r) => r.data),
  });

  const paypalCaptureMutation = useMutation({
    mutationFn: (orderId) =>
      api.post('/subscriptions/checkout/paypal/capture', { orderId }).then((r) => r.data),
    onSuccess: (capData) => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['paid-addons-merchant-catalog'] });
      if (capData?.addon) {
        toast.success(capData.message || 'Add-on is now active.');
        closeFlow();
        return;
      }
      toast.error(capData?.message || 'Payment did not apply as an add-on. Please try again or contact support.');
      closeFlow();
    },
    onError: (err) => setAddonApiError(err.response?.data?.message || 'PayPal capture failed'),
  });

  const addonUploadMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['paid-addons-merchant-catalog'] });
      toast.success('Receipt submitted. Pending super admin approval.');
      closeFlow();
    },
    onError: (err) => setAddonApiError(err.response?.data?.message || 'Upload failed'),
  });

  const [unsubscribingCode, setUnsubscribingCode] = useState('');

  const unsubscribeMutation = useMutation({
    mutationFn: (code) => api.post(`/paid-addons/${encodeURIComponent(code)}/unsubscribe`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['paid-addons-merchant-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      toast.success(data?.message || 'Unsubscribe scheduled.');
      setUnsubscribingCode('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Could not unsubscribe');
      setUnsubscribingCode('');
    },
  });

  const handleUnsubscribe = (row) => {
    if (!window.confirm(
      `Unsubscribe from ${row.name}? It will stay active until the end of your current paid period, then turn off.`,
    )) return;
    setUnsubscribingCode(row.code);
    unsubscribeMutation.mutate(row.code);
  };

  const closeFlow = useCallback(() => {
    setSelectedAddon(null);
    setFlowStep(null);
    setChosenMethod(null);
    setAddonForm({ bankReference: '', bankName: '', paymentDate: '', notes: '' });
    setAddonFile(null);
    setAddonApiError('');
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('code');
      return n;
    }, { replace: true });
  }, [setSearchParams]);

  const openAddon = useCallback((row) => {
    setAddonApiError('');
    setSelectedAddon(row);
    setFlowStep('review');
    setChosenMethod(null);
  }, []);

  useEffect(() => {
    const code = String(searchParams.get('code') || '').trim().toLowerCase();
    if (!code || !catalog.length) return;
    const row = catalog.find((a) => a.code === code);
    if (row && row.canSubscribe) openAddon(row);
  }, [searchParams, catalog, openAddon]);

  const paypalCurrency = useMemo(
    () => selectedAddon?.priced?.currency || 'USD',
    [selectedAddon?.priced?.currency],
  );

  useEffect(() => {
    const needPaypal =
      flowStep === 'pay' &&
      chosenMethod === 'paypal' &&
      paymentOptions?.paypal?.enabled &&
      paymentOptions.paypal.clientId;
    if (!needPaypal) {
      setPaypalReady(false);
      return undefined;
    }
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paymentOptions.paypal.clientId)}&currency=${encodeURIComponent(paypalCurrency)}`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
      setPaypalReady(false);
    };
  }, [flowStep, chosenMethod, paymentOptions, paypalCurrency]);

  useEffect(() => {
    if (flowStep !== 'pay' || chosenMethod !== 'paypal' || !paypalReady || !window.paypal || !addonPaypalContainerRef.current) {
      return undefined;
    }
    if (!selectedAddon?.priced?.amount || selectedAddon.alreadyActive || selectedAddon.pendingVerification) {
      return undefined;
    }
    const el = addonPaypalContainerRef.current;
    el.innerHTML = '';
    const buttons = window.paypal.Buttons({
      createOrder: async () => {
        const { data } = await api.post('/subscriptions/checkout/paypal/create-addon-order', {
          addonCode: selectedAddon.code,
        });
        return data.orderId;
      },
      onApprove: async (data) => {
        await paypalCaptureMutation.mutateAsync(data.orderID);
      },
      onError: () => setAddonApiError('PayPal payment failed'),
    });
    buttons.render(el);
    return () => {
      el.innerHTML = '';
    };
  }, [flowStep, chosenMethod, paypalReady, selectedAddon, paypalCaptureMutation]);

  const methodOptions = useMemo(() => {
    const o = [];
    if (paymentOptions?.paypal?.enabled) o.push({ id: 'paypal', label: 'PayPal' });
    if (paymentOptions?.bankAccounts?.length) o.push({ id: 'bank_transfer', label: 'Bank transfer' });
    if (paymentOptions?.stripe?.enabled) o.push({ id: 'stripe', label: 'Card (Stripe)' });
    return o;
  }, [paymentOptions]);

  const handleAddonBankSubmit = (e) => {
    e.preventDefault();
    setAddonApiError('');
    if (!selectedAddon?.priced?.amount) {
      setAddonApiError('Invalid add-on.');
      return;
    }
    const planId = tenant?.assignedPlanId?._id || tenant?.assignedPlanId;
    if (!planId) {
      setAddonApiError('No plan on file. Contact support.');
      return;
    }
    if (!addonForm.bankReference.trim() || !addonForm.paymentDate) {
      setAddonApiError('Bank reference and payment date are required.');
      return;
    }
    const fd = new FormData();
    fd.append('addonCode', selectedAddon.code);
    fd.append('amount', String(selectedAddon.priced.amount));
    fd.append('planId', String(planId));
    fd.append('bankReference', addonForm.bankReference.trim());
    fd.append('bankName', (addonForm.bankName || '').trim());
    fd.append('paymentDate', addonForm.paymentDate);
    fd.append('notes', (addonForm.notes || '').trim());
    if (addonFile) fd.append('receipt', addonFile);
    addonUploadMutation.mutate(fd);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Add-ons</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Activate optional features for your venues. Prices follow your subscription billing period.
          </p>
        </div>
        <Link
          to="/subscription"
          className="text-sm font-semibold text-brand-orange hover:underline shrink-0"
        >
          Back to subscription
        </Link>
      </div>

      {catalogError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
          {catalogError?.response?.data?.message || catalogError?.message || 'Could not load add-ons.'}
        </div>
      )}

      <AddonCatalogTiles
        catalog={catalog}
        isLoading={catalogPending}
        variant="list"
        onReview={openAddon}
        onUnsubscribe={handleUnsubscribe}
        unsubscribePending={unsubscribeMutation.isPending}
        unsubscribingCode={unsubscribingCode}
      />

      {selectedAddon && flowStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900 pr-4">{selectedAddon.name}</h3>
              <button
                type="button"
                onClick={closeFlow}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            {flowStep === 'review' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedAddon.longDescription || selectedAddon.shortDescription}
                </p>
                {(selectedAddon.screenshotUrls || []).length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">App preview</p>
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                      {selectedAddon.screenshotUrls.map((url, i) => (
                        <img
                          key={`${url}-${i}`}
                          src={url}
                          alt={`${selectedAddon.name} preview ${i + 1}`}
                          className="snap-center shrink-0 w-[140px] sm:w-[160px] rounded-xl border border-gray-200 shadow-sm bg-gray-900 object-cover object-top"
                          style={{ aspectRatio: '9/16' }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Your price</p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                    {selectedAddon.priced.currency} {Number(selectedAddon.priced.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{selectedAddon.billingLabel}</p>
                </div>
                {methodOptions.length === 0 ? (
                  <div className="flex items-start gap-2 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>No payment methods are enabled yet. Ask your platform administrator to configure PayPal, bank accounts, or Stripe.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setFlowStep('method');
                      setAddonApiError('');
                    }}
                    className="w-full py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover"
                  >
                    Continue to payment
                  </button>
                )}
              </div>
            )}

            {flowStep === 'method' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Choose how you would like to pay for this add-on.</p>
                <div className="flex flex-wrap gap-2">
                  {methodOptions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setChosenMethod(m.id);
                        setAddonApiError('');
                        setFlowStep('pay');
                      }}
                      className="px-4 py-3 rounded-lg border border-gray-300 flex items-center gap-2 hover:border-brand-orange hover:bg-brand-orange/5 text-sm font-medium text-gray-800"
                    >
                      <PaymentMethodLogo
                        method={m.id === 'bank_transfer' ? 'bank_transfer' : m.id}
                        imageUrl={m.id === 'paypal' ? paymentOptions?.paypal?.imageUrl : m.id === 'stripe' ? paymentOptions?.stripe?.imageUrl : undefined}
                      />
                      {m.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setFlowStep('review')}
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft size={14} /> Back to details
                </button>
              </div>
            )}

            {flowStep === 'pay' && chosenMethod && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Pay <strong>{selectedAddon.priced.currency} {Number(selectedAddon.priced.amount).toLocaleString()}</strong> for{' '}
                  <strong>{selectedAddon.name}</strong>.
                </p>

                {chosenMethod === 'stripe' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm p-4">
                    Card checkout for add-ons is not available yet. Please use PayPal or bank transfer, or contact support.
                  </div>
                )}

                {chosenMethod === 'paypal' && (
                  <div className="space-y-2">
                    {!paypalReady ? <p className="text-xs text-gray-500">Loading PayPal…</p> : null}
                    <div ref={addonPaypalContainerRef} className="min-h-[44px]" />
                    {paypalCaptureMutation.isPending && <p className="text-xs text-gray-500">Confirming payment…</p>}
                  </div>
                )}

                {chosenMethod === 'bank_transfer' && paymentOptions?.bankAccounts?.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <p className="font-medium text-gray-900">
                        Transfer exactly {selectedAddon.priced.currency} {Number(selectedAddon.priced.amount).toLocaleString()} to:
                      </p>
                      {paymentOptions.bankAccounts.map((b) => (
                        <div key={b._id}>
                          <p className="font-medium">{b.label} — {b.bankName}</p>
                          <p>{b.accountName} · {b.accountNumber}{b.branch ? ` · ${b.branch}` : ''}</p>
                          {b.instructions ? <p className="text-xs text-gray-500 mt-0.5">{b.instructions}</p> : null}
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddonBankSubmit} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment date *</label>
                        <AdminDateField
                          value={addonForm.paymentDate ? String(addonForm.paymentDate).slice(0, 10) : ''}
                          onChange={(v) => setAddonForm((f) => ({ ...f, paymentDate: v }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm border-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank reference / transaction ID *</label>
                        <input
                          type="text"
                          value={addonForm.bankReference}
                          onChange={(e) => setAddonForm((f) => ({ ...f, bankReference: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          maxLength={64}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank name</label>
                        <input
                          type="text"
                          value={addonForm.bankName}
                          onChange={(e) => setAddonForm((f) => ({ ...f, bankName: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          maxLength={120}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Receipt photo (optional)</label>
                        <input
                          ref={addonFileRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => setAddonFile(e.target.files?.[0] || null)}
                        />
                        {addonFile ? (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FileText size={14} className="shrink-0" />
                            <span className="truncate flex-1">{addonFile.name}</span>
                            <button type="button" className="text-xs underline text-gray-500" onClick={() => setAddonFile(null)}>Remove</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => addonFileRef.current?.click()} className="text-sm text-brand-orange font-medium">
                            Attach file
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                        <textarea
                          value={addonForm.notes}
                          onChange={(e) => setAddonForm((f) => ({ ...f, notes: e.target.value }))}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                          maxLength={2000}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addonUploadMutation.isPending}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {addonUploadMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                        Submit receipt
                      </button>
                    </form>
                  </div>
                )}

                {addonApiError ? <p className="text-sm text-red-600">{addonApiError}</p> : null}

                <button
                  type="button"
                  onClick={() => {
                    setFlowStep('method');
                    setChosenMethod(null);
                    setAddonApiError('');
                  }}
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft size={14} /> Change payment method
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tenantData?.receipts?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent payment receipts</h3>
            <p className="text-xs text-gray-500 mt-1">Includes subscription and add-on submissions.</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {tenantData.receipts.slice(0, 8).map((r) => (
              <div key={r._id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {r.receiptKind === 'addon' || r.addonCode ? (
                      <span className="mr-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">Add-on</span>
                    ) : null}
                    {r.currency || 'LKR'} {Number(r.amount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{r.bankReference} · {new Date(r.paymentDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.receiptFileUrl && (
                    <a href={r.receiptFileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                      <ExternalLink size={11} /> View
                    </a>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      r.status === 'verified' ? 'bg-green-100 text-green-700'
                        : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
