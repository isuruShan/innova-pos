import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader, CheckCircle, AlertTriangle, ExternalLink, ImageIcon, X, Search, Copy, Check, FileText, Eye, ChevronDown, ChevronUp, Clock, Sparkles } from 'lucide-react';
import { validateImageFile } from '../../components/billing/BankReceiptFields';
import api from '../../api/axios';
import PlanChangeModal from '../../components/subscription/PlanChangeModal';
import BillingBreakdownPanel from '../../components/billing/BillingBreakdownPanel';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import { buildPlanCardBackground, buildPlanTagBackground, planUsesLightText } from '../../utils/planAppearance';
import PaymentReceiptDetailModal from '../../components/payments/PaymentReceiptDetailModal';
import ListPagination from '../../components/common/ListPagination';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useToast } from '../../context/ToastContext';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';
import { formatMoney, BillingQuotePanel, LicenseQuoteBreakdown } from '../../components/billing/ProrationBreakdown';
import { useAuth } from '../../context/AuthContext';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  paypal: 'PayPal',
};

const ENTERPRISE_DISPLAY = {
  name: 'Custom',
  priceLabel: 'Tailored',
  cycle: 'custom pricing',
  lines: [
    'Custom registers limit',
    'Unlimited KDS screens',
    'Multi-branch HQ analytics',
    'Dedicated support manager',
    'API access integrations',
  ]
};

