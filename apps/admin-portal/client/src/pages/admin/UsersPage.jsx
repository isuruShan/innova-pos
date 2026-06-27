import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader, UserCheck, UserX, Key, X, Pencil, Search, ArrowLeft, Clock, AlertTriangle, ChevronDown, Trash2, Eye } from 'lucide-react';
import TooltipWrap from '../../components/common/TooltipWrap';
import { useToast } from '../../context/ToastContext';
import api from '../../api/axios';
import useSwipeDismiss from '../../hooks/useSwipeDismiss';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import ListPagination from '../../components/common/ListPagination';
import SortableTh from '../../components/common/SortableTh';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useListSort } from '../../hooks/useListSort';
import { fieldAttrs, validateEmail, validatePersonName } from '../../utils/formFields';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import { BillingQuotePanel, formatMoney, LicenseQuoteBreakdown } from '../../components/billing/ProrationBreakdown';
import BankReceiptFields from '../../components/billing/BankReceiptFields';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const ROLE_COLORS = {
  merchant_admin: 'bg-purple-100 text-purple-700',
  manager:        'bg-blue-100 text-blue-700',
  cashier:        'bg-green-100 text-green-700',
  kitchen:        'bg-orange-100 text-orange-700',
  steward:        'bg-teal-100 text-teal-700',
  purchasing_officer: 'bg-rose-100 text-rose-700',
  inventory_clerk: 'bg-teal-100 text-teal-700',
  commissary_operator: 'bg-indigo-100 text-indigo-700',
};

