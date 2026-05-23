import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, AlertTriangle, ExternalLink, ImageIcon, X, Search, Copy, Check, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { validateImageFile } from '../../components/billing/BankReceiptFields';
import api from '../../api/axios';
import PlanChangeModal from '../../components/subscription/PlanChangeModal';
import BillingBreakdownPanel from '../../components/billing/BillingBreakdownPanel';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import { useToast } from '../../context/ToastContext';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';

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

const RECEIPT_KIND_LABELS = {
  subscription: 'Plan Renewal',
  addon: 'Add-on',
  user_license: 'User License',
  store: 'Store Activation',
};

const STATUS_BADGES = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function ReceiptDetailPopup({ receipt: r, onClose }) {
  if (!r) return null;

  let licensePayload = {};
  try { if (r.userLicensePayload) licensePayload = typeof r.userLicensePayload === 'string' ? JSON.parse(r.userLicensePayload) : r.userLicensePayload; } catch {}

  const plan = r.requestedPlanId;
  const statusBadge = STATUS_BADGES[r.status] || 'bg-gray-100 text-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{RECEIPT_KIND_LABELS[r.receiptKind] || 'Payment'} Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
                {r.status?.charAt(0).toUpperCase() + r.status?.slice(1)}
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Amount */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-600">Amount paid</span>
            <span className="text-xl font-bold text-gray-900">
              {r.currency?.toUpperCase()} {Number(r.amount || 0).toFixed(2)}
            </span>
          </div>

          {/* What was purchased */}
          {r.receiptKind === 'subscription' && plan && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Plan</p>
              <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1">
                <p className="font-medium text-blue-900">{plan.name}</p>
                {plan.code && <p className="text-xs text-blue-700">Code: {plan.code}</p>}
                {plan.billingCycle && <p className="text-xs text-blue-700 capitalize">Billing: {plan.billingCycle}</p>}
                {plan.durationDays && <p className="text-xs text-blue-700">Duration: {plan.durationDays} days</p>}
              </div>
            </div>
          )}

          {r.receiptKind === 'addon' && r.addonCode && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Add-on</p>
              <div className="bg-purple-50 rounded-xl px-4 py-3">
                <p className="font-medium text-purple-900 capitalize">{r.addonCode.replace(/_/g, ' ')}</p>
              </div>
            </div>
          )}

          {r.receiptKind === 'user_license' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">User License</p>
              <div className="bg-orange-50 rounded-xl px-4 py-3 space-y-1">
                {licensePayload.action && <p className="text-xs text-orange-800 capitalize">Action: {licensePayload.action.replace(/_/g, ' ')}</p>}
                {licensePayload.seats && <p className="text-xs text-orange-800">Seats: {licensePayload.seats}</p>}
                {licensePayload.role && <p className="text-xs text-orange-800 capitalize">Role: {licensePayload.role.replace(/_/g, ' ')}</p>}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {r.paymentDate && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Payment date</p>
                <p className="text-sm font-medium text-gray-800">{new Date(r.paymentDate).toLocaleDateString()}</p>
              </div>
            )}
            {r.verifiedAt && (
              <div className="bg-green-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Verified at</p>
                <p className="text-sm font-medium text-gray-800">{new Date(r.verifiedAt).toLocaleDateString()}</p>
              </div>
            )}
            {r.extensionDays > 0 && (
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Extension days</p>
                <p className="text-sm font-medium text-blue-800">+{r.extensionDays} days</p>
              </div>
            )}
          </div>

          {/* Bank reference */}
          {r.bankReference && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Bank reference</p>
              <CopyableRef text={r.bankReference} />
            </div>
          )}

          {/* Notes */}
          {r.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">{r.notes}</p>
            </div>
          )}

          {/* Rejection reason */}
          {r.status === 'rejected' && r.rejectionReason && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">Rejection reason</p>
              <p className="text-sm text-red-800">{r.rejectionReason}</p>
            </div>
          )}

          {/* Receipt file */}
          {r.receiptFileUrl && (
            <a
              href={r.receiptFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-orange hover:underline"
            >
              <FileText size={14} />
              View uploaded receipt file
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'breakdown', 'payments'
  
  // Payment History Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [popupReceipt, setPopupReceipt] = useState(null);
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

  const requestActivationMutation = useMutation({
    mutationFn: () => api.post(`/tenants/${data?.tenant?._id}/temporary-activation/request`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-subscription'] }),
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

  const tenant = data?.tenant;
  const billingBreakdown = data?.billingBreakdown;
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
      latestReceiptPlanId ||
      payPlans[0]?._id ||
      '';
    if (!defaultPlanId) return;
    setForm((f) => ({
      ...f,
      planId: defaultPlanId,
    }));
  }, [tenant, payPlans, nextBillingPlanId, latestReceiptPlanId]);

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

  const pendingReceiptsCount = useMemo(() => {
    return receipts.filter((r) => r.status === 'pending').length;
  }, [receipts]);

  // Payment History client-side filtering and sorting
  const filteredReceipts = useMemo(() => {
    let result = [...receipts];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.bankReference && r.bankReference.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Kind filter
    if (kindFilter) {
      if (kindFilter === 'addon') {
        result = result.filter((r) => r.receiptKind === 'addon' || r.addonCode || r.receiptKind === 'store');
      } else if (kindFilter === 'plan') {
        result = result.filter((r) => r.receiptKind !== 'addon' && !r.addonCode && r.receiptKind !== 'store');
      }
    }

    // Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.paymentDate || b.createdAt || 0).getTime();
      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      
      const amtA = Number(a.amount || 0);
      const amtB = Number(b.amount || 0);
      if (sortBy === 'amount_desc') return amtB - amtA;
      if (sortBy === 'amount_asc') return amtA - amtB;
      return 0;
    });

    return result;
  }, [receipts, searchQuery, statusFilter, kindFilter, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setKindFilter('');
    setSortBy('newest');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Subscription</h2>
        <p className="text-sm text-gray-500 mt-0.5">Account status, plan changes, and optional paid features.</p>
      </div>

      <p className="text-sm text-gray-600">
        Optional paid features (QR Ordering, loyalty, and more) are on the{' '}
        <Link to="/addons" className="text-brand-orange font-semibold hover:underline">Add-ons</Link> page.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview & Renewal
        </button>
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'breakdown'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Billing Breakdown
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Payment History
          {pendingReceiptsCount > 0 ? (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {pendingReceiptsCount} pending
            </span>
          ) : receipts.length > 0 ? (
            <span className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {receipts.length}
            </span>
          ) : null}
        </button>
      </div>

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
                  <div>
                    <p className="text-xs text-gray-400">Assigned plan</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{tenant.assignedPlanId.name}</p>
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
                    className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60 cursor-pointer"
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
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Subscription plan</h3>
                <p className="text-xs text-gray-500 mt-1">Switch plans at the end of your current billing period.</p>
              </div>
              <button
                type="button"
                onClick={() => setPlanModalOpen(true)}
                className="px-4 py-2 rounded-lg border border-brand-orange text-brand-orange text-xs font-semibold hover:bg-brand-orange/5 cursor-pointer"
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

              {/* Amount due next billing cycle visual summary */}
              {billingBreakdown?.total > 0 && (
                <div className="bg-brand-orange/5 border border-brand-orange/15 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in">
                  <div>
                    <p className="text-[10px] text-brand-orange font-bold uppercase tracking-wider">Amount Due Next Billing Cycle</p>
                    <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                      {billingBreakdown.currency} {Number(billingBreakdown.total).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('breakdown')}
                    className="text-xs font-semibold text-brand-orange hover:text-brand-orange-hover border border-brand-orange/20 hover:border-brand-orange bg-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
                  <option value="">All Kinds</option>
                  <option value="plan">Plan Subscription</option>
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

          {/* Receipts Log List */}
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <FileText size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="font-medium text-gray-500">No payment receipts found</p>
              {receipts.length > 0 ? (
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
            <div className="divide-y divide-gray-100">
              {filteredReceipts.map((r) => {
                const isAddon = r.receiptKind === 'addon' || r.addonCode || r.receiptKind === 'store';
                return (
                  <div key={r._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {r.currency || 'LKR'} {Number(r.amount ?? 0).toLocaleString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                          isAddon
                            ? 'bg-violet-50 text-violet-700 border-violet-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {isAddon ? 'Add-on License' : 'Plan Subscription'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                        <span>Submitted: {new Date(r.paymentDate || r.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          Bank Ref: <CopyableRef text={r.bankReference || '—'} />
                        </span>
                      </div>
                      
                      {r.notes && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 border border-gray-100 rounded-md p-1.5 mt-1 font-sans">
                          Note: "{r.notes}"
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {r.receiptFileUrl && (
                        <a
                          href={r.receiptFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline flex items-center gap-0.5 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 bg-white"
                        >
                          <ExternalLink size={12} /> View Receipt
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setPopupReceipt(r)}
                        className="text-xs text-gray-600 hover:text-brand-orange font-medium flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:border-brand-orange hover:bg-orange-50 bg-white transition-colors"
                      >
                        <Eye size={12} /> Details
                      </button>
                      
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border flex items-center gap-1 ${
                        r.status === 'verified'
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : r.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border-red-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          r.status === 'verified'
                            ? 'bg-green-500'
                            : r.status === 'rejected'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`} />
                        {r.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {popupReceipt && <ReceiptDetailPopup receipt={popupReceipt} onClose={() => setPopupReceipt(null)} />}
    </div>
  );
}