const pricingLinesForPlan = (plan) => {
  if (plan.featureLines?.length) return plan.featureLines;
  if (plan.code?.includes('standard')) {
    return [
      'Counter & Table POS registers',
      'Barista & Kitchen KDS screens',
      'Inventory cost mix insights',
      'Multi-terminal syncing',
    ];
  }
  return [
    'Counter & Table POS registers',
    'Barista & Kitchen KDS screens',
    'Inventory cost mix insights',
    'Multi-terminal syncing',
    'Premium features included',
  ];
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
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_subscription_history');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [trialSubscribeStep, setTrialSubscribeStep] = useState('none');
  const [showSubPaymentForm, setShowSubPaymentForm] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({ amount: '', bankReference: '', notes: '', planId: '' });
  const { isInternational, billingNote } = useMerchantBillingRegion();
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [paypalReady, setPaypalReady] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState('monthly');
  const [excludeAddons, setExcludeAddons] = useState([]);
  
  const { data } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => { const { data } = await api.get('/subscriptions/my'); return data; },
  });

  const needsBreakdown = activeTab === 'overview' || activeTab === 'breakdown';
  const { data: breakdownData, isFetching: isBreakdownFetching } = useQuery({
    queryKey: ['my-subscription-breakdown', form.planId, selectedCycle, excludeAddons],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/my', {
        params: {
          includeBreakdown: '1',
          planId: form.planId,
          billingCycle: selectedCycle,
          excludeAddons: JSON.stringify(excludeAddons),
        },
      });
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
    mutationFn: ({ planId, billingCycle }) => api.post('/subscriptions/schedule-plan', { planId, billingCycle }),
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
    mutationFn: () => api.post('/subscriptions/checkout/stripe', { planId: form.planId, billingCycle: selectedCycle, excludeAddons }),
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
    fd.append('billingCycle', selectedCycle);
    fd.append('excludeAddons', JSON.stringify(excludeAddons));
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
  const latestReceipt = data?.latestReceipt;

  useEffect(() => {
    if (tenant?.billingCycle) {
      setSelectedCycle(tenant.billingCycle);
    }
  }, [tenant?.billingCycle]);

  const billingBreakdown = breakdownData?.billingBreakdown;

  const activeAddonsList = useMemo(() => {
    const list = [];
    if (!tenant) return list;

    // 1. Paid Addons from tenant
    if (tenant.paidAddons) {
      Object.keys(tenant.paidAddons).forEach((key) => {
        const ent = tenant.paidAddons[key];
        if (ent?.active) {
          const code = {
            qrOrdering: 'qr_ordering',
            loyalty: 'loyalty',
            tableManagement: 'table_management',
            uberEats: 'uber_eats',
            accounting: 'accounting',
            dualScreen: 'dual_screen',
            whatsapp: 'whatsapp_integration',
          }[key] || key;

          const label = {
            qrOrdering: 'QR Ordering',
            loyalty: 'Loyalty Program',
            tableManagement: 'Table Management',
            uberEats: 'Uber Eats Integration',
            accounting: 'Advanced Accounting Module',
            dualScreen: 'Dual Screen Customer Terminal',
            whatsapp: 'WhatsApp Business Integration',
          }[key] || key;

          list.push({ code, label, badge: 'Trial Active' });
        }
      });
    }

    // 2. Additional Stores from breakdown
    if (billingBreakdown?.storesDetail && billingBreakdown.storesDetail.length > 1) {
      const extraCount = billingBreakdown.storesDetail.length - 1;
      list.push({
        code: 'additional_store',
        label: `Additional Stores (×${extraCount})`,
        badge: `${extraCount} Extra Store${extraCount > 1 ? 's' : ''}`,
      });
    }

    // 3. User Seats from breakdown (excluding merchant_admin)
    if (billingBreakdown?.usersDetail) {
      // Group by role and check seat cost
      const rolesCount = {};
      billingBreakdown.usersDetail.forEach((u) => {
        if (u.seatCost > 0 && u.role !== 'merchant_admin') {
          rolesCount[u.role] = (rolesCount[u.role] || 0) + 1;
        }
      });
      Object.entries(rolesCount).forEach(([role, count]) => {
        const roleLabel = role
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        list.push({
          code: `user_license_${role}`,
          label: `${roleLabel} User Seat${count > 1 ? 's' : ''} (×${count})`,
          badge: `${count} Extra Seat${count > 1 ? 's' : ''}`,
        });
      });

      // Group by role and check extra store slots cost
      const extraStoreSlotsCount = {};
      billingBreakdown.usersDetail.forEach((u) => {
        if (u.extraStoreSlotsCost > 0 && u.role !== 'merchant_admin') {
          extraStoreSlotsCount[u.role] = (extraStoreSlotsCount[u.role] || 0) + u.extraStoreSlots;
        }
      });
      Object.entries(extraStoreSlotsCount).forEach(([role, count]) => {
        const roleLabel = role
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        list.push({
          code: `user_extra_stores_${role}`,
          label: `${roleLabel} Extra Store Slot${count > 1 ? 's' : ''} (×${count})`,
          badge: `${count} Extra Store Slot${count > 1 ? 's' : ''}`,
        });
      });
    }

    return list;
  }, [tenant, billingBreakdown?.storesDetail, billingBreakdown?.usersDetail]);
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

  const isNextBillingPaid = useMemo(() => {
    if (!latestReceipt || latestReceipt.status !== 'verified') return false;
    if (!latestReceipt.billingPeriodEnd || !subscriptionEnd) return false;
    return new Date(latestReceipt.billingPeriodEnd).getTime() > subscriptionEnd.getTime();
  }, [latestReceipt, subscriptionEnd]);

  /** Plan due at the next payment (scheduled change or current assigned plan). */
  const nextBillingPlanId = useMemo(() => {
    if (tenant?.planLocked && tenant.assignedPlanId?._id) return tenant.assignedPlanId._id;
    return tenant?.pendingPlanId?._id || tenant?.assignedPlanId?._id || null;
  }, [tenant?.planLocked, tenant?.pendingPlanId?._id, tenant?.assignedPlanId?._id]);

  const payPlans = useMemo(() => {
    if (tenant?.planLocked && nextBillingPlanId) {
      const match = plans.filter((p) => p._id === nextBillingPlanId);
      return match.length ? match : plans;
    }
    return plans;
  }, [plans, nextBillingPlanId, tenant?.planLocked]);

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p._id) === String(form.planId)) || payPlans.find((p) => String(p._id) === String(form.planId)) || payPlans[0] || null,
    [plans, payPlans, form.planId]
  );

  const paypalCurrency = useMemo(() => selectedPlan?.currency || 'USD', [selectedPlan?.currency]);

  useEffect(() => {
    if (isInternational && paymentOptions?.paypal?.enabled) {
      setPaymentMethod('paypal');
    }
  }, [isInternational, paymentOptions?.paypal?.enabled]);

  useEffect(() => {
    if (!tenant || !payPlans.length) return;
    const hasValidPlan = form.planId && payPlans.some(p => String(p._id) === String(form.planId));
    if (hasValidPlan) return;

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
  }, [tenant, payPlans, nextBillingPlanId, form.planId]);

  useEffect(() => {
    const isBreakdownStale = !billingBreakdown || String(billingBreakdown?.plan?._id) !== String(form.planId);
    const total = !isBreakdownStale && billingBreakdown?.total > 0
      ? billingBreakdown.total
      : (selectedCycle === 'yearly' ? selectedPlan?.yearlyPrice : selectedPlan?.monthlyPrice);
    if (total != null) setForm((f) => ({ ...f, amount: String(total) }));
  }, [selectedPlan?._id, selectedPlan?.monthlyPrice, selectedPlan?.yearlyPrice, billingBreakdown?.total, selectedCycle, form.planId, billingBreakdown?.plan?._id]);

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
        const { data } = await api.post('/subscriptions/checkout/paypal/create-order', { planId: form.planId, billingCycle: selectedCycle, excludeAddons });
        return data.orderId;
      },
      onApprove: async (data) => {
        await paypalCaptureMutation.mutateAsync(data.orderID);
      },
      onError: () => setErrors({ api: 'PayPal payment failed' }),
    }).render(paypalContainerRef.current);
  }, [paypalReady, paymentMethod, form.planId, selectedCycle, excludeAddons]);

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

  const renderPaymentFormsContent = () => {
    if (submitted) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-800">Receipt uploaded!</p>
          <p className="text-sm text-green-600 mt-1">Our team will verify your payment within 1–2 business days.</p>
          <button onClick={() => setSubmitted(false)} className="mt-3 text-sm text-green-700 underline cursor-pointer bg-transparent border-0">
            Upload another receipt
          </button>
        </div>
      );
    }

    return (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Selected Plan</label>
                <div className="w-full border border-gray-250 bg-gray-55/10 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium">
                  {selectedPlan?.name || '—'} ({selectedPlan?.currency || 'LKR'} {Number(selectedCycle === 'yearly' ? selectedPlan?.yearlyPrice : selectedPlan?.monthlyPrice).toLocaleString()} / {selectedCycle === 'yearly' ? '365 days' : '30 days'})
                </div>
                {String(form.planId) !== String(tenant?.assignedPlanId?._id) ? (
                  <p className="text-xs text-blue-750 mt-1">
                    Paying for your selected plan: <strong>{selectedPlan?.name}</strong>
                    {subscriptionEndDate
                      ? ` (effective ${new Date(subscriptionEndDate).toLocaleDateString()})`
                      : ''}
                    .
                  </p>
                ) : (
                  tenant?.pendingPlanId && String(tenant.pendingPlanId._id) === String(form.planId) && (
                    <p className="text-xs text-blue-750 mt-1">
                      Paying for your upcoming plan: <strong>{tenant.pendingPlanId.name}</strong>
                      {tenant.pendingPlanEffectiveAt
                        ? ` (effective ${new Date(tenant.pendingPlanEffectiveAt).toLocaleDateString()})`
                        : ''}
                      .
                    </p>
                  )
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
    );
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
        <div className="space-y-6">
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
            <div className="space-y-6">
              {/* Top Panel for Trial details or subscription details */}
              {tenant.subscriptionStatus === 'trial' ? (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4 text-sm">Trial Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <p className="font-semibold text-sky-600 mt-0.5">Free Trial</p>
                    </div>
                    {tenant.trialEndsAt && (
                      <div>
                        <p className="text-xs text-gray-400">Trial Period</p>
                        <p className="font-semibold text-gray-900 mt-0.5">
                          {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'} to {new Date(tenant.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({trialDaysLeft} days left)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900 text-sm">Current Plan</h3>
                    {!tenant?.planLocked && (
                      <button
                        type="button"
                        onClick={() => setPlanModalOpen(true)}
                        className="px-3 py-1.5 border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                      >
                        Change Plan
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <p className="font-semibold text-green-600 capitalize mt-0.5">{tenant.subscriptionStatus}</p>
                    </div>
                    {tenant.assignedPlanId && (
                      <div>
                        <p className="text-xs text-gray-400">Assigned plan</p>
                        <p className="font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
                          {tenant.assignedPlanId.name}
                          {tenant.planLocked && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                              Locked
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    {latestSubscription && (
                      <div>
                        <p className="text-xs text-gray-400">Billing Period</p>
                        <p className="font-semibold text-gray-900 mt-0.5">
                          {new Date(latestSubscription.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to {new Date(latestSubscription.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                            : 'Your subscription has expired.'}{' '}
                          Upload a payment receipt to reactivate, or request a one-day activation (if available).
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

                  {tenant.subscriptionStatus === 'expired' && !tenant.temporaryActivationRequestedAt && !tenant.temporaryActivationUsedForEndDate && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <div className="flex items-start gap-2 flex-1">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-amber-900">Request a 1-day activation</p>
                          <p className="text-xs text-amber-700 mt-1">
                            {subscriptionEnd ? `Next expiry: ${subscriptionEnd.toLocaleDateString()} (subscription ended).` : 'Subscription ended.'}{' '}
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
              )}
              {/* Conditionally Render Content based on Trial Status */}
              {tenant.subscriptionStatus === 'trial' ? (
                /* Trial Mode Subscribe workflow */
                <div className="space-y-6">
                  {latestReceipt?.status === 'pending' ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
                      <p className="font-semibold text-amber-800 flex items-center gap-2">
                        <Clock size={16} className="text-amber-600 animate-pulse" /> Pending Verification
                      </p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        We have received your payment proof for subscription plan: <strong>{latestReceipt.requestedPlanId?.name || latestReceipt.requestedPlanCode || '—'}</strong>. Our team is currently verifying it.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center text-center gap-4">
                      <h4 className="font-bold text-gray-900 text-base">Select Subscription Plan</h4>
                      <p className="text-sm text-gray-500 max-w-md">Your trial is active. You can subscribe to a premium plan at any time to ensure uninterrupted service when your trial ends.</p>
                      <button
                        type="button"
                        onClick={() => setTrialSubscribeStep('plan_select')}
                        className="px-6 py-3 bg-brand-orange hover:bg-brand-orange-hover text-white font-bold rounded-xl shadow-lg transition duration-200 cursor-pointer"
                      >
                        Subscribe
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Subscribed Mode details and toggleable Payment block */
                <div className="space-y-6">
                  {latestReceipt?.status === 'pending' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
                      <p className="font-semibold text-amber-800 flex items-center gap-2">
                        <Clock size={16} className="text-amber-600 animate-pulse" /> Pending Verification
                      </p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        We have received your payment proof for the next billing cycle:{' '}
                        <strong>
                          {latestReceipt.billingPeriodStart ? new Date(latestReceipt.billingPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          {' to '}
                          {latestReceipt.billingPeriodEnd ? new Date(latestReceipt.billingPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </strong>
                        . Our team is currently verifying it.
                      </p>
                    </div>
                  )}

                  {isNextBillingPaid && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <p className="font-semibold text-green-800 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-600" /> Subscription All Set
                        </p>
                        <p className="text-xs text-green-700 leading-relaxed">
                          You are all set for the next billing cycle:{' '}
                          <strong>
                            {latestReceipt.billingPeriodStart ? new Date(latestReceipt.billingPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            {' to '}
                            {latestReceipt.billingPeriodEnd ? new Date(latestReceipt.billingPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </strong>
                          .
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const defaultPlanId =
                            (tenant.planLocked && tenant.assignedPlanId?._id) ||
                            nextBillingPlanId ||
                            payPlans[0]?._id ||
                            '';
                          const defaultPlan = payPlans.find((p) => p._id === defaultPlanId) || payPlans[0];
                          const price = selectedCycle === 'yearly' ? defaultPlan?.yearlyPrice : defaultPlan?.monthlyPrice;
                          const amountToPay = billingBreakdown?.total > 0 ? billingBreakdown.total : price;
                          setForm((f) => ({ ...f, planId: defaultPlanId, amount: String(amountToPay || 0) }));
                          setTrialSubscribeStep('payment_select');
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm transition whitespace-nowrap cursor-pointer"
                      >
                        Pay for Next Billing Cycle
                      </button>
                    </div>
                  )}

                  {latestReceipt?.status === 'rejected' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-2">
                      <p className="font-semibold text-red-800 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-650" /> Payment Verification Failed
                      </p>
                      <p className="text-xs text-red-700 leading-relaxed">
                        Payment verification failed: <span className="font-bold underline">{latestReceipt.rejectionReason || 'Invalid receipt upload'}</span>. Please retry payment.
                      </p>
                    </div>
                  )}

                  {(!latestReceipt || latestReceipt.status === 'rejected' || (!isNextBillingPaid && latestReceipt.status === 'verified')) && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Amount Due Next Billing Cycle</p>
                          <p className="text-2xl font-extrabold text-gray-900 mt-1">
                            {billingBreakdown?.currency || selectedPlan?.currency || 'LKR'} {Number(billingBreakdown?.total || selectedPlan?.amount || 0).toLocaleString()}
                          </p>
                          {latestSubscription?.endDate && (
                            <p className="text-xs text-gray-500 mt-1">
                              Due Date: {new Date(latestSubscription.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultPlanId =
                              (tenant.planLocked && tenant.assignedPlanId?._id) ||
                              nextBillingPlanId ||
                              payPlans[0]?._id ||
                              '';
                            const defaultPlan = payPlans.find((p) => p._id === defaultPlanId) || payPlans[0];
                            const price = selectedCycle === 'yearly' ? defaultPlan?.yearlyPrice : defaultPlan?.monthlyPrice;
                            const amountToPay = billingBreakdown?.total > 0 ? billingBreakdown.total : price;
                            setForm((f) => ({ ...f, planId: defaultPlanId, amount: String(amountToPay || 0) }));
                            setTrialSubscribeStep('payment_select');
                          }}
                          className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                        >
                          Pay Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Payment & Receipt History</h3>
                <p className="text-xs text-gray-500 mt-1">Review the status and history of bank transfers and online checkout receipts.</p>
              </div>
              <div>
                <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_admin_subscription_history', m); }} />
              </div>
            </div>

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
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5">
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
                  <div key={r._id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col justify-between space-y-3 cursor-pointer hover:border-gray-300" onClick={() => setDetailReceiptId(r._id)}>
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-gray-900 text-sm truncate" title={itemLabel}>{itemLabel}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${typeBadge.bg}`}>
                          {typeBadge.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {r.billingPeriodStart && r.billingPeriodEnd ? (
                          `${new Date(r.billingPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(r.billingPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        ) : 'No billing period'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="bg-gray-105 text-gray-700 px-2 py-0.5 rounded font-mono">
                          Ref: {r.bankReference || '—'}
                        </span>
                        <span className="bg-gray-105 text-gray-700 px-2 py-0.5 rounded">
                          Method: {METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold capitalize border ${
                          r.status === 'verified' ? 'bg-green-50 text-green-700 border-green-100' :
                          r.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                        {formatMoney(r.currency || 'LKR', r.amount)}
                      </span>
                      <div className="flex items-center gap-2">
                        {r.receiptFileKey && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleViewReceipt(r._id, r.receiptFileUrl); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                            title="View receipt file"
                          >
                            <ExternalLink size={11} /> File
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDetailReceiptId(r._id); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Eye size={11} /> View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase font-bold tracking-wider text-gray-500">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Billing Period</th>
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
                        <td className="px-4 py-3 text-gray-550 text-xs whitespace-nowrap">
                          {r.billingPeriodStart && r.billingPeriodEnd ? (
                            `${new Date(r.billingPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(r.billingPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          ) : '—'}
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

      {/* Plan Change Modal */}
      <PlanChangeModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        plans={plans}
        currentPlanId={tenant?.assignedPlanId?._id}
        currentBillingCycle={tenant?.billingCycle}
        onSelect={({ planId, billingCycle }) => schedulePlanMutation.mutate({ planId, billingCycle })}
        isPending={schedulePlanMutation.isPending}
      />

      {/* Checkout Wizard Modal */}
      {trialSubscribeStep !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 cursor-default border-0"
            onClick={() => { setTrialSubscribeStep('none'); setSubmitted(false); }}
            aria-label="Close"
          />
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col z-10 overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-brand-orange animate-pulse" />
                  {trialSubscribeStep === 'plan_select' && 'Select Subscription Plan'}
                  {trialSubscribeStep === 'payment_select' && 'Choose Payment Method'}
                  {trialSubscribeStep === 'pay_form' && 'Complete Payment'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {trialSubscribeStep === 'plan_select' && `Choose the plan that best fits your business.${tenant?.subscriptionStatus === 'trial' ? ' (Step 1 of 3)' : ''}`}
                  {trialSubscribeStep === 'payment_select' && `Select how you would like to submit payment.${tenant?.subscriptionStatus === 'trial' ? ' (Step 2 of 3)' : ''}`}
                  {trialSubscribeStep === 'pay_form' && `Submit details for your payment via ${METHOD_LABELS[paymentMethod] || paymentMethod}.${tenant?.subscriptionStatus === 'trial' ? ' (Step 3 of 3)' : ''}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setTrialSubscribeStep('none'); setSubmitted(false); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 border-0 bg-transparent cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {trialSubscribeStep === 'plan_select' && (
                <div className="space-y-6">
                  {/* Billing cycle toggle */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="inline-flex rounded-xl border border-gray-250 p-1 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setSelectedCycle('monthly')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                          selectedCycle === 'monthly'
                            ? 'bg-brand-orange text-white shadow-md'
                            : 'text-gray-550 hover:text-gray-700 bg-transparent'
                        }`}
                      >
                        Monthly billing
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCycle('yearly')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                          selectedCycle === 'yearly'
                            ? 'bg-brand-orange text-white shadow-md'
                            : 'text-gray-550 hover:text-gray-700 bg-transparent'
                        }`}
                      >
                        Yearly billing (Save)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {plans.map((plan) => {
                      const bulletLines = pricingLinesForPlan(plan);
                      const customCardBg = buildPlanCardBackground(plan);
                      const lightOnCard = planUsesLightText(plan);
                      const showRibbon = plan.planTagShow && String(plan.planTagText || '').trim();
                      const ribbonBg = showRibbon ? buildPlanTagBackground(plan) : null;

                      const price = selectedCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                      const displayPrice = `${plan.currency} ${price.toLocaleString()}`;

                      const isSelected = String(form.planId) === String(plan._id);

                      let cardClass = `relative rounded-2xl p-6 border flex flex-col min-h-[350px] transition-all cursor-pointer hover:shadow-md ${
                        isSelected
                          ? 'ring-2 ring-brand-orange border-transparent scale-[1.01]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`;

                      return (
                        <div
                          key={plan._id}
                          className={cardClass}
                          style={customCardBg ? { background: customCardBg } : undefined}
                          onClick={() => {
                            setForm((f) => ({ ...f, planId: plan._id, amount: String(price || 0) }));
                          }}
                        >
                          {showRibbon && ribbonBg && (
                            <div
                              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold shadow-sm max-w-[90%] truncate text-white"
                              style={{ background: ribbonBg }}
                            >
                              {plan.planTagText}
                            </div>
                          )}

                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className={`text-xs font-bold uppercase tracking-wider ${lightOnCard ? 'text-white/80' : 'text-gray-450'}`}>
                              {plan.name}
                            </span>
                          </div>
                          <div className={`text-2xl font-extrabold tracking-tight ${lightOnCard ? 'text-white' : 'text-gray-900'}`}>
                            {displayPrice}
                          </div>
                          <div className={`text-[10px] uppercase tracking-wider mb-6 ${lightOnCard ? 'text-white/60' : 'text-gray-400'}`}>
                            {selectedCycle === 'yearly' ? 'per year' : 'per month'}
                          </div>

                          <ul className="space-y-2 mb-6 flex-1">
                            {bulletLines.map((line, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                                <span className={lightOnCard ? 'text-white/90' : 'text-gray-650'}>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}

                    {/* Custom plan card */}
                    <div
                      className={`relative rounded-2xl p-6 border flex flex-col min-h-[350px] transition-all cursor-pointer hover:shadow-md ${
                        form.planId === 'custom'
                          ? 'ring-2 ring-brand-orange border-transparent scale-[1.01]'
                          : 'border-gray-200 bg-white hover:border-gray-350 hover:border-gray-300'
                      }`}
                      onClick={() => setForm((f) => ({ ...f, planId: 'custom' }))}
                    >
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-brand-orange text-white">
                        Tailor-made
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-450">
                        {ENTERPRISE_DISPLAY.name}
                      </div>
                      <div className="text-2xl font-extrabold tracking-tight text-gray-900">
                        {ENTERPRISE_DISPLAY.priceLabel}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider mb-6 text-gray-400">
                        {ENTERPRISE_DISPLAY.cycle}
                      </div>

                      <ul className="space-y-2 mb-6 flex-1">
                        {ENTERPRISE_DISPLAY.lines.map((line, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                            <span className="text-gray-650">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Active trial add-ons cost breakdown selection */}
                  {tenant?.subscriptionStatus === 'trial' && activeAddonsList.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3 mt-6">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Trial Add-ons & Resources Billing Bundling</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          You have enabled these add-ons, additional stores, or extra user seats during your trial period. Select which ones you want to keep and pay for. Unchecked items will be deactivated immediately after payment.
                        </p>
                      </div>
                      <div className="divide-y divide-gray-150">
                        {activeAddonsList.map((item) => {
                          const isExcluded = excludeAddons.includes(item.code);

                          return (
                            <div key={item.code} className="flex items-center justify-between py-3">
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!isExcluded}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setExcludeAddons(prev => prev.filter(c => c !== item.code));
                                    } else {
                                      setExcludeAddons(prev => [...prev, item.code]);
                                    }
                                  }}
                                  className="w-4 h-4 text-brand-orange border-gray-300 rounded focus:ring-brand-orange cursor-pointer"
                                />
                                <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                              </label>
                              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {trialSubscribeStep === 'payment_select' && (
                <div className="space-y-6">
                  <p className="text-sm text-gray-650">
                    Select a payment option below to subscribe to the <strong className="text-gray-900">{selectedPlan?.name || 'selected'} plan</strong>. Total payment amount: <strong className="text-gray-900">{selectedPlan?.currency || 'LKR'} {Number(form.amount).toLocaleString()}</strong> (includes plan renewal fee and active add-ons/user seats for the next {selectedCycle === 'yearly' ? 'year' : 'month'}).
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center py-4">
                    {paymentOptions?.stripe?.enabled && !isInternational && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('stripe');
                          setTrialSubscribeStep('pay_form');
                        }}
                        className="px-6 py-5 border border-gray-350 bg-white rounded-xl hover:border-brand-orange hover:shadow-md transition flex flex-col items-center gap-3 w-40 cursor-pointer"
                      >
                        <PaymentMethodLogo method="stripe" imageUrl={paymentOptions?.stripe?.imageUrl} />
                        <span className="text-xs font-semibold text-gray-700">Pay with Card</span>
                      </button>
                    )}
                    {paymentOptions?.paypal?.enabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('paypal');
                          setTrialSubscribeStep('pay_form');
                        }}
                        className="px-6 py-5 border border-gray-350 bg-white rounded-xl hover:border-brand-orange hover:shadow-md transition flex flex-col items-center gap-3 w-40 cursor-pointer"
                      >
                        <PaymentMethodLogo method="paypal" imageUrl={paymentOptions?.paypal?.imageUrl} />
                        <span className="text-xs font-semibold text-gray-700">Pay with PayPal</span>
                      </button>
                    )}
                    {paymentOptions?.bankAccounts?.length > 0 && !isInternational && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('bank_transfer');
                          setTrialSubscribeStep('pay_form');
                        }}
                        className="px-6 py-5 border border-gray-350 bg-white rounded-xl hover:border-brand-orange hover:shadow-md transition flex flex-col items-center gap-3 w-40 cursor-pointer"
                      >
                        <PaymentMethodLogo method="bank_transfer" />
                        <span className="text-xs font-semibold text-gray-700">Bank Transfer</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {trialSubscribeStep === 'pay_form' && (
                <div className="space-y-4">
                  {renderPaymentFormsContent()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div>
                {(trialSubscribeStep === 'pay_form' || (trialSubscribeStep === 'payment_select' && tenant?.subscriptionStatus === 'trial')) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (trialSubscribeStep === 'pay_form') {
                        setTrialSubscribeStep('payment_select');
                      } else if (trialSubscribeStep === 'payment_select') {
                        setTrialSubscribeStep('plan_select');
                      }
                    }}
                    className="px-4 py-2 text-sm font-semibold text-gray-650 hover:text-gray-900 border border-gray-300 hover:bg-white bg-transparent rounded-lg cursor-pointer transition-colors"
                  >
                    Back
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setTrialSubscribeStep('none'); setSubmitted(false); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-650 hover:text-gray-900 border border-gray-300 hover:bg-white bg-transparent rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                {trialSubscribeStep === 'plan_select' && (
                  <button
                    type="button"
                    disabled={!form.planId || form.planId === 'custom' || isBreakdownFetching}
                    onClick={() => {
                      setTrialSubscribeStep('payment_select');
                    }}
                    className="px-5 py-2 text-sm font-bold text-white bg-brand-orange hover:bg-brand-orange-hover rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isBreakdownFetching ? 'Calculating...' : 'Next: Payment Method'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
