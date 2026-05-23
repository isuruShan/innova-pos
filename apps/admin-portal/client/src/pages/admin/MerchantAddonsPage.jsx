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
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import AddonCatalogTiles from '../../components/addons/AddonCatalogTiles';
import { BillingQuotePanel, formatMoney } from '../../components/billing/ProrationBreakdown';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';
import BankReceiptFields from '../../components/billing/BankReceiptFields';
import { useToast } from '../../context/ToastContext';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';

/**
 * Paid add-ons (e.g. QR Ordering): review first, then choose an admin-configured
 * payment method, then complete PayPal or bank transfer in a dedicated step.
 */
export default function MerchantAddonsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isInternational } = useMerchantBillingRegion();
  const { currencySymbol: merchantSymbol } = useTenantCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paypalReady, setPaypalReady] = useState(false);

  /** @type {{ code: string, name: string, longDescription?: string, shortDescription?: string, priced: { amount: number, currency: string }, billingLabel: string, plan: object|null, alreadyActive: boolean } | null} */
  const [selectedAddon, setSelectedAddon] = useState(null);
  /** 'review' | 'method' | 'pay' */
  const [flowStep, setFlowStep] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [chosenMethod, setChosenMethod] = useState(null);

  const [addonForm, setAddonForm] = useState({ bankReference: '', notes: '' });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [addonFile, setAddonFile] = useState(null);
  const [addonApiError, setAddonApiError] = useState('');
  const [addonBankFieldErrors, setAddonBankFieldErrors] = useState({});
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

  const [trialStartingCode, setTrialStartingCode] = useState('');

  const startTrialMutation = useMutation({
    mutationFn: (code) => api.post(`/paid-addons/${encodeURIComponent(code)}/start-trial`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['paid-addons-merchant-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      toast.success(data?.message || 'Trial started successfully!');
      setTrialStartingCode('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Could not start trial');
      setTrialStartingCode('');
    },
  });

  const handleStartTrial = (row) => {
    setTrialStartingCode(row.code);
    startTrialMutation.mutate(row.code);
  };

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
    setViewOnly(false);
    setChosenMethod(null);
    setAddonForm({ bankReference: '', notes: '' });
    setAddonFile(null);
    setAddonApiError('');
    setAddonBankFieldErrors({});
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('code');
      return n;
    }, { replace: true });
  }, [setSearchParams]);

  const openAddon = useCallback(async (row, { readOnly = false } = {}) => {
    setAddonApiError('');
    setViewOnly(readOnly);
    setChosenMethod(null);
    if (!readOnly && row.canSubscribe) {
      setQuoteLoading(true);
      try {
        const { data: quote } = await api.get(`/paid-addons/quote/${encodeURIComponent(row.code)}`);
        setSelectedAddon({
          ...row,
          priced: quote.priced,
          recurringRates: quote.recurringRates,
          proration: quote.proration,
          fullCycle: quote.fullCycle,
          billingLabel: quote.billingLabel,
          longDescription: quote.addon?.longDescription || row.longDescription,
          screenshotUrls: quote.addon?.screenshotUrls?.length ? quote.addon.screenshotUrls : row.screenshotUrls,
          alreadyActive: quote.alreadyActive,
          pendingVerification: quote.pendingVerification,
        });
      } catch (err) {
        setAddonApiError(err.response?.data?.message || 'Could not load pricing');
        return;
      } finally {
        setQuoteLoading(false);
      }
    } else {
      setSelectedAddon(row);
    }
    setFlowStep('review');
  }, []);

  const openViewAddon = useCallback((row) => openAddon(row, { readOnly: true }), [openAddon]);

  useEffect(() => {
    const code = String(searchParams.get('code') || '').trim().toLowerCase();
    if (!code || !catalog.length) return;
    const row = catalog.find((a) => a.code === code);
    if (!row) return;
    if (row.canSubscribe) openAddon(row);
    else if (row.alreadyActive || row.pendingVerification) openViewAddon(row);
  }, [searchParams, catalog, openAddon, openViewAddon]);

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
    if (!isInternational) {
      if (paymentOptions?.bankAccounts?.length) o.push({ id: 'bank_transfer', label: 'Bank transfer' });
      if (paymentOptions?.stripe?.enabled) o.push({ id: 'stripe', label: 'Card (Stripe)' });
    }
    return o;
  }, [paymentOptions, isInternational]);

  useEffect(() => {
    if (isInternational && methodOptions.some((m) => m.id === 'paypal')) {
      setChosenMethod('paypal');
    }
  }, [isInternational, methodOptions]);

  const handleAddonBankSubmit = (e) => {
    e.preventDefault();
    setAddonApiError('');
    setAddonBankFieldErrors({});
    if (!selectedAddon?.priced?.amount) {
      setAddonApiError('Invalid add-on.');
      return;
    }
    const planId = tenant?.assignedPlanId?._id || tenant?.assignedPlanId;
    if (!planId) {
      setAddonApiError('No plan on file. Contact support.');
      return;
    }
    const fieldErrs = {};
    if (!addonForm.bankReference.trim()) fieldErrs.bankReference = 'Bank reference is required';
    if (!addonFile || addonFile._validationError) fieldErrs.file = addonFile?._validationError || 'Receipt photo is required';
    if (Object.keys(fieldErrs).length) { setAddonBankFieldErrors(fieldErrs); return; }
    const fd = new FormData();
    fd.append('addonCode', selectedAddon.code);
    fd.append('amount', String(selectedAddon.priced.amount));
    fd.append('planId', String(planId));
    fd.append('bankReference', addonForm.bankReference.trim());
    fd.append('notes', (addonForm.notes || '').trim());
    fd.append('receipt', addonFile);
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
        onView={openViewAddon}
        onUnsubscribe={handleUnsubscribe}
        unsubscribePending={unsubscribeMutation.isPending}
        unsubscribingCode={unsubscribingCode}
        onStartTrial={handleStartTrial}
        trialStartPending={trialStartingCode}
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
                {quoteLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-16 bg-gray-100 rounded-xl border border-gray-200" />
                  </div>
                ) : (
                  <BillingQuotePanel
                    recurringRates={selectedAddon.recurringRates}
                    proration={selectedAddon.proration}
                    amountDue={selectedAddon.priced?.amount}
                    currency={selectedAddon.priced?.currency}
                    fullCycle={selectedAddon.fullCycle}
                    merchantSymbol={merchantSymbol}
                  />
                )}
                {viewOnly ? (
                  <button
                    type="button"
                    onClick={closeFlow}
                    className="w-full py-3 rounded-xl border border-gray-300 text-gray-800 text-sm font-semibold hover:bg-gray-50"
                  >
                    Close
                  </button>
                ) : methodOptions.length === 0 ? (
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
                <BillingQuotePanel
                  recurringRates={selectedAddon.recurringRates}
                  proration={selectedAddon.proration}
                  amountDue={selectedAddon.priced?.amount}
                  currency={selectedAddon.priced?.currency}
                  fullCycle={selectedAddon.fullCycle}
                  merchantSymbol={merchantSymbol}
                />

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
                        Transfer exactly {formatMoney(selectedAddon.priced.currency, selectedAddon.priced.amount, merchantSymbol)} to:
                      </p>
                      {paymentOptions.bankAccounts.map((b) => (
                        <div key={b._id}>
                          <p className="font-medium">{b.bankName}</p>
                          <p>{b.accountName} · {b.accountNumber}{b.branch ? ` · ${b.branch}` : ''}</p>
                          {b.instructions ? <p className="text-xs text-gray-500 mt-0.5">{b.instructions}</p> : null}
                        </div>
                      ))}
                    </div>
                    <BankReceiptFields
                      bankReference={addonForm.bankReference}
                      onBankReferenceChange={(v) => setAddonForm((f) => ({ ...f, bankReference: v }))}
                      notes={addonForm.notes}
                      onNotesChange={(v) => setAddonForm((f) => ({ ...f, notes: v }))}
                      file={addonFile}
                      onFileChange={setAddonFile}
                      fileInputRef={addonFileRef}
                      error={addonApiError}
                      bankReferenceError={addonBankFieldErrors.bankReference}
                      fileError={addonBankFieldErrors.file}
                      isPending={addonUploadMutation.isPending}
                      onSubmit={handleAddonBankSubmit}
                    />
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
