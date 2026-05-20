import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, AlertTriangle, ExternalLink, FileText, X, Receipt } from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import PlanChangeModal from '../../components/subscription/PlanChangeModal';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import { useToast } from '../../context/ToastContext';

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({ amount: '', bankReference: '', bankName: '', paymentDate: '', notes: '', planId: '' });
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [paypalReady, setPaypalReady] = useState(false);
  const [billingDrawerOpen, setBillingDrawerOpen] = useState(false);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [addonForm, setAddonForm] = useState({ bankReference: '', bankName: '', paymentDate: '', notes: '' });
  const [addonFile, setAddonFile] = useState(null);
  const [addonApiError, setAddonApiError] = useState('');
  const addonFileRef = useRef(null);
  const addonPaypalContainerRef = useRef(null);

  const { data } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => { const { data } = await api.get('/subscriptions/my'); return data; },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['plans-for-subscription'],
    queryFn: async () => {
      const { data } = await api.get('/plans/for-subscription');
      return data;
    },
  });

  const { data: paymentOptions } = useQuery({
    queryKey: ['merchant-payment-options'],
    queryFn: async () => {
      const { data } = await api.get('/platform-payments/merchant-options');
      return data;
    },
  });

  const schedulePlanMutation = useMutation({
    mutationFn: (planId) => api.post('/subscriptions/schedule-plan', { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      setPlanModalOpen(false);
      toast.success('Plan change scheduled');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Could not schedule plan change';
      setErrors({ api: msg });
      toast.error(msg);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      setSubmitted(true);
      setForm((f) => ({ ...f, bankReference: '', bankName: '', paymentDate: '', notes: '' }));
      setFile(null);
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Upload failed' }),
  });

  const closeAddonModal = useCallback(() => {
    setAddonModalOpen(false);
    setAddonApiError('');
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('addon');
      return n;
    }, { replace: true });
  }, [setSearchParams]);

  const addonUploadMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      toast.success('Add-on payment receipt submitted. We will verify it shortly.');
      setAddonForm({ bankReference: '', bankName: '', paymentDate: '', notes: '' });
      setAddonFile(null);
      closeAddonModal();
    },
    onError: (err) => setAddonApiError(err.response?.data?.message || 'Upload failed'),
  });

  const stripeCheckoutMutation = useMutation({
    mutationFn: () => api.post('/subscriptions/checkout/stripe', { planId: form.planId }),
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Stripe checkout failed' }),
  });

  const paypalCaptureMutation = useMutation({
    mutationFn: (orderId) =>
      api.post('/subscriptions/checkout/paypal/capture', { orderId }).then((r) => r.data),
    onSuccess: (capData) => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      if (capData?.addon) {
        toast.success(capData.message || 'Guest QR ordering is now active.');
        setAddonModalOpen(false);
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev);
          n.delete('addon');
          return n;
        }, { replace: true });
        return;
      }
      setSubmitted(true);
      setErrors({});
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'PayPal capture failed' }),
  });

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      setSubmitted(true);
      searchParams.delete('payment');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  useEffect(() => {
    if (searchParams.get('addon') === 'qr_ordering') {
      setAddonModalOpen(true);
    }
  }, [searchParams]);

  const requestActivationMutation = useMutation({
    mutationFn: () => api.post(`/tenants/${data?.tenant?._id}/temporary-activation/request`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscription'] }),
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Request failed' }),
  });

  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.planId) e.planId = 'Plan selection is required';
    if (!form.bankReference.trim()) e.bankReference = 'Bank reference required';
    if (!form.paymentDate) e.paymentDate = 'Payment date required';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    if (file) fd.append('receipt', file);
    uploadMutation.mutate(fd);
  };

  const tenant = data?.tenant;
  const receipts = data?.receipts || [];
  const subscriptions = data?.subscriptions || [];
  const latestReceiptPlanId = receipts.find((r) => r.requestedPlanId?._id)?.requestedPlanId?._id;

  const latestSubscription = subscriptions?.length
    ? [...subscriptions].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0]
    : null;

  const subscriptionEndDate =
    tenant?.subscriptionStatus === 'trial'
      ? tenant?.trialEndsAt
      : latestSubscription?.endDate;

  const subscriptionEnd = subscriptionEndDate ? new Date(subscriptionEndDate) : null;

  const selectedPlan = useMemo(
    () => plans.find((p) => p._id === form.planId) || null,
    [plans, form.planId]
  );

  const { data: addonQuote, isPending: addonQuotePending, error: addonQuoteError } = useQuery({
    queryKey: ['paid-addon-quote', 'qr_ordering', tenant?._id],
    queryFn: async () => {
      const { data } = await api.get('/paid-addons/quote/qr_ordering');
      return data;
    },
    enabled: Boolean(addonModalOpen && tenant?._id),
  });

  const paypalCurrency = useMemo(() => {
    if (addonModalOpen && addonQuote?.priced?.currency) return addonQuote.priced.currency;
    return selectedPlan?.currency || 'USD';
  }, [addonModalOpen, addonQuote?.priced?.currency, selectedPlan?.currency]);

  useEffect(() => {
    if (!tenant || !plans.length) return;
    const defaultPlanId =
      (tenant.planLocked && tenant.assignedPlanId?._id) ||
      latestReceiptPlanId ||
      tenant.assignedPlanId?._id ||
      plans.find((p) => p.isDefault)?._id ||
      plans[0]?._id ||
      '';
    if (!defaultPlanId) return;
    setForm((f) => ({
      ...f,
      planId: defaultPlanId,
      amount: String((plans.find((p) => p._id === defaultPlanId)?.amount ?? f.amount)),
    }));
  }, [tenant, plans, latestReceiptPlanId]);

  useEffect(() => {
    if (!selectedPlan) return;
    setForm((f) => ({ ...f, amount: String(selectedPlan.amount) }));
  }, [selectedPlan?._id]);

  useEffect(() => {
    const wantPaypal =
      paymentOptions?.paypal?.enabled &&
      paymentOptions.paypal.clientId &&
      (paymentMethod === 'paypal' || addonModalOpen);
    if (!wantPaypal) {
      setPaypalReady(false);
      return undefined;
    }
    const currency = paypalCurrency || 'USD';
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paymentOptions.paypal.clientId)}&currency=${encodeURIComponent(currency)}`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
      setPaypalReady(false);
    };
  }, [paymentMethod, addonModalOpen, paymentOptions, paypalCurrency]);

  const paypalContainerRef = useRef(null);
  useEffect(() => {
    if (!paypalReady || paymentMethod !== 'paypal' || !window.paypal || !form.planId || !paypalContainerRef.current) return;
    paypalContainerRef.current.innerHTML = '';
    window.paypal.Buttons({
      createOrder: async () => {
        const { data } = await api.post('/subscriptions/checkout/paypal/create-order', { planId: form.planId });
        return data.orderId;
      },
      onApprove: async (data) => {
        await paypalCaptureMutation.mutateAsync(data.orderID);
      },
      onError: () => setErrors({ api: 'PayPal payment failed' }),
    }).render(paypalContainerRef.current);
  }, [paypalReady, paymentMethod, form.planId]);

  useEffect(() => {
    if (!addonModalOpen || !paypalReady || !window.paypal || !addonPaypalContainerRef.current) return undefined;
    if (addonQuote?.alreadyActive || !addonQuote?.priced?.amount) return undefined;
    const el = addonPaypalContainerRef.current;
    el.innerHTML = '';
    const buttons = window.paypal.Buttons({
      createOrder: async () => {
        const { data } = await api.post('/subscriptions/checkout/paypal/create-addon-order', { addonCode: 'qr_ordering' });
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
  }, [addonModalOpen, paypalReady, addonQuote?.alreadyActive, addonQuote?.priced?.amount]);

  const handleAddonBankSubmit = (e) => {
    e.preventDefault();
    setAddonApiError('');
    if (!addonQuote?.priced?.amount) {
      setAddonApiError('Pricing is still loading.');
      return;
    }
    const planId = tenant?.assignedPlanId?._id || tenant?.assignedPlanId || form.planId;
    if (!planId) {
      setAddonApiError('No plan on file. Contact support.');
      return;
    }
    if (!addonForm.bankReference.trim() || !addonForm.paymentDate) {
      setAddonApiError('Bank reference and payment date are required.');
      return;
    }
    const fd = new FormData();
    fd.append('addonCode', 'qr_ordering');
    fd.append('amount', String(addonQuote.priced.amount));
    fd.append('planId', String(planId));
    fd.append('bankReference', addonForm.bankReference.trim());
    fd.append('bankName', (addonForm.bankName || '').trim());
    fd.append('paymentDate', addonForm.paymentDate);
    fd.append('notes', (addonForm.notes || '').trim());
    if (addonFile) fd.append('receipt', addonFile);
    addonUploadMutation.mutate(fd);
  };

  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Subscription & Billing</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your subscription and upload payment receipts</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setBillingDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <Receipt size={15} />
            Billing breakdown
          </button>
          {tenant && !tenant?.paidAddons?.qrOrdering?.active ? (
            <button
              type="button"
              onClick={() => {
                setAddonApiError('');
                setAddonModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover"
            >
              Guest QR ordering
            </button>
          ) : null}
        </div>
      </div>

      {/* Current status */}
      {tenant && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {tenant.subscriptionStatus === 'trial' ? 'Account status' : 'Current Plan'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <p className="font-semibold capitalize text-gray-900 mt-0.5">{tenant.subscriptionStatus}</p>
            </div>
            {tenant.subscriptionStatus === 'trial' && (
              <div>
                <p className="text-xs text-gray-400">Trial ends</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {new Date(tenant.trialEndsAt).toLocaleDateString()} ({trialDaysLeft} days left)
                </p>
              </div>
            )}
            {tenant.assignedPlanId && (
              <>
                <div>
                  <p className="text-xs text-gray-400">Assigned plan</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{tenant.assignedPlanId.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Payment amount</p>
                  <p className="font-semibold text-gray-900 mt-0.5">
                    {tenant.assignedPlanId.currency || 'LKR'} {Number(tenant.assignedPlanId.amount).toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </div>

          {tenant?.status === 'suspended' && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Suspended — subscription not renewed</p>
                <p className="text-xs text-red-700 mt-1">
                  {subscriptionEnd
                    ? `Your subscription ended on ${subscriptionEnd.toLocaleDateString()}.`
                    : 'Your subscription has expired.'} Upload a payment receipt to reactivate, or request a one-day activation (if available).
                </p>
                {tenant?.temporaryActivationUntil ? (
                  <p className="text-xs text-red-700 mt-1">
                    One-day activation is active until <strong>{new Date(tenant.temporaryActivationUntil).toLocaleDateString()}</strong>.
                  </p>
                ) : tenant?.temporaryActivationRequestedAt ? (
                  <p className="text-xs text-red-700 mt-1">
                    One-day activation has been requested. Super admin will notify you once processed.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {tenant.subscriptionStatus === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 14 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                {trialDaysLeft <= 5
                  ? 'Your trial is ending soon. Submit your payment receipt below to activate your subscription without interruption.'
                  : 'You can submit your bank payment anytime during trial — our team will verify it before your trial ends.'}
              </span>
            </div>
          )}

          {tenant.subscriptionStatus === 'expired' && !tenant.temporaryActivationRequestedAt && !tenant.temporaryActivationUsedForEndDate && (
            <div className="mt-4 flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Request a 1-day activation</p>
                <p className="text-xs text-amber-700 mt-1">
                  {subscriptionEnd ? `Next expiry: ${subscriptionEnd.toLocaleDateString()} (subscription ended).` : 'Subscription ended.'}
                  {' '}
                  Super admin can enable a temporary override while you arrange payment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestActivationMutation.mutate()}
                disabled={requestActivationMutation.isPending}
                className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
              >
                {requestActivationMutation.isPending ? 'Requesting…' : 'Request 1 day'}
              </button>
            </div>
          )}
        </div>
      )}

      {tenant?.pendingPlanId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          <p className="font-semibold">Plan change scheduled</p>
          <p className="mt-1">
            You will move to <strong>{tenant.pendingPlanId.name}</strong>
            {tenant.pendingPlanEffectiveAt
              ? ` on ${new Date(tenant.pendingPlanEffectiveAt).toLocaleDateString()}`
              : ' at the end of your current period'}
            . Complete payment before that date.
          </p>
        </div>
      )}

      {plans.length > 1 && !tenant?.planLocked && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Subscription plan</h3>
            <p className="text-sm text-gray-500 mt-1">Switch plans at the end of your current billing period.</p>
          </div>
          <button
            type="button"
            onClick={() => setPlanModalOpen(true)}
            className="px-4 py-2 rounded-lg border border-brand-orange text-brand-orange text-sm font-semibold hover:bg-brand-orange/5"
          >
            Change plan
          </button>
          <PlanChangeModal
            open={planModalOpen}
            onClose={() => { setPlanModalOpen(false); toast.info('Plan change cancelled'); }}
            plans={plans.filter((p) => p._id !== tenant?.assignedPlanId?._id)}
            currentPlanId={tenant?.assignedPlanId?._id}
            onSelect={(planId) => schedulePlanMutation.mutate(planId)}
            isPending={schedulePlanMutation.isPending}
          />
        </div>
      )}

      {tenant && (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Pay for subscription</h3>
        <p className="text-sm text-gray-500 mb-4">
          {tenant.subscriptionStatus === 'trial'
            ? 'Pay by bank transfer and submit the details below — you can do this anytime during your trial so verification can finish before the trial ends.'
            : 'Submit proof of payment for your selected plan. Amount must match the plan total exactly.'}
        </p>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-800">Receipt uploaded!</p>
            <p className="text-sm text-green-600 mt-1">Our team will verify your payment within 1–2 business days.</p>
            <button onClick={() => setSubmitted(false)} className="mt-3 text-sm text-green-700 underline">
              Upload another receipt
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {paymentOptions?.stripe?.enabled && (
                <button type="button" title="Pay with card (Stripe)" onClick={() => setPaymentMethod('stripe')} className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${paymentMethod === 'stripe' ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-300'}`}>
                  <PaymentMethodLogo method="stripe" imageUrl={paymentOptions?.stripe?.imageUrl} />
                </button>
              )}
              {paymentOptions?.paypal?.enabled && (
                <button type="button" title="Pay with PayPal" onClick={() => setPaymentMethod('paypal')} className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${paymentMethod === 'paypal' ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-300'}`}>
                  <PaymentMethodLogo method="paypal" imageUrl={paymentOptions?.paypal?.imageUrl} />
                </button>
              )}
              {(paymentOptions?.bankAccounts?.length || true) && (
                <button type="button" title="Bank transfer" onClick={() => setPaymentMethod('bank_transfer')} className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${paymentMethod === 'bank_transfer' ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-300'}`}>
                  <PaymentMethodLogo method="bank_transfer" />
                  <span className="text-sm text-gray-700">Bank</span>
                </button>
              )}
            </div>
            {paymentMethod === 'stripe' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Pay securely with card via Stripe.</p>
                <button
                  type="button"
                  disabled={!form.planId || stripeCheckoutMutation.isPending}
                  onClick={() => stripeCheckoutMutation.mutate()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {stripeCheckoutMutation.isPending ? 'Redirecting…' : 'Pay with card'}
                </button>
              </div>
            )}
            {paymentMethod === 'paypal' && (
              <div className="space-y-3 min-h-[48px]">
                <p className="text-sm text-gray-600">Complete payment with PayPal.</p>
                {!form.planId && <p className="text-xs text-amber-700">Select a plan first.</p>}
                <div ref={paypalContainerRef} />
                {paypalCaptureMutation.isPending && <p className="text-sm text-gray-500">Confirming payment…</p>}
              </div>
            )}
            {paymentMethod === 'bank_transfer' && paymentOptions?.bankAccounts?.length > 0 && (
              <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="font-medium text-gray-900">Transfer to:</p>
                {paymentOptions.bankAccounts.map((b) => (
                  <div key={b._id}>
                    <p className="font-medium">{b.label} — {b.bankName}</p>
                    <p>{b.accountName} · {b.accountNumber}{b.branch ? ` · ${b.branch}` : ''}</p>
                    {b.instructions && <p className="text-xs text-gray-500 mt-0.5">{b.instructions}</p>}
                  </div>
                ))}
              </div>
            )}
            {paymentMethod === 'bank_transfer' && (
            <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                <select
                  value={form.planId}
                  disabled={tenant?.planLocked}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, planId: e.target.value }));
                    setErrors((e2) => ({ ...e2, planId: '' }));
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600 ${
                    errors.planId ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select plan</option>
                  {plans.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.currency} {Number(p.amount).toLocaleString()})
                    </option>
                  ))}
                </select>
                {tenant?.planLocked && (
                  <p className="text-xs text-amber-600 mt-1">This plan is locked by superadmin and cannot be changed.</p>
                )}
                {errors.planId && <p className="text-xs text-red-500 mt-0.5">{errors.planId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount ({selectedPlan?.currency || plans.find((p) => p._id === form.planId)?.currency || 'LKR'}) *
                </label>
                <input type="number" value={form.amount} readOnly
                  placeholder="Auto from selected plan"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors.amount ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment date *</label>
                <AdminDateField
                  value={form.paymentDate ? String(form.paymentDate).slice(0, 10) : ''}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, paymentDate: v }));
                    setErrors((e2) => ({ ...e2, paymentDate: '' }));
                  }}
                  aria-invalid={errors.paymentDate ? 'true' : undefined}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors.paymentDate ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.paymentDate && <p className="text-xs text-red-500 mt-0.5">{errors.paymentDate}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank reference / transaction ID *</label>
              <input
                type="text"
                value={form.bankReference}
                onChange={(e) => {
                  setForm((f) => ({ ...f, bankReference: e.target.value }));
                  setErrors((e2) => ({ ...e2, bankReference: '' }));
                }}
                placeholder="e.g. TXN-2026-001234"
                maxLength={64}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors.bankReference ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.bankReference && <p className="text-xs text-red-500 mt-0.5">{errors.bankReference}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank name</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                placeholder="e.g. Commercial Bank"
                maxLength={120}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt photo (optional)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} className="hidden" />
              {file ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <FileText size={16} className="text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600 text-xs">Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 hover:border-brand-orange hover:text-brand-orange transition-colors flex items-center justify-center gap-2">
                  <Upload size={16} /> Click to upload receipt
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                maxLength={2000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
              />
            </div>

            <button type="submit" disabled={uploadMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
            >
              {uploadMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              Submit receipt
            </button>
            </div>
            )}

            {errors.api && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errors.api}</p>}
          </form>
        )}
      </div>
      )}

      {/* Payment history */}
      {receipts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Payment History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {receipts.map(r => (
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
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    r.status === 'verified' ? 'bg-green-100 text-green-700'
                    : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {billingDrawerOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30 cursor-default border-0 p-0 m-0 w-full h-full"
            aria-label="Close billing panel"
            onClick={() => setBillingDrawerOpen(false)}
          />
          <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-xl border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">Current billing period</h3>
              <button
                type="button"
                onClick={() => setBillingDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm overflow-y-auto flex-1">
              {!data?.billingBreakdown ? (
                <p className="text-gray-500">Loading…</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Plan</p>
                    <p className="font-medium text-gray-900 mt-1">{data.billingBreakdown.plan?.name || '—'}</p>
                    <p className="text-gray-700 mt-0.5 tabular-nums">
                      {data.billingBreakdown.currency}{' '}
                      {Number(data.billingBreakdown.plan?.amount || 0).toLocaleString()}
                    </p>
                  </div>
                  {data.billingBreakdown.addons?.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Paid add-ons</p>
                      <ul className="space-y-2">
                        {data.billingBreakdown.addons.map((a) => (
                          <li key={a.code} className="flex justify-between gap-2 text-gray-800">
                            <span>{a.label}</span>
                            <span className="tabular-nums shrink-0">
                              {data.billingBreakdown.currency} {Number(a.amount).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="pt-4 border-t border-gray-100 flex justify-between font-semibold text-gray-900">
                    <span>Expected renewal total</span>
                    <span className="tabular-nums">
                      {data.billingBreakdown.currency} {Number(data.billingBreakdown.total || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    This is the amount to transfer for your next subscription renewal when paying by bank, including active
                    add-ons. PayPal charges the same add-on price when you purchase online.
                  </p>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {addonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900 pr-4">Guest QR table ordering</h3>
              <button type="button" onClick={closeAddonModal} className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0" aria-label="Close">
                <X size={22} />
              </button>
            </div>
            {addonQuotePending && <p className="text-sm text-gray-500">Loading quote…</p>}
            {addonQuoteError && (
              <p className="text-sm text-red-600">
                {addonQuoteError?.response?.data?.message || addonQuoteError?.message || 'Could not load add-on pricing.'}
              </p>
            )}
            {addonQuote?.alreadyActive && (
              <p className="text-green-700 text-sm font-medium">This add-on is already active on your account.</p>
            )}
            {!addonQuotePending && addonQuote && !addonQuote.alreadyActive && (
              <>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  {addonQuote.addon?.longDescription || addonQuote.addon?.shortDescription}
                </p>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-6">
                  <p className="text-sm font-semibold text-gray-900">{addonQuote.addon?.name}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {addonQuote.priced.currency} {Number(addonQuote.priced.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{addonQuote.billingLabel}</p>
                  {addonQuote.plan?.name ? (
                    <p className="text-xs text-gray-500 mt-2">Based on plan: {addonQuote.plan.name}</p>
                  ) : null}
                </div>

                {paymentOptions?.paypal?.enabled && (
                  <div className="mb-6 space-y-2">
                    <p className="text-sm font-medium text-gray-900">Pay with PayPal</p>
                    {!paypalReady ? <p className="text-xs text-gray-500">Loading PayPal…</p> : null}
                    <div ref={addonPaypalContainerRef} className="min-h-[44px]" />
                    {paypalCaptureMutation.isPending && <p className="text-xs text-gray-500">Confirming payment…</p>}
                  </div>
                )}

                {paymentOptions?.bankAccounts?.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-900">Bank transfer</p>
                    <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <p className="font-medium text-gray-900">Transfer exactly {addonQuote.priced.currency} {Number(addonQuote.priced.amount).toLocaleString()} to:</p>
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
                        <input ref={addonFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setAddonFile(e.target.files?.[0] || null)} />
                        {addonFile ? (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="truncate flex-1">{addonFile.name}</span>
                            <button type="button" className="text-xs text-gray-500 underline" onClick={() => setAddonFile(null)}>Remove</button>
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
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {addonUploadMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                        Submit add-on receipt
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">Bank transfer is not configured. Use PayPal if available, or contact support.</p>
                )}

                {addonApiError ? <p className="text-sm text-red-600 mt-3">{addonApiError}</p> : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