const ROLE_OPTIONS = [
  { value: 'merchant_admin', label: 'Admin' },
  { value: 'manager',        label: 'Manager' },
  { value: 'cashier',        label: 'Cashier' },
  { value: 'kitchen',        label: 'Kitchen' },
  { value: 'steward',        label: 'Steward' },
  { value: 'purchasing_officer', label: 'Purchasing Officer' },
  { value: 'inventory_clerk', label: 'Inventory Clerk' },
  { value: 'commissary_operator', label: 'Commissary Operator' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc',  label: 'Oldest first' },
  { value: 'name:asc',       label: 'Name A→Z' },
  { value: 'name:desc',      label: 'Name Z→A' },
  { value: 'email:asc',      label: 'Email A→Z' },
  { value: 'role:asc',       label: 'Role' },
];

function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { style, bind } = useSwipeDismiss({ onClose: () => setOpen(false), open });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 min-w-[130px] transition-colors ${selected.length ? 'border-brand-orange text-brand-orange' : 'border-gray-300 text-gray-700'}`}
      >
        <span className="flex-1 text-left truncate">
          {selected.length === 0 ? label : `${label} (${selected.length})`}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-3xl border-t border-gray-200 bg-white shadow-xl py-4 px-4 animate-slide-up sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:mt-1 sm:w-auto sm:min-w-[170px] sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg sm:py-1 sm:px-0 sm:animate-none"
            {...bind}
            style={style}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={(e) =>
                      onChange(e.target.checked ? [...selected, opt.value] : selected.filter((v) => v !== opt.value))
                    }
                    className="rounded accent-brand-orange"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-1">
                <button type="button" onClick={() => onChange([])} className="text-xs text-red-500 hover:underline">
                  Clear
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { isInternational } = useMerchantBillingRegion();
  const { currencySymbol: merchantSymbol, currency: tenantCurrency } = useTenantCurrency();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'cashier', storeIds: [], defaultStoreId: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_users');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilters, setRoleFilters] = useState([]);
  const [storeFilters, setStoreFilters] = useState([]);
  const { sort, order, toggleSort, sortParams, setSort, setOrder } = useListSort('createdAt', 'desc');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState('review');
  const [paymentAction, setPaymentAction] = useState('create_user');
  const [paymentQuote, setPaymentQuote] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [bankFieldErrors, setBankFieldErrors] = useState({});
  const [chosenMethod, setChosenMethod] = useState(null);
  const [bankForm, setBankForm] = useState({ bankReference: '', notes: '' });
  const [bankFile, setBankFile] = useState(null);
  const bankFileRef = useRef(null);
  const paypalContainerRef = useRef(null);
  const [paypalReady, setPaypalReady] = useState(false);
  
  // Route-based tab navigation
  const activeTab = location.pathname.endsWith('/pending') ? 'pending' : 'active';
  const setActiveTab = (tab) => navigate(`/users/${tab}`);
  
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [activateTarget, setActivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);

  useEffect(() => { setPage(1); }, [sort, order]);

  const { data: usersPage, isLoading, isFetching } = useQuery({
    queryKey: ['users', page, search, roleFilters, storeFilters, sortParams],
    queryFn: async () => {
      const params = { page, limit: 25, sort, order };
      if (search.trim()) params.search = search.trim();
      if (roleFilters.length) params.role = roleFilters.join(',');
      if (storeFilters.length) params.storeIds = storeFilters.join(',');
      const { data } = await api.get('/users', { params });
      return unwrapPagedList(data);
    },
  });
  const users = usersPage?.items ?? [];
  const pageMeta = usersPage || { page: 1, pages: 1, total: 0 };

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await api.get('/stores', { params: { page: 1, limit: 500 } });
      return unwrapPagedList(data).items;
    },
  });

  const { data: paymentOptions } = useQuery({
    queryKey: ['merchant-payment-options'],
    queryFn: () => api.get('/platform-payments/merchant-options').then((r) => r.data),
  });

  const { data: subData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => { const { data } = await api.get('/subscriptions/my'); return data; },
  });
  const tenant = subData?.tenant;

  const { data: pendingUserReceipts = [] } = useQuery({
    queryKey: ['merchant-receipts', 'pending-user-license'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/receipts', {
        params: { status: 'pending', kind: 'user_license', limit: 50 },
      });
      const items = unwrapPagedList(data).items;
      return items.map((r) => {
        let payload = {};
        try {
          if (r.userLicensePayload) {
            payload = typeof r.userLicensePayload === 'string'
              ? JSON.parse(r.userLicensePayload)
              : r.userLicensePayload;
          }
        } catch { /* noop */ }
        return { ...r, _parsedPayload: payload };
      });
    },
  });

  const originalStoreIds = useMemo(() => {
    if (!editingUser?.storeIds) return [];
    return editingUser.storeIds.map((s) => s._id || s);
  }, [editingUser]);

  const hasRemovedOriginalStores = useMemo(() => {
    if (!editingUser) return false;
    return originalStoreIds.some((id) => !form.storeIds.includes(String(id)));
  }, [editingUser, originalStoreIds, form.storeIds]);

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['my-users-total'] });
    queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: (_, variables) => {
      invalidateUsers();
      toast.success(`User ${variables.isActive ? 'activated' : 'deactivated'} successfully`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User deleted successfully');
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id) => api.post(`/users/${id}/reset-password`),
    onSuccess: () => toast.success('Password reset email sent'),
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    },
  });

  const handleToggleActiveClick = (user) => {
    if (user.isActive) {
      setDeactivateTarget(user);
    } else {
      setActivateTarget(user);
    }
  };

  const handleToggleActiveConfirm = () => {
    if (deactivateTarget) {
      toggleMutation.mutate(
        { id: deactivateTarget._id, isActive: false },
        { onSuccess: () => setDeactivateTarget(null) }
      );
    }
  };

  const handleActivateConfirm = () => {
    if (activateTarget) {
      toggleMutation.mutate(
        { id: activateTarget._id, isActive: true },
        { onSuccess: () => setActivateTarget(null) }
      );
    }
  };

  const handleResetPasswordClick = (user) => {
    setResetTarget(user);
  };

  const handleResetPasswordConfirm = () => {
    if (resetTarget) {
      resetMutation.mutate(resetTarget._id, {
        onSuccess: () => {
          setResetTarget(null);
        },
      });
    }
  };

  const closePayment = useCallback(() => {
    setPaymentOpen(false);
    setPaymentStep('review');
    setPaymentQuote(null);
    setPaymentError('');
    setBankFieldErrors({});
    setChosenMethod(null);
    setBankForm({ bankReference: '', notes: '' });
    setBankFile(null);
  }, []);

  const closeAll = () => {
    setShowModal(false);
    setEditingUser(null);
    closePayment();
  };

  const finishSuccess = (message) => {
    invalidateUsers();
    closeAll();
    setForm({ name: '', email: '', role: 'cashier', storeIds: [], defaultStoreId: '' });
    toast.success(message);
  };

  const paypalCaptureMutation = useMutation({
    mutationFn: (orderId) =>
      api.post('/subscriptions/checkout/paypal/capture', { orderId }).then((r) => r.data),
    onSuccess: (data) => {
      if (data?.userLicense) {
        finishSuccess(data.message || 'Done');
        return;
      }
      setPaymentError(data?.message || 'Payment did not complete.');
    },
    onError: (err) => setPaymentError(err.response?.data?.message || 'PayPal capture failed'),
  });

  const bankReceiptMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Receipt submitted. The change will apply after super admin approval.');
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
      closeAll();
    },
    onError: (err) => setPaymentError(err.response?.data?.message || 'Upload failed'),
  });

  const buildPayload = () => ({
    ...form,
    defaultStoreId: form.defaultStoreId || form.storeIds[0] || null,
  });

  const licensePayload = () => {
    if (paymentAction === 'assign_stores') {
      return { userId: editingUser._id, storeIds: form.storeIds };
    }
    return buildPayload();
  };

  const validateAndSubmit = async () => {
    const e = {};
    const nameCheck = validatePersonName(form.name, { label: 'Name' });
    if (!nameCheck.ok) e.name = nameCheck.error;
    const emailCheck = validateEmail(form.email);
    if (!emailCheck.ok) e.email = emailCheck.error;
    if (!form.role) e.role = 'Role required';
    if (form.role !== 'merchant_admin' && !form.storeIds.length) {
      e.storeIds = 'Select at least one store for staff users';
    }
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    setErrors({});
    const payload = buildPayload();
    try {
      if (editingUser?._id) {
        await api.put(`/users/${editingUser._id}`, payload);
        finishSuccess('User updated');
      } else {
        await api.post('/users', payload);
        finishSuccess('User created');
      }
    } catch (err) {
      if (err.response?.status === 402 && err.response?.data?.code === 'PAYMENT_REQUIRED') {
        setPaymentQuote(err.response.data.quote);
        setPaymentAction(editingUser?._id ? 'assign_stores' : 'create_user');
        setPaymentOpen(true);
        setPaymentStep('review');
        setSubmitting(false);
        return;
      }
      const msg = err.response?.data?.message || 'Failed to save user';
      if (msg.toLowerCase().includes('email')) {
        setErrors({ email: msg });
      } else {
        setErrors({ api: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const methodOptions = useMemo(() => {
    const o = [];
    if (paymentOptions?.paypal?.enabled) o.push({ id: 'paypal', label: 'PayPal' });
    if (!isInternational && paymentOptions?.bankAccounts?.length) {
      o.push({ id: 'bank_transfer', label: 'Bank transfer' });
    }
    return o;
  }, [paymentOptions, isInternational]);

  useEffect(() => {
    if (isInternational && methodOptions.some((m) => m.id === 'paypal')) {
      setChosenMethod('paypal');
    }
  }, [isInternational, methodOptions]);

  const paypalCurrency = paymentQuote?.priced?.currency || 'LKR';

  useEffect(() => {
    const needPaypal =
      paymentOpen &&
      paymentStep === 'pay' &&
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
  }, [paymentOpen, paymentStep, chosenMethod, paymentOptions, paypalCurrency]);

  useEffect(() => {
    if (!paymentOpen || paymentStep !== 'pay' || chosenMethod !== 'paypal' || !paypalReady || !window.paypal || !paypalContainerRef.current) {
      return undefined;
    }
    const el = paypalContainerRef.current;
    el.innerHTML = '';
    const buttons = window.paypal.Buttons({
      createOrder: async () => {
        const { data } = await api.post('/subscriptions/checkout/paypal/create-user-license-order', {
          action: paymentAction,
          ...licensePayload(),
        });
        return data.orderId;
      },
      onApprove: async (data) => {
        await paypalCaptureMutation.mutateAsync(data.orderID);
      },
      onError: () => setPaymentError('PayPal payment failed'),
    });
    buttons.render(el);
    return () => { el.innerHTML = ''; };
  }, [paymentOpen, paymentStep, chosenMethod, paypalReady, paymentAction, form, editingUser, paypalCaptureMutation]);

  const handleBankSubmit = (e) => {
    e.preventDefault();
    setPaymentError('');
    setBankFieldErrors({});
    if (!paymentQuote?.priced?.amount) return;
    const fieldErrs = {};
    if (!bankForm.bankReference.trim()) fieldErrs.bankReference = 'Bank reference is required';
    if (!bankFile || bankFile._validationError) fieldErrs.file = bankFile?._validationError || 'Receipt photo is required';
    if (Object.keys(fieldErrs).length) { setBankFieldErrors(fieldErrs); return; }
    const fd = new FormData();
    fd.append('purchaseKind', 'user_license');
    fd.append('userLicenseAction', paymentAction);
    fd.append('userLicensePayload', JSON.stringify(licensePayload()));
    fd.append('amount', String(paymentQuote.priced.amount));
    fd.append('bankReference', bankForm.bankReference.trim());
    fd.append('notes', bankForm.notes.trim());
    fd.append('receipt', bankFile);
    bankReceiptMutation.mutate(fd);
  };

  const openCreate = () => {
    setEditingUser(null);
    setErrors({});
    setForm({ name: '', email: '', role: 'cashier', storeIds: [], defaultStoreId: '' });
    setShowModal(true);
  };

  const openEdit = (user) => {
    const mappedStoreIds = (user.storeIds || []).map((s) => (typeof s === 'string' ? s : s?._id)).filter(Boolean);
    const defaultStoreId = typeof user.defaultStoreId === 'string'
      ? user.defaultStoreId
      : user.defaultStoreId?._id || mappedStoreIds[0] || '';
    setEditingUser(user);
    setErrors({});
    setForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'cashier',
      storeIds: mappedStoreIds,
      defaultStoreId,
    });
    setShowModal(true);
  };

  const isMerchantAdminRole = form.role === 'merchant_admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            One user is included with your subscription. Additional users and multi-store access are billed by role.
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover w-full sm:w-auto text-center"
        >
          <Plus size={15} />
          Add user
        </button>
      </div>

      {activeTab === 'active' ? (
        <>
          <ViewModeToggle mode={viewMode} setMode={(mode) => { setViewMode(mode); localStorage.setItem('view_mode_admin_users', mode); }} />

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto sm:flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name or email…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <MultiSelectDropdown
                label="Role"
                options={ROLE_OPTIONS}
                selected={roleFilters}
                onChange={(v) => { setRoleFilters(v); setPage(1); }}
              />

              {stores.length > 0 && (
                <MultiSelectDropdown
                  label="Store"
                  options={stores.map((s) => ({ value: s._id, label: s.name }))}
                  selected={storeFilters}
                  onChange={(v) => { setStoreFilters(v); setPage(1); }}
                />
              )}

              <select
                value={`${sort}:${order}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split(':');
                  setSort(f);
                  setOrder(o);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:bg-gray-50 cursor-pointer w-full sm:w-auto"
                title="Sort by"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {(roleFilters.length > 0 || storeFilters.length > 0 || search) && (
                <button
                  type="button"
                  onClick={() => { setRoleFilters([]); setStoreFilters([]); setSearch(''); setPage(1); }}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 py-1"
                >
                  <X size={12} /> Clear filters
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading users...</div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {users?.map((u) => (
                <div key={u._id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{u.email}</p>
                  <p className="text-xs text-gray-600 mt-2 capitalize">{u.role.replace('_', ' ')}</p>
                  {Array.isArray(u.storeIds) && u.storeIds.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {u.storeIds.map((s) => s?.name || s?.code || 'Unknown').join(', ')}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-150">
                    <button type="button" onClick={() => setViewingUser(u)} className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium flex-1 flex items-center justify-center gap-1">
                      <Eye size={12} /> View details
                    </button>
                    <button type="button" onClick={() => openEdit(u)} disabled={!u.isActive} title={!u.isActive ? 'Reactivate user to edit' : undefined} className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium flex-1 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                      <Pencil size={12} /> Edit details
                    </button>
                    <button type="button" onClick={() => handleResetPasswordClick(u)} disabled={!u.isActive} title={!u.isActive ? 'Cannot reset password for an inactive user' : undefined} className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                      <Key size={12} /> Reset
                    </button>
                    <button type="button" onClick={() => handleToggleActiveClick(u)} disabled={u.isOwner && u.isActive} title={u.isOwner && u.isActive ? 'Account owner cannot be deactivated' : undefined} className={`text-xs px-2.5 py-1.5 rounded-md border font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${u.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                      {u.isActive ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(u)} disabled={u.isOwner} title={u.isOwner ? 'Account owner cannot be deleted' : 'Delete user'} className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {!users?.length && <div className="col-span-full text-center py-12 text-gray-400">No users found</div>}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                      <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                      <SortableTh label="Email" field="email" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                      <SortableTh label="Role" field="role" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                      <th className="px-4 py-3 text-gray-500 font-semibold select-none">Store access</th>
                      <SortableTh label="Status" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                      <th className="px-4 py-3 text-gray-500 font-semibold select-none">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users?.map((u) => (
                      <tr key={u._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="truncate max-w-[12rem] block" title={Array.isArray(u.storeIds) ? u.storeIds.map(s => s?.name || s?.code || 'Unknown').join(', ') : ''}>
                            {Array.isArray(u.storeIds) && u.storeIds.length > 0
                              ? u.storeIds.map(s => s?.name || s?.code || 'Unknown').join(', ')
                              : 'None'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? 'bg-green-150 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setViewingUser(u)} className="text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-1">
                              <Eye size={12} /> View
                            </button>
                            <button type="button" onClick={() => openEdit(u)} disabled={!u.isActive} title={!u.isActive ? 'Reactivate user to edit' : undefined} className="text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                              <Pencil size={12} /> Edit
                            </button>
                            <button type="button" onClick={() => handleResetPasswordClick(u)} disabled={!u.isActive} title={!u.isActive ? 'Cannot reset password for an inactive user' : undefined} className="text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                              <Key size={12} /> Reset
                            </button>
                            <button type="button" onClick={() => handleToggleActiveClick(u)} disabled={u.isOwner && u.isActive} title={u.isOwner && u.isActive ? 'Account owner cannot be deactivated' : undefined} className={`text-xs px-2.5 py-1 rounded-md border font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${u.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                              {u.isActive ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(u)} disabled={u.isOwner} title={u.isOwner ? 'Account owner cannot be deleted' : 'Delete user'} className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-555 hover:bg-red-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!users?.length && <div className="text-center py-12 text-gray-400">No users found</div>}
            </div>
          )}

          {!isLoading && (
            <ListPagination page={pageMeta.page} pages={pageMeta.pages} total={pageMeta.total} onPageChange={setPage} isFetching={isFetching} />
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Clock className="text-amber-500" size={20} />
            <div>
              <h3 className="font-semibold text-gray-900">Users Pending Approval</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                These user licenses will be automatically activated once your payment receipt is verified by our team.
              </p>
            </div>
          </div>
          {pendingUserReceipts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No user requests pending approval.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm text-gray-600 border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Bank Ref</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingUserReceipts.map((r) => {
                    const p = r._parsedPayload;
                    return (
                      <tr key={r._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.email || '—'}</td>
                        <td className="px-4 py-3">
                          {p.role ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-700'}`}>
                              {p.role.replace('_', ' ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                          {formatMoney(r.currency || tenantCurrency || 'LKR', r.amount, merchantSymbol)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(r.paymentDate || r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-600">{r.bankReference || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1 w-fit">
                            <Clock size={11} /> Pending review
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={closeAll}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingUser.name} · {editingUser.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeAll}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {[
                { label: 'Full name', key: 'name', ...fieldAttrs('staffName') },
                { label: 'Email address', key: 'email', type: 'email', ...fieldAttrs('email') },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} placeholder={f.placeholder} maxLength={f.maxLength}
                    disabled={f.key === 'email' && Boolean(editingUser)}
                    onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setErrors(e2 => ({ ...e2, [f.key]: '' })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500 ${errors[f.key] ? 'border-red-400' : 'border-gray-300'}`} />
                  {f.key === 'email' && Boolean(editingUser) && (
                    <p className="text-xs text-gray-400 mt-0.5">Email address cannot be changed after account creation.</p>
                  )}
                  {f.key === 'email' && !editingUser && (
                    <p className="text-xs text-gray-400 mt-0.5">Must be unique — users with an existing account cannot be added again.</p>
                  )}
                  {errors[f.key] && <p className="text-xs text-red-500 mt-0.5">{errors[f.key]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  disabled={Boolean(editingUser)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed">
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="steward">Steward</option>
                  <option value="merchant_admin">Admin</option>
                  <option value="purchasing_officer">Purchasing Officer</option>
                  <option value="inventory_clerk">Inventory Clerk</option>
                  <option value="commissary_operator">Commissary Operator</option>
                </select>
              </div>

              {isMerchantAdminRole ? (
                <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  Merchant admins can access all stores in your business automatically.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store access</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-gray-200 p-2 max-h-40 overflow-auto">
                      {stores.map((store) => (
                        <label key={store._id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={form.storeIds.includes(store._id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setForm((p) => {
                                const nextStoreIds = checked
                                  ? [...new Set([...p.storeIds, store._id])]
                                  : p.storeIds.filter((id) => id !== store._id);
                                const nextDefault = nextStoreIds.includes(p.defaultStoreId) ? p.defaultStoreId : (nextStoreIds[0] || '');
                                return { ...p, storeIds: nextStoreIds, defaultStoreId: nextDefault };
                              });
                            }}
                          />
                          <span>{store.name}</span>
                        </label>
                      ))}
                    </div>
                    {errors.storeIds && <p className="text-xs text-red-500 mt-1">{errors.storeIds}</p>}
                    {hasRemovedOriginalStores && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 animate-fade-in">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>
                          Note: You are removing already subscribed store assignments. This change will reflect in your next subscription billing cycle.
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default store</label>
                    <select value={form.defaultStoreId} onChange={(e) => setForm((p) => ({ ...p, defaultStoreId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" disabled={!form.storeIds.length}>
                      {!form.storeIds.length && <option value="">Select store access first</option>}
                      {stores.filter((s) => form.storeIds.includes(s._id)).map((store) => (
                        <option key={store._id} value={store._id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {errors.api && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{errors.api}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={closeAll} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 text-gray-700 transition">Cancel</button>
              <button type="button" onClick={validateAndSubmit} disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-orange text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-hover disabled:opacity-60 transition shadow-sm">
                {submitting && <Loader size={14} className="animate-spin" />}
                {editingUser ? 'Save changes' : 'Create user'}
              </button>
            </div>
          </aside>
        </>
      )}

      {paymentOpen && paymentQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            {paymentStep !== 'review' && (
              <button type="button" onClick={() => setPaymentStep(paymentStep === 'pay' ? 'method' : 'review')} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <h3 className="font-bold text-gray-900 mb-2">
              {paymentAction === 'create_user' ? 'Pay for additional user' : 'Pay for extra store access'}
            </h3>

            {paymentStep === 'review' && (
              <>
                {paymentQuote.lineItems?.length > 1 ? (
                  <LicenseQuoteBreakdown
                    lineItems={paymentQuote.lineItems}
                    totalAmount={paymentQuote.priced?.amount}
                    currency={paymentQuote.priced?.currency || tenantCurrency}
                    billingLabel={paymentQuote.billingLabel}
                    merchantSymbol={merchantSymbol}
                    recurringRates={paymentQuote.recurringRates}
                  />
                ) : (
                  <BillingQuotePanel
                    recurringRates={paymentQuote.recurringRates}
                    proration={paymentQuote.proration}
                    amountDue={paymentQuote.priced?.amount}
                    currency={paymentQuote.priced?.currency || tenantCurrency}
                    merchantSymbol={merchantSymbol}
                  />
                )}
                {tenant?.subscriptionStatus === 'trial' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-3 mt-6">
                    <p className="font-semibold text-base">Subscription Required</p>
                    <p>You cannot purchase user seats during your trial period. Please subscribe to a paid plan first.</p>
                    <button
                      type="button"
                      onClick={() => { closePayment(); navigate('/subscription'); }}
                      className="w-full py-2.5 bg-brand-orange text-white rounded-xl text-sm font-semibold hover:bg-brand-orange-hover transition shadow-sm"
                    >
                      Subscribe Now
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={closePayment} className="flex-1 py-2.5 border rounded-xl text-sm">Cancel</button>
                    <button type="button" onClick={() => setPaymentStep('method')} className="flex-1 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold">Continue to payment</button>
                  </div>
                )}
              </>
            )}

            {paymentStep === 'method' && (
              <div className="space-y-3">
                {methodOptions.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setChosenMethod(m.id); setPaymentStep('pay'); }}
                    className={`w-full flex items-center gap-3 p-4 border rounded-xl text-left ${chosenMethod === m.id ? 'border-brand-orange bg-orange-50' : 'border-gray-200'}`}>
                    <PaymentMethodLogo method={m.id} />
                    <span className="font-medium">{m.label}</span>
                  </button>
                ))}
                {!methodOptions.length && <p className="text-sm text-amber-700">No payment methods are configured. Contact support.</p>}
                {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
              </div>
            )}

            {paymentStep === 'pay' && chosenMethod === 'paypal' && (
              <div>
                <div ref={paypalContainerRef} />
                {paymentError && <p className="text-sm text-red-600 mt-2">{paymentError}</p>}
              </div>
            )}

            {paymentStep === 'pay' && chosenMethod === 'bank_transfer' && (
              <div className="space-y-4">
                {paymentOptions?.bankAccounts?.length > 0 && (
                  <div className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="font-medium text-gray-900">
                      Transfer exactly{' '}
                      {formatMoney(paymentQuote.priced?.amount, merchantSymbol)}{' '}
                      to:
                    </p>
                    {paymentOptions.bankAccounts.map((b) => (
                      <div key={b._id}>
                        <p className="font-medium">{b.bankName}</p>
                        <p className="text-xs">{b.accountName} · {b.accountNumber}{b.branch ? ` · ${b.branch}` : ''}</p>
                        {b.instructions && <p className="text-xs text-gray-500 mt-0.5">{b.instructions}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <BankReceiptFields
                  bankReference={bankForm.bankReference}
                  onBankReferenceChange={(v) => setBankForm((f) => ({ ...f, bankReference: v }))}
                  notes={bankForm.notes}
                  onNotesChange={(v) => setBankForm((f) => ({ ...f, notes: v }))}
                  file={bankFile}
                  onFileChange={setBankFile}
                  fileInputRef={bankFileRef}
                  error={paymentError}
                  bankReferenceError={bankFieldErrors.bankReference}
                  fileError={bankFieldErrors.file}
                  isPending={bankReceiptMutation.isPending}
                  onSubmit={handleBankSubmit}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(activateTarget)}
        title="Activate user?"
        message={
          activateTarget
            ? `Activate "${activateTarget.name}"? They will regain access to the POS and Admin portal.`
            : ''
        }
        confirmLabel="Activate"
        variant="success"
        isLoading={toggleMutation.isPending}
        onConfirm={handleActivateConfirm}
        onCancel={() => setActivateTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate user?"
        message={
          deactivateTarget
            ? `Deactivate "${deactivateTarget.name}"? They will no longer be able to log in.\n\nNote: Deactivating a user does not remove their subscription cost from your billing — the license fee will continue to be charged each cycle until the user is deleted.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={toggleMutation.isPending}
        onConfirm={handleToggleActiveConfirm}
        onCancel={() => setDeactivateTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete user permanently?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}" (${deleteTarget.email})? This cannot be undone and they will immediately lose all access.\n\nThe subscription cost associated with this user license will be removed from your next billing cycle.`
            : ''
        }
        confirmLabel="Delete user"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset password?"
        message={
          resetTarget
            ? `Reset the password for "${resetTarget.name}"? An email with a temporary password will be sent to ${resetTarget.email}.`
            : ''
        }
        confirmLabel="Reset password"
        variant="warning"
        isLoading={resetMutation.isPending}
        onConfirm={handleResetPasswordConfirm}
        onCancel={() => setResetTarget(null)}
      />

      {viewingUser && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setViewingUser(null)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-slide-in"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  User Details
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Full profile configuration and metadata
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Header profile info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center font-bold text-xl shadow-inner border border-brand-orange/20">
                  {viewingUser.name ? viewingUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h4 className="font-bold text-gray-950 text-base">{viewingUser.name}</h4>
                  <p className="text-xs text-gray-500">{viewingUser.email}</p>
                </div>
              </div>

              {/* Status and Role badges */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200/60 shadow-sm">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${viewingUser.isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                    {viewingUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">System Role</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[viewingUser.role] || 'bg-gray-100 text-gray-700'}`}>
                    {viewingUser.role ? viewingUser.role.replace('_', ' ') : '—'}
                  </span>
                </div>
              </div>

              {/* Store access details */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Store Access Settings</h5>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden shadow-sm">
                  {viewingUser.role === 'merchant_admin' ? (
                    <div className="p-4 text-xs text-gray-500 bg-gray-50/50">
                      ℹ️ Admins possess global permissions and have access to all stores.
                    </div>
                  ) : (
                    <>
                      <div className="p-4">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Default Store Login</p>
                        <p className="text-xs font-semibold text-gray-900">
                          {stores.find(s => s._id === (viewingUser.defaultStoreId?._id || viewingUser.defaultStoreId))?.name || 'No default store configured'}
                        </p>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Authorized Stores ({viewingUser.storeIds?.length || 0})</p>
                        {viewingUser.storeIds?.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {viewingUser.storeIds.map((store) => (
                              <span key={store._id || store} className="inline-flex items-center bg-gray-100 text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-medium">
                                🏢 {store.name || stores.find(s => s._id === store)?.name || 'Unknown Store'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-red-500 italic">No store access configured.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t border-gray-150 text-[11px] text-gray-400 space-y-1">
                <p>User ID: <span className="font-mono">{viewingUser._id}</span></p>
                {viewingUser.createdAt && (
                  <p>Added on: {new Date(viewingUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                )}
              </div>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50/50 flex gap-3">
              <button
                type="button"
                onClick={() => { setViewingUser(null); openEdit(viewingUser); }}
                disabled={!viewingUser.isActive}
                className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Pencil size={14} /> Edit profile
              </button>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="flex-1 bg-gray-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition text-sm text-center"
              >
                Close
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
