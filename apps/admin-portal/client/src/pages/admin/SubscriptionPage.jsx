import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, AlertTriangle, ExternalLink, ImageIcon, X, Search, Copy, Check, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { validateImageFile } from '../../components/billing/BankReceiptFields';
import api from '../../api/axios';
import PlanChangeModal from '../../components/subscription/PlanChangeModal';
import BillingBreakdownPanel from '../../components/billing/BillingBreakdownPanel';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import PaymentReceiptDetailModal from '../../components/payments/PaymentReceiptDetailModal';
import ListPagination from '../../components/common/ListPagination';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useToast } from '../../context/ToastContext';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';
import { formatMoney, BillingQuotePanel, LicenseQuoteBreakdown } from '../../components/billing/ProrationBreakdown';
import { useAuth } from '../../context/AuthContext';

const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  paypal: 'PayPal',
};

function CopyableRef({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy reference to clipboard"
      className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-500 hover:text-brand-orange bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors cursor-pointer border-0"
    >
      <span>{text}</span>
      {copied ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
    </button>
  );
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuspended = user?.subscriptionActive === false;
  
  // Route-based tab navigation
  const getActiveTab = () => {
    if (location.pathname.endsWith('/breakdown')) return 'breakdown';
    if (location.pathname.endsWith('/payments')) return 'payments';
    return 'overview';
  };
  const activeTab = getActiveTab();
  const setActiveTab = (tab) => navigate(`/subscription/${tab}`);
  
  // Payment History Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [receiptPage, setReceiptPage] = useState(1);
  const [detailReceiptId, setDetailReceiptId] = useState(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({ amount: '', bankReference: '', notes: '', planId: '' });
  const { isInternational, billingNote } = useMerchantBillingRegion();
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [paypalReady, setPaypalReady] = useState(false);
  
  const { data } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => { const { data } = await api.get('/subscriptions/my'); return data; },
  });

  const needsBreakdown = activeTab === 'overview' || activeTab === 'breakdown';
  const { data: breakdownData } = useQuery({
    queryKey: ['my-subscription-breakdown'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/my', { params: { includeBreakdown: '1' } });
      return data;
    },
    enabled: needsBreakdown,
  });

  const receiptQueryParams = useMemo(() => {
    const params = { page: receiptPage, limit: 25 };
    if (statusFilter) params.status = statusFilter;
    if (kindFilter === 'plan') params.kind = 'subscription';
    else if (kindFilter === 'addon') params.kind = 'addon';
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (sortBy === 'newest') { params.sort = 'createdAt'; params.order = 'desc'; }
    else if (sortBy === 'oldest') { params.sort = 'createdAt'; params.order = 'asc'; }
    else if (sortBy === 'amount_desc') { params.sort = 'amount'; params.order = 'desc'; }
    else if (sortBy === 'amount_asc') { params.sort = 'amount'; params.order = 'asc'; }
    return params;
  }, [receiptPage, statusFilter, kindFilter, searchQuery, sortBy]);

  useEffect(() => { setReceiptPage(1); }, [statusFilter, kindFilter, searchQuery, sortBy]);

  const { data: receiptList = { items: [], page: 1, pages: 1, total: 0 }, isLoading: receiptsLoading, isFetching: receiptsFetching } = useQuery({
    queryKey: ['merchant-receipts', receiptQueryParams],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/receipts', { params: receiptQueryParams });
      return unwrapPagedList(data);
    },
    enabled: activeTab === 'payments',
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
      queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
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
      queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
      setSubmitted(true);
      setForm((f) => ({ ...f, bankReference: '', notes: '' }));
      setFile(null);
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Upload failed' }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
      setSubmitted(true);
      setErrors({});
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'PayPal capture failed' }),
  });

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
      setSubmitted(true);
      searchParams.delete('payment');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const requestActivationMutation = useMutation({
    mutationFn: () => api.post(`/tenants/${data?.tenant?._id}/temporary-activation/request`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
    },
    onError: (err) => setErrors({ api: err.response?.data?.message || 'Request failed' }),
  });

  const ACCEPTED_IMG = 'image/jpeg,image/png,image/webp,image/gif';
  const ACCEPTED_EXT = '.jpg,.jpeg,.png,.webp,.gif';

  const validate = () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.planId) e.planId = 'Plan selection is required';
    if (!form.bankReference.trim()) e.bankReference = 'Bank reference required';
    if (!file) { e.receipt = 'Receipt photo is required'; }
    else {
      const imgErr = validateImageFile(file);
      if (imgErr) e.receipt = imgErr;
    }
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

  const handleViewReceipt = async (receiptId, fallbackUrl) => {
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const { data: res } = await api.get(`/subscriptions/receipts/${receiptId}/url`);
      if (res?.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Could not retrieve receipt URL');
      }
    } catch {
      toast.error('Failed to load receipt URL');
    }
  };

  const tenant = data?.tenant;
  const billingBreakdown = breakdownData?.billingBreakdown;
  const receipts = receiptList.items || [];
  const subscriptions = data?.subscriptions || [];

  const latestSubscription = subscriptions?.length
    ? [...subscriptions].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0]
    : null;

  const subscriptionEndDate =
    tenant?.subscriptionStatus === 'trial'
      ? tenant?.trialEndsAt
      : latestSubscription?.endDate;

  const subscriptionEnd = subscriptionEndDate ? new Date(subscriptionEndDate) : null;

  /** Plan due at the next payment (scheduled change or current assigned plan). */
  const nextBillingPlanId = useMemo(() => {
    if (tenant?.planLocked && tenant.assignedPlanId?._id) return tenant.assignedPlanId._id;
    return tenant?.pendingPlanId?._id || tenant?.assignedPlanId?._id || null;
  }, [tenant?.planLocked, tenant?.pendingPlanId?._id, tenant?.assignedPlanId?._id]);

  const payPlans = useMemo(() => {
    if (!nextBillingPlanId) return plans;
    const match = plans.filter((p) => p._id === nextBillingPlanId);
    return match.length ? match : plans;
  }, [plans, nextBillingPlanId]);

  const selectedPlan = useMemo(
    () => payPlans.find((p) => p._id === form.planId) || payPlans[0] || null,
    [payPlans, form.planId]
  );

  const paypalCurrency = useMemo(() => selectedPlan?.currency || 'USD', [selectedPlan?.currency]);

  useEffect(() => {
    if (isInternational && paymentOptions?.paypal?.enabled) {
      setPaymentMethod('paypal');
    }
  }, [isInternational, paymentOptions?.paypal?.enabled]);

  useEffect(() => {
    if (!tenant || !payPlans.length) return;
    const defaultPlanId =
      (tenant.planLocked && tenant.assignedPlanId?._id) ||
      nextBillingPlanId ||
      payPlans[0]?._id ||
      '';
    if (!defaultPlanId) return;
    setForm((f) => ({
      ...f,
      planId: defaultPlanId,
    }));
  }, [tenant, payPlans, nextBillingPlanId]);

  useEffect(() => {
    const total =
      billingBreakdown?.total > 0
        ? billingBreakdown.total
        : selectedPlan?.amount;
    if (total != null) setForm((f) => ({ ...f, amount: String(total) }));
  }, [selectedPlan?._id, selectedPlan?.amount, billingBreakdown?.total]);

  useEffect(() => {
    const wantPaypal =
      paymentOptions?.paypal?.enabled &&
      paymentOptions.paypal.clientId &&
      paymentMethod === 'paypal';
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
  }, [paymentMethod, paymentOptions, paypalCurrency]);

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

  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const pendingReceiptsCount = data?.pendingReceiptsCount ?? 0;

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setKindFilter('');
    setSortBy('newest');
  };

  // Helper to determine receipt type
  const getReceiptType = (r) => {
    if (r.receiptKind === 'addon' || r.addonCode) return 'addon';
    if (r.receiptKind === 'store') return 'store';
    if (r.receiptKind === 'user_license') return 'license';
    return 'subscription';
  };

  // Get display label for item purchased
  const getItemLabel = (r) => {
    const type = getReceiptType(r);
    if (type === 'license') {
      let licenseInfo = {};
      try { if (r.userLicensePayload) licenseInfo = typeof r.userLicensePayload === 'string' ? JSON.parse(r.userLicensePayload) : r.userLicensePayload; } catch {}
      return licenseInfo.name ? `${licenseInfo.name} (${licenseInfo.role?.replace('_', ' ') || 'user'})` : (licenseInfo.role?.replace('_', ' ') || 'User license');
    }
    if (type === 'addon' || type === 'store') {
      return r.addonCode ? r.addonCode.replace(/_/g, ' ') : 'Add-on / Store';
    }
    return r.requestedPlanId?.name || r.requestedPlanCode || 'Plan Subscription';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Subscription</h2>
        <p className="text-sm text-gray-500 mt-0.5">Account status, plan changes, and optional paid features.</p>
      </div>

      <p className="text-sm text-gray-600">
        Optional paid features (QR Ordering, loyalty, and more) are on the{' '}
        {isSuspended ? (
          <span className="text-gray-400 font-semibold">Add-ons</span>
        ) : (
          <Link to="/addons" className="text-brand-orange font-semibold hover:underline">Add-ons</Link>
        )}{' '}page.
      </p>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Current status */}
          {!data ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          ) : tenant ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 text-sm">
                {tenant.subscriptionStatus === 'trial' ? 'Account status' : 'Current Plan'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                  <div>
                    <p className="text-xs text-gray-400">Assigned plan</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{tenant.assignedPlanId.name}</p>
                  </div>
                )}
                {tenant.subscriptionStatus !== 'trial' && latestSubscription && (
                  <div>
                    <p className="text-xs text-gray-400">Billing Period</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {new Date(latestSubscription.startDate).toLocaleDateString()} – {new Date(latestSubscription.endDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {tenant.subscriptionStatus === 'trial' && tenant.createdAt && (
                  <div>
                    <p className="text-xs text-gray-400">Trial Period</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {new Date(tenant.createdAt).toLocaleDateString()} – {new Date(tenant.trialEndsAt).toLocaleDateString()}
                    </p>
                  </div>
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

              {tenant.subscriptionStatus === 'active' && latestSubscription?.endDate && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Next billing date: {new Date(latestSubscription.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Please submit payment before this date to avoid service interruption.
                    </p>
                  </div>
                </div>
              )}

              {tenant.subscriptionStatus === 'expired' && !tenant.temporaryActivationRequestedAt && !tenant.temporaryActivationUsedForEndDate && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <div className="flex items-start gap-2 flex-1">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">Request a 1-day activation</p>
                      <p className="text-xs text-amber-700 mt-1">
                        {subscriptionEnd ? `Next expiry: ${subscriptionEnd.toLocaleDateString()} (subscription ended).` : 'Subscription ended.'}
                        {' '}
                        Super admin can enable a temporary override while you arrange payment.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestActivationMutation.mutate()}
                    disabled={requestActivationMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60 cursor-pointer w-full sm:w-auto text-center shrink-0"
                  >
                    {requestActivationMutation.isPending ? 'Requesting…' : 'Request 1 day'}
                  </button>
                </div>
              )}
            </div>
          ) : null}

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
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Subscription plan</h3>
                <p className="text-xs text-gray-500 mt-1">Switch plans at the end of your current billing period.</p>
              </div>
              <button
                type="button"
                onClick={() => setPlanModalOpen(true)}
                className="px-4 py-2 rounded-lg border border-brand-orange text-brand-orange text-xs font-semibold hover:bg-brand-orange/5 cursor-pointer w-full sm:w-auto text-center"
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
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">Pay for subscription</h3>
                <p className="text-xs text-gray-500">
                  {isInternational
                    ? billingNote
                    : tenant.subscriptionStatus === 'trial'
                      ? 'Pay by bank transfer and submit the details below — you can do this anytime during your trial so verification can finish before the trial ends.'
                      : 'Submit proof of payment. Amount must match the billing total calculated (plan plus any active add-ons and extra stores).'}
                </p>
              </div>

              {subscriptionEnd && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
                  <div className="flex">
                    <div className="shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-amber-900 font-medium">
                        Next Subscription Start Date: <span className="font-bold underline">{subscriptionEnd.toLocaleDateString()}</span>
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Please submit your payment receipt and complete your payment before <strong className="text-amber-900">{subscriptionEnd.toLocaleDateString()}</strong> to ensure continuous, uninterrupted support.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {billingBreakdown?.total > 0 && (
                <div className="bg-brand-orange/5 border border-brand-orange/15 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-fade-in">
                  <div>
                    <p className="text-[10px] text-brand-orange font-bold uppercase tracking-wider">Amount Due Next Billing Cycle</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                      {billingBreakdown.currency} {Number(billingBreakdown.total).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('breakdown')}
                    className="text-xs font-semibold text-brand-orange hover:text-brand-orange-hover border border-brand-orange/20 hover:border-brand-orange bg-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer w-full sm:w-auto text-center"
                  >
                    View breakdown
                  </button>
                </div>
              )}

              {submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-800">Receipt uploaded!</p>
                  <p className="text-sm text-green-600 mt-1">Our team will verify your payment within 1–2 business days.</p>
                  <button onClick={() => setSubmitted(false)} className="mt-3 text-sm text-green-700 underline cursor-pointer bg-transparent border-0">
                    Upload another receipt
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {!isInternational && paymentOptions?.stripe?.enabled && (
                      <button type="button" title="Pay with card (Stripe)" onClick={() => setPaymentMethod('stripe')} className={`px-4 py-2 rounded-lg border flex items-center gap-2 cursor-pointer ${paymentMethod === 'stripe' ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-300'}`}>
                        <PaymentMethodLogo method="stripe" imageUrl={paymentOptions?.stripe?.imageUrl} />
                      </button>
                    )}
                    {paymentOptions?.paypal?.enabled && (
                      <button type="button" title="Pay with PayPal" onClick={() => setPaymentMethod('paypal')} className={`px-4 py-2 rounded-lg border flex items-center gap-2 cursor-pointer ${paymentMethod === 'paypal' ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-300'}`}>
                        <PaymentMethodLogo method="paypal" imageUrl={paymentOptions?.paypal?.imageUrl} />
                      </button>
                    )}
                    {!isInternational && paymentOptions?.bankAccounts?.length > 0 && (
                      <button type="button" title="Bank transfer" onClick={() => setPaymentMethod('bank_transfer')} className={`px-4 py-2 rounded-lg border flex items-center gap-2 cursor-pointer ${paymentMethod === 'bank_transfer' ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-300'}`}>
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
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
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
                          <p className="font-medium">{b.bankName}</p>
                          <p>{b.accountName} · {b.accountNumber}{b.branch ? ` · ${b.branch}` : ''}</p>
                          {b.instructions && <p className="text-xs text-gray-500 mt-0.5">{b.instructions}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isInternational && paymentMethod === 'bank_transfer' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                          <select
                            value={form.planId}
                            disabled={tenant?.planLocked || payPlans.length <= 1}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, planId: e.target.value }));
                              setErrors((e2) => ({ ...e2, planId: '' }));
                            }}
                            className={`w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600 ${
                              errors.planId ? 'border-red-400' : 'border-gray-300'
                            }`}
                          >
                            {payPlans.length === 0 && <option value="">Select plan</option>}
                            {payPlans.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} ({p.currency} {Number(p.amount).toLocaleString()}
                                {p.billingCycle ? ` / ${p.billingCycle}` : ''})
                              </option>
                            ))}
                          </select>
                          {tenant?.pendingPlanId && (
                            <p className="text-xs text-blue-700 mt-1">
                              Paying for your upcoming plan: <strong>{tenant.pendingPlanId.name}</strong>
                              {tenant.pendingPlanEffectiveAt
                                ? ` (effective ${new Date(tenant.pendingPlanEffectiveAt).toLocaleDateString()})`
                                : ''}
                              .
                            </p>
                          )}
                          {tenant?.planLocked && (
                            <p className="text-xs text-amber-600 mt-1">This plan is locked by superadmin and cannot be changed.</p>
                          )}
                          {errors.planId && <p className="text-xs text-red-500 mt-0.5">{errors.planId}</p>}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount ({billingBreakdown?.currency || selectedPlan?.currency || 'LKR'}) *
                          </label>
                          <input
                            type="number"
                            value={form.amount}
                            readOnly
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 ${errors.amount ? 'border-red-400' : 'border-gray-300'}`}
                          />
                          {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
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
                          className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.bankReference ? 'border-red-400' : 'border-gray-300'}`}
                        />
                        {errors.bankReference && <p className="text-xs text-red-500 mt-0.5">{errors.bankReference}</p>}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700">Receipt photo *</label>
                          <span
                            title="Upload a photo of your bank payment receipt. Accepted formats: JPG, PNG, WEBP or GIF."
                            className="inline-flex items-center gap-1 text-[11px] text-gray-400 cursor-help select-none"
                          >
                            <ImageIcon size={12} /> Images only (JPG, PNG, WEBP, GIF)
                          </span>
                        </div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept={ACCEPTED_EXT}
                          onChange={(e) => {
                            const chosen = e.target.files?.[0] || null;
                            if (chosen) {
                              const imgErr = validateImageFile(chosen);
                              if (imgErr) { e.target.value = ''; setErrors((e2) => ({ ...e2, receipt: imgErr })); return; }
                            }
                            setFile(chosen);
                            setErrors((e2) => ({ ...e2, receipt: '' }));
                          }}
                          className="hidden"
                        />
                        {file ? (
                          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <ImageIcon size={16} className="text-green-600 shrink-0" />
                            <span className="text-sm text-green-700 flex-1 truncate">{file.name}</span>
                            <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="p-0.5 rounded hover:bg-green-100 text-gray-400 cursor-pointer border-0 bg-transparent" aria-label="Remove">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className={`w-full border-2 border-dashed rounded-lg p-4 text-sm flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${errors.receipt ? 'border-red-400 text-red-600' : 'border-gray-300 text-gray-500 hover:border-brand-orange hover:text-brand-orange bg-white'}`}
                          >
                            <Upload size={18} />
                            <span>Click to upload receipt photo</span>
                            <span className="text-xs opacity-70">JPG, PNG, WEBP or GIF</span>
                          </button>
                        )}
                        {errors.receipt && <p className="text-xs text-red-500 mt-0.5">{errors.receipt}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                        <textarea
                          value={form.notes}
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                          rows={2}
                          maxLength={2000}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={uploadMutation.isPending}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60 cursor-pointer"
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
        </div>
      )}

      {activeTab === 'breakdown' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs animate-fade-in space-y-4">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Next Billing Cycle Breakdown</h3>
            <p className="text-xs text-gray-500 mt-1">Detailed cost calculation breakdown for your upcoming subscription invoice renewal.</p>
          </div>
          {billingBreakdown ? (
            <BillingBreakdownPanel breakdown={billingBreakdown} />
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Loader size={24} className="animate-spin mx-auto text-gray-300 mb-2" />
              Loading billing calculations...
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs animate-fade-in overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Payment & Receipt History</h3>
            <p className="text-xs text-gray-500 mt-1">Review the status and history of bank transfers and online checkout receipts.</p>

            {/* Filters Row */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ref or notes..."
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              {/* Status filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Kind filter */}
              <div>
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white cursor-pointer"
                >
                  <option value="">All Types</option>
                  <option value="plan">Subscription</option>
                  <option value="addon">Add-ons & Stores</option>
                </select>
              </div>

              {/* Sort selector */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="amount_desc">Amount: High to Low</option>
                  <option value="amount_asc">Amount: Low to High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Receipts count */}
          {!receiptsLoading && receiptList.total > 0 && (
            <p className="text-xs text-gray-400 px-5 py-2 border-b border-gray-50">
              {receiptList.total} payment{receiptList.total !== 1 ? 's' : ''} found
              {statusFilter && ` · ${statusFilter}`}
              {kindFilter && ` · ${kindFilter === 'plan' ? 'subscription' : 'add-ons'}`}
            </p>
          )}

          {/* Receipts Table */}
          {receiptsLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <Loader size={24} className="animate-spin mx-auto text-gray-300 mb-2" />
              Loading payment history…
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <FileText size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="font-medium text-gray-500">No payments found</p>
              {(statusFilter || kindFilter || searchQuery.trim()) ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-400">Try adjusting your search queries or filters.</p>
                  <button
                    onClick={handleClearFilters}
                    className="text-xs font-semibold text-brand-orange bg-transparent border-0 cursor-pointer underline"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Your payment receipt history will appear here once submitted.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase font-bold tracking-wider text-gray-500">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipts.map((r) => {
                    const type = getReceiptType(r);
                    const itemLabel = getItemLabel(r);
                    const typeBadge = {
                      subscription: { bg: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Subscription' },
                      addon: { bg: 'bg-violet-50 text-violet-700 border-violet-100', label: 'Add-on' },
                      store: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Store' },
                      license: { bg: 'bg-orange-50 text-orange-700 border-orange-100', label: 'User License' },
                    }[type] || { bg: 'bg-gray-50 text-gray-700 border-gray-100', label: 'Payment' };

                    return (
                      <tr key={r._id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setDetailReceiptId(r._id)}>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px]">
                          <span className="truncate block capitalize" title={itemLabel}>{itemLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeBadge.bg}`}>
                            {typeBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                          {formatMoney(r.currency || 'LKR', r.amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          <CopyableRef text={r.bankReference || '—'} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap capitalize">
                          {METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
                            r.status === 'verified' ? 'bg-green-50 text-green-700 border-green-100' :
                            r.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              r.status === 'verified' ? 'bg-green-500' :
                              r.status === 'rejected' ? 'bg-red-500' :
                              'bg-amber-500'
                            }`} />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {r.receiptFileKey && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleViewReceipt(r._id, r.receiptFileUrl); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                                title="View receipt file"
                              >
                                <ExternalLink size={12} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDetailReceiptId(r._id); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Eye size={12} /> View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!receiptsLoading && receipts.length > 0 && (
            <ListPagination
              page={receiptList.page}
              pages={receiptList.pages}
              total={receiptList.total}
              onPageChange={setReceiptPage}
              isFetching={receiptsFetching}
            />
          )}
        </div>
      )}

      {/* Payment Detail Modal */}
      {detailReceiptId && (
        <PaymentReceiptDetailModal
          receiptId={detailReceiptId}
          onClose={() => setDetailReceiptId(null)}
          showTenantContext={false}
        />
      )}
    </div>
  );
}
