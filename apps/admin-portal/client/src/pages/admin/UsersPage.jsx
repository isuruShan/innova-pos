import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader, UserCheck, UserX, Key, X, Pencil, Search, ArrowLeft } from 'lucide-react';
import TooltipWrap from '../../components/common/TooltipWrap';
import { useToast } from '../../context/ToastContext';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import ListPagination from '../../components/common/ListPagination';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { fieldAttrs, validateEmail, validatePersonName } from '../../utils/formFields';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import ProrationBreakdown from '../../components/billing/ProrationBreakdown';
import BankReceiptFields from '../../components/billing/BankReceiptFields';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';

const ROLE_COLORS = {
  merchant_admin: 'bg-purple-100 text-purple-700',
  manager:        'bg-blue-100 text-blue-700',
  cashier:        'bg-green-100 text-green-700',
  kitchen:        'bg-orange-100 text-orange-700',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isInternational } = useMerchantBillingRegion();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'cashier', storeIds: [], defaultStoreId: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_admin_users') || 'table');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilters, setRoleFilters] = useState([]);
  const [storeFilters, setStoreFilters] = useState([]);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState('review');
  const [paymentAction, setPaymentAction] = useState('create_user');
  const [paymentQuote, setPaymentQuote] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [chosenMethod, setChosenMethod] = useState(null);
  const [bankForm, setBankForm] = useState({ bankReference: '', notes: '' });
  const [bankFile, setBankFile] = useState(null);
  const bankFileRef = useRef(null);
  const paypalContainerRef = useRef(null);
  const [paypalReady, setPaypalReady] = useState(false);

  const { data: usersPage, isLoading, isFetching } = useQuery({
    queryKey: ['users', page, search, roleFilters, storeFilters],
    queryFn: async () => {
      const params = { page, limit: 25 };
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

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['my-users-total'] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}`, { isActive }),
    onSuccess: invalidateUsers,
  });

  const resetMutation = useMutation({
    mutationFn: (id) => api.post(`/users/${id}/reset-password`),
    onSuccess: () => toast.success('Password reset email sent'),
  });

  const closePayment = useCallback(() => {
    setPaymentOpen(false);
    setPaymentStep('review');
    setPaymentQuote(null);
    setPaymentError('');
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
      setErrors({ api: err.response?.data?.message || 'Failed to save user' });
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
    if (!paymentQuote?.priced?.amount) return;
    if (!bankForm.bankReference.trim()) {
      setPaymentError('Bank reference is required.');
      return;
    }
    if (!bankFile) {
      setPaymentError('Receipt upload is required.');
      return;
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            One user is included with your subscription. Additional users and multi-store access are billed by role.
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover"
        >
          <Plus size={15} />
          Add user
        </button>
      </div>
      <ViewModeToggle mode={viewMode} setMode={(mode) => { setViewMode(mode); localStorage.setItem('view_mode_admin_users', mode); }} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Roles</p>
            <div className="flex flex-wrap gap-2">
              {['merchant_admin', 'manager', 'cashier', 'kitchen'].map((role) => (
                <label key={role} className="inline-flex items-center gap-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                  <input
                    type="checkbox"
                    checked={roleFilters.includes(role)}
                    onChange={(e) => {
                      setPage(1);
                      setRoleFilters((prev) => (e.target.checked ? [...prev, role] : prev.filter((r) => r !== role)));
                    }}
                  />
                  {role.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Stores</p>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {stores.map((s) => (
                <label key={s._id} className="inline-flex items-center gap-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1">
                  <input
                    type="checkbox"
                    checked={storeFilters.includes(s._id)}
                    onChange={(e) => {
                      setPage(1);
                      setStoreFilters((prev) => (e.target.checked ? [...prev, s._id] : prev.filter((id) => id !== s._id)));
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
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
              <div className="mt-4 flex items-center gap-2">
                <TooltipWrap title={u.isActive ? 'Deactivate user' : 'Activate user'}><button type="button" onClick={() => toggleMutation.mutate({ id: u._id, isActive: !u.isActive })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">{u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}</button></TooltipWrap>
                <TooltipWrap title="Send password reset email"><button type="button" onClick={() => resetMutation.mutate(u._id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Key size={14} /></button></TooltipWrap>
                <TooltipWrap title="Edit user"><button type="button" onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button></TooltipWrap>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users?.map(u => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.isActive ? 'bg-brand-brown-deep' : 'bg-gray-400'}`}>
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                    {Array.isArray(u.storeIds) && u.storeIds.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Stores: {u.storeIds.map((s) => s?.name || s?.code || 'Unknown').join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => toggleMutation.mutate({ id: u._id, isActive: !u.isActive })} title={u.isActive ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><UserX size={14} /></button>
                      <button type="button" onClick={() => resetMutation.mutate(u._id)} title="Reset password" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Key size={14} /></button>
                      <button type="button" onClick={() => openEdit(u)} title="Edit user" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil size={14} /></button>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">{editingUser ? 'Edit user' : 'Add new user'}</h3>
              <button type="button" onClick={closeAll} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Full name', key: 'name', ...fieldAttrs('staffName') },
                { label: 'Email', key: 'email', type: 'email', ...fieldAttrs('email') },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} placeholder={f.placeholder} maxLength={f.maxLength}
                    onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setErrors(e2 => ({ ...e2, [f.key]: '' })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${errors[f.key] ? 'border-red-400' : 'border-gray-300'}`} />
                  {errors[f.key] && <p className="text-xs text-red-500 mt-0.5">{errors[f.key]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="merchant_admin">Admin</option>
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

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={closeAll} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={validateAndSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold disabled:opacity-60">
                {submitting ? <Loader size={14} className="animate-spin" /> : (editingUser ? 'Save changes' : 'Create user')}
              </button>
            </div>
          </div>
        </div>
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
                {/* Line-item breakdown when multiple charges are present */}
                {paymentQuote.lineItems?.length > 1 ? (
                  <div className="mb-4 rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {paymentQuote.lineItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-semibold text-gray-900">
                          {item.currency} {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {item.proration?.isProrated && (
                            <span className="ml-1 text-xs text-amber-600 font-normal">
                              ({item.proration.remainingDays}d prorated)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-bold">
                      <span className="text-gray-900">Total due now</span>
                      <span className="text-brand-orange">
                        {paymentQuote.priced?.currency}{' '}
                        {Number(paymentQuote.priced?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mb-4">
                    {paymentQuote.priced?.label || 'License fee'}{' '}
                    — <strong>{paymentQuote.priced?.currency} {Number(paymentQuote.priced?.amount || 0).toLocaleString()}</strong>
                    {paymentQuote.billingLabel ? ` (${paymentQuote.billingLabel})` : ''}
                  </p>
                )}
                {paymentQuote.proration && <ProrationBreakdown proration={paymentQuote.proration} />}
                {paymentQuote.billingLabel && paymentQuote.lineItems?.length > 1 && (
                  <p className="text-xs text-gray-400 mb-2">{paymentQuote.billingLabel}</p>
                )}
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={closePayment} className="flex-1 py-2.5 border rounded-xl text-sm">Cancel</button>
                  <button type="button" onClick={() => setPaymentStep('method')} className="flex-1 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold">Continue to payment</button>
                </div>
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
              <form onSubmit={handleBankSubmit} className="space-y-4">
                <BankReceiptFields
                  bankForm={bankForm}
                  setBankForm={setBankForm}
                  bankFile={bankFile}
                  setBankFile={setBankFile}
                  bankFileRef={bankFileRef}
                  bankAccounts={paymentOptions?.bankAccounts || []}
                  expectedAmount={paymentQuote.priced?.amount}
                  currency={paymentQuote.priced?.currency}
                />
                {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
                <button type="submit" disabled={bankReceiptMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold disabled:opacity-60">
                  {bankReceiptMutation.isPending ? 'Submitting…' : 'Submit receipt'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
