import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, X, ArrowLeft, Plus } from 'lucide-react';
import api from '../../api/axios';
import { fieldAttrs, PLACEHOLDERS } from '../../utils/formFields';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import ListPagination from '../../components/common/ListPagination';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import ProrationBreakdown from '../../components/billing/ProrationBreakdown';
import BankReceiptFields from '../../components/billing/BankReceiptFields';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';

export default function StoresPage() {
  const { isSuperAdmin, isMerchantAdmin } = useAuth();
  const canCreateStore = isSuperAdmin || isMerchantAdmin;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', address: '', phone: '', paymentMethods: ['cash'] });
  const [editingStore, setEditingStore] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', address: '', phone: '', paymentMethods: ['cash'], isActive: true,
  });
  const [editMeta, setEditMeta] = useState({ deactivatedBySuperadmin: false });
  const toast = useToast();
  const { isInternational } = useMerchantBillingRegion();
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_admin_stores') || 'table');
  const [storePage, setStorePage] = useState(1);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState('review');
  const [chosenMethod, setChosenMethod] = useState(null);
  const [purchaseQuote, setPurchaseQuote] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [bankForm, setBankForm] = useState({ bankReference: '', notes: '' });
  const [bankFile, setBankFile] = useState(null);
  const bankFileRef = useRef(null);
  const paypalContainerRef = useRef(null);
  const [paypalReady, setPaypalReady] = useState(false);

  const { data: storeList = { items: [], page: 1, pages: 1, total: 0 }, isLoading, isFetching } = useQuery({
    queryKey: ['admin-stores', storePage],
    queryFn: async () => {
      const { data } = await api.get('/stores', { params: { page: storePage, limit: 20 } });
      return unwrapPagedList(data);
    },
  });
  const stores = storeList.items || [];

  const { data: paymentOptions } = useQuery({
    queryKey: ['merchant-payment-options'],
    queryFn: () => api.get('/platform-payments/merchant-options').then((r) => r.data),
    enabled: isMerchantAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-store-access'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { page: 1, limit: 500 } });
      return unwrapPagedList(data).items;
    },
  });

  const createStoreSuper = useMutation({
    mutationFn: (payload) => api.post('/stores', payload),
    onSuccess: () => {
      setForm({ name: '', address: '', phone: '', paymentMethods: ['cash'] });
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create store'),
  });

  const createIncludedStore = useMutation({
    mutationFn: () => api.post('/stores/create-included'),
    onSuccess: (res) => {
      const created = res?.data;
      toast.success(`Store ${created?.code || ''} created. Edit name and settings below.`);
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      closePurchase();
      if (created?._id) openEdit(created);
    },
    onError: (err) => setPurchaseError(err.response?.data?.message || 'Failed to create store'),
  });

  const bankReceiptMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Receipt submitted. Your store will be created after verification.');
      closePurchase();
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
    onError: (err) => setPurchaseError(err.response?.data?.message || 'Upload failed'),
  });

  const paypalCaptureMutation = useMutation({
    mutationFn: (orderId) => api.post('/subscriptions/checkout/paypal/capture', { orderId }).then((r) => r.data),
    onSuccess: (data) => {
      if (data?.store) {
        toast.success(data.message || 'Store created.');
        queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
        queryClient.invalidateQueries({ queryKey: ['stores'] });
        closePurchase();
        return;
      }
      setPurchaseError(data?.message || 'Payment did not create a store.');
    },
    onError: (err) => setPurchaseError(err.response?.data?.message || 'PayPal capture failed'),
  });

  const closePurchase = useCallback(() => {
    setPurchaseOpen(false);
    setPurchaseStep('review');
    setChosenMethod(null);
    setPurchaseQuote(null);
    setPurchaseError('');
    setBankForm({ bankReference: '', notes: '' });
    setBankFile(null);
  }, []);

  const startCreateStore = async () => {
    setPurchaseError('');
    try {
      const { data: quote } = await api.get('/stores/create-quote');
      if (quote.error) {
        setError(quote.error);
        return;
      }
      if (!quote.requiresPayment) {
        createIncludedStore.mutate();
        return;
      }
      setPurchaseQuote(quote);
      setPurchaseOpen(true);
      setPurchaseStep('review');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load store pricing');
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

  const paypalCurrency = purchaseQuote?.priced?.currency || 'LKR';

  useEffect(() => {
    const needPaypal =
      purchaseOpen &&
      purchaseStep === 'pay' &&
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
  }, [purchaseOpen, purchaseStep, chosenMethod, paymentOptions, paypalCurrency]);

  useEffect(() => {
    if (!purchaseOpen || purchaseStep !== 'pay' || chosenMethod !== 'paypal' || !paypalReady || !window.paypal || !paypalContainerRef.current) {
      return undefined;
    }
    const el = paypalContainerRef.current;
    el.innerHTML = '';
    const buttons = window.paypal.Buttons({
      createOrder: async () => {
        const { data } = await api.post('/subscriptions/checkout/paypal/create-store-order');
        return data.orderId;
      },
      onApprove: async (data) => {
        await paypalCaptureMutation.mutateAsync(data.orderID);
      },
      onError: () => setPurchaseError('PayPal payment failed'),
    });
    buttons.render(el);
    return () => { el.innerHTML = ''; };
  }, [purchaseOpen, purchaseStep, chosenMethod, paypalReady, paypalCaptureMutation]);

  const handleStoreBankSubmit = (e) => {
    e.preventDefault();
    setPurchaseError('');
    if (!purchaseQuote?.priced?.amount) return;
    if (!bankForm.bankReference.trim()) {
      setPurchaseError('Bank reference is required.');
      return;
    }
    if (!bankFile) {
      setPurchaseError('Receipt upload is required.');
      return;
    }
    const fd = new FormData();
    fd.append('purchaseKind', 'store');
    fd.append('amount', String(purchaseQuote.priced.amount));
    fd.append('bankReference', bankForm.bankReference.trim());
    fd.append('notes', bankForm.notes.trim());
    fd.append('receipt', bankFile);
    bankReceiptMutation.mutate(fd);
  };

  const updateStore = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/stores/${id}`, payload),
    onSuccess: () => {
      setEditingStore(null);
      setEditForm({
        name: '', address: '', phone: '', paymentMethods: ['cash'], isActive: true,
      });
      setEditMeta({ deactivatedBySuperadmin: false });
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update store'),
  });
  const updateUserAccess = useMutation({
    mutationFn: ({ userId, payload }) => api.put(`/users/${userId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-for-store-access'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update store access'),
  });

  const onCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Store name is required');
      return;
    }
    createStoreSuper.mutate(form);
  };

  const openEdit = (store) => {
    setEditingStore(store);
    setEditForm({
      name: store.name || '',
      address: store.address || '',
      phone: store.phone || '',
      paymentMethods: store.paymentMethods?.length ? store.paymentMethods : ['cash'],
      isActive: store.isActive !== false,
    });
    setEditMeta({ deactivatedBySuperadmin: Boolean(store.deactivatedBySuperadmin) });
    setError('');
  };

  const onEditSave = (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setError('Store name is required');
      return;
    }
    updateStore.mutate({ id: editingStore._id, payload: editForm });
  };
  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_admin_stores', mode);
  };

  const storeUsers = (storeId) => (
    users.filter((u) => Array.isArray(u.storeIds) && u.storeIds.some((s) => (typeof s === 'string' ? s : s?._id) === storeId))
  );

  const toggleUserStoreAccess = (user, storeId, checked) => {
    const currentStoreIds = Array.isArray(user.storeIds)
      ? user.storeIds.map((s) => (typeof s === 'string' ? s : s?._id)).filter(Boolean)
      : [];
    const nextStoreIds = checked
      ? [...new Set([...currentStoreIds, storeId])]
      : currentStoreIds.filter((id) => id !== storeId);
    const defaultStoreIdRaw = typeof user.defaultStoreId === 'string' ? user.defaultStoreId : user.defaultStoreId?._id;
    const nextDefaultStoreId = nextStoreIds.includes(defaultStoreIdRaw) ? defaultStoreIdRaw : (nextStoreIds[0] || null);
    updateUserAccess.mutate({
      userId: user._id,
      payload: { storeIds: nextStoreIds, defaultStoreId: nextDefaultStoreId },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Stores</h2>
        <p className="text-sm text-gray-500 mt-1">
          {isSuperAdmin
            ? 'Create and manage store branches for merchants.'
            : isMerchantAdmin
              ? 'Your first store is included in your plan. Additional locations require payment, then you can edit name and settings.'
              : 'Edit details for stores assigned to your admin account.'}
        </p>
        {isMerchantAdmin && (
          <button
            type="button"
            onClick={startCreateStore}
            disabled={createIncludedStore.isPending}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
          >
            {createIncludedStore.isPending ? <Loader size={14} className="animate-spin" /> : <Plus size={16} />}
            Create store
          </button>
        )}
      </div>

      {isSuperAdmin && canCreateStore && (
        <form onSubmit={onCreate} className="rounded-xl border border-gray-200 bg-white p-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><label className="block text-xs text-gray-500 mb-1">Store Name</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={PLACEHOLDERS.storeName}
          maxLength={fieldAttrs('storeName').maxLength} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Address</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={PLACEHOLDERS.addressLine1}
          maxLength={fieldAttrs('addressLine1').maxLength} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Payment Methods (cash required)</label>
            <div className="flex flex-wrap gap-3">
              {['cash', 'card', 'bank_transfer', 'mobile_wallet'].map((m) => (
                <label key={m} className="text-sm text-gray-700 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.paymentMethods.includes(m)}
                    disabled={m === 'cash'}
                    onChange={() => setForm((p) => {
                      const has = p.paymentMethods.includes(m);
                      const next = has ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m];
                      if (!next.includes('cash')) next.unshift('cash');
                      return { ...p, paymentMethods: [...new Set(next)] };
                    })}
                  />
                  <span className="capitalize">{m.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold disabled:opacity-60" disabled={createStoreSuper.isPending}>
              {createStoreSuper.isPending ? 'Creating...' : 'Create store'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>
      )}

      <div className="flex justify-end">
        <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stores.map((store) => (
              <div key={store._id} className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900">{store.name}</p>
                  {store.isActive === false && (
                    <span className="inline-block text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{store.address || 'No address'}</p>
                <p className="text-xs text-gray-500 mt-1">{store.phone || 'No phone'}</p>
                <button className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-brand-orange text-brand-orange font-medium hover:bg-brand-orange hover:text-white transition-colors" onClick={() => openEdit(store)}>
                  Edit store
                </button>
                {!isSuperAdmin && (
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Store Access Users</p>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {users.map((u) => {
                        const assigned = storeUsers(store._id).some((su) => su._id === u._id);
                        return (
                          <label key={u._id} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={(e) => toggleUserStoreAccess(u, store._id, e.target.checked)}
                            />
                            <span>{u.name} ({u.role?.replace('_', ' ')})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!stores.length && <p className="text-sm text-gray-500">No stores yet.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Store', 'Address', 'Phone', 'Status', 'Default', 'Action'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading stores...</td></tr>
            )}
            {!isLoading && stores.map((store) => (
              <tr key={store._id} className={store.isActive === false ? 'bg-gray-50/80' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900">{store.name}</td>
                <td className="px-4 py-3 text-gray-600">{store.address || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{store.phone || '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {store.isActive === false ? (
                    <span className="text-xs font-medium text-red-600">Inactive</span>
                  ) : (
                    <span className="text-xs font-medium text-green-700">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{store.isDefault ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <button className="text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => openEdit(store)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !stores.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No stores yet</td></tr>
            )}
          </tbody>
          </table>
          </div>
        )}
        <ListPagination
          page={storeList.page}
          pages={storeList.pages}
          total={storeList.total}
          onPageChange={setStorePage}
          isFetching={isFetching}
          className="px-4"
        />
      </div>

      {purchaseOpen && purchaseQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Additional store</h3>
              <button type="button" onClick={closePurchase} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X size={22} />
              </button>
            </div>
            {purchaseStep === 'review' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">{purchaseQuote.shortDescription}</p>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase">Amount due now</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {purchaseQuote.priced.currency} {Number(purchaseQuote.priced.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{purchaseQuote.priced.billingLabel}</p>
                </div>
                <ProrationBreakdown
                  proration={purchaseQuote.proration}
                  fullCycle={{ amount: purchaseQuote.proration?.fullAmount, label: purchaseQuote.priced?.label }}
                  currency={purchaseQuote.priced?.currency}
                />
                {methodOptions.length === 0 ? (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">No payment methods configured. Contact support.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setPurchaseStep('method'); setPurchaseError(''); }}
                    className="w-full py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold"
                  >
                    Continue to payment
                  </button>
                )}
              </div>
            )}
            {purchaseStep === 'method' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Choose payment method.</p>
                <div className="flex flex-wrap gap-2">
                  {methodOptions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setChosenMethod(m.id); setPurchaseStep('pay'); }}
                      className="px-4 py-3 rounded-lg border border-gray-300 flex items-center gap-2 hover:border-brand-orange text-sm font-medium"
                    >
                      <PaymentMethodLogo method={m.id === 'bank_transfer' ? 'bank_transfer' : m.id} />
                      {m.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPurchaseStep('review')} className="text-sm text-gray-600 flex items-center gap-1">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            )}
            {purchaseStep === 'pay' && chosenMethod === 'paypal' && (
              <div className="space-y-3">
                <ProrationBreakdown proration={purchaseQuote.proration} currency={purchaseQuote.priced?.currency} />
                {!paypalReady ? <p className="text-xs text-gray-500">Loading PayPal…</p> : null}
                <div ref={paypalContainerRef} className="min-h-[44px]" />
                <button type="button" onClick={() => setPurchaseStep('method')} className="text-sm text-gray-600 flex items-center gap-1">
                  <ArrowLeft size={14} /> Change method
                </button>
              </div>
            )}
            {purchaseStep === 'pay' && chosenMethod === 'bank_transfer' && paymentOptions?.bankAccounts?.length > 0 && (
              <div className="space-y-4">
                <ProrationBreakdown proration={purchaseQuote.proration} currency={purchaseQuote.priced?.currency} />
                <div className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="font-medium">Transfer exactly {purchaseQuote.priced.currency} {Number(purchaseQuote.priced.amount).toLocaleString()} to:</p>
                  {paymentOptions.bankAccounts.map((b) => (
                    <div key={b._id} className="mt-2">
                      <p className="font-medium">{b.label} — {b.bankName}</p>
                      <p className="text-xs">{b.accountName} · {b.accountNumber}</p>
                    </div>
                  ))}
                </div>
                <BankReceiptFields
                  bankReference={bankForm.bankReference}
                  onBankReferenceChange={(v) => setBankForm((f) => ({ ...f, bankReference: v }))}
                  notes={bankForm.notes}
                  onNotesChange={(v) => setBankForm((f) => ({ ...f, notes: v }))}
                  file={bankFile}
                  onFileChange={setBankFile}
                  fileInputRef={bankFileRef}
                  error={purchaseError}
                  isPending={bankReceiptMutation.isPending}
                  onSubmit={handleStoreBankSubmit}
                />
              </div>
            )}
            {purchaseError && purchaseStep !== 'pay' ? <p className="text-sm text-red-600">{purchaseError}</p> : null}
          </div>
        </div>
      )}

      {editingStore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setEditingStore(null)} aria-hidden="true" />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Edit Store</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingStore.name}</p>
              </div>
              <button type="button" onClick={() => setEditingStore(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={onEditSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Store Name *</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" 
                  placeholder={PLACEHOLDERS.storeName}
                  maxLength={fieldAttrs('storeName').maxLength} 
                  value={editForm.name} 
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" 
                  placeholder="Store address" 
                  value={editForm.address} 
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" 
                  placeholder="Phone number" 
                  value={editForm.phone} 
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Methods</label>
                <p className="text-xs text-gray-500 mb-3">Cash is always required. Select additional payment types accepted at this location.</p>
                <div className="grid grid-cols-2 gap-2">
                  {['cash', 'card', 'bank_transfer', 'mobile_wallet'].map((m) => (
                    <label key={m} className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-brand-orange transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.paymentMethods.includes(m)}
                        disabled={m === 'cash'}
                        onChange={() => setEditForm((p) => {
                          const has = p.paymentMethods.includes(m);
                          const next = has ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m];
                          if (!next.includes('cash')) next.unshift('cash');
                          return { ...p, paymentMethods: [...new Set(next)] };
                        })}
                        className="w-4 h-4 accent-brand-orange"
                      />
                      <span className="text-sm text-gray-700 capitalize">{m.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    disabled={!isSuperAdmin && editMeta.deactivatedBySuperadmin}
                    onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-brand-orange"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">Store is active</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Inactive stores cannot accept orders</span>
                  </span>
                </label>
                {!isSuperAdmin && editMeta.deactivatedBySuperadmin && (
                  <p className="text-xs text-amber-600 mt-2 flex items-start gap-1.5">
                    <span>⚠️</span>
                    <span>This store was deactivated by a superadmin. Contact support to reactivate.</span>
                  </p>
                )}
              </div>
            </form>
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={onEditSave} 
                  disabled={updateStore.isPending}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60 transition-colors"
                >
                  {updateStore.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingStore(null)} 
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
                />
                Store is active (visible in POS)
              </label>
              {!isSuperAdmin && editMeta.deactivatedBySuperadmin && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                  This store was disabled by a superadmin. You cannot turn it back on.
                </p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingStore(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={updateStore.isPending} className="flex-1 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-semibold disabled:opacity-60">
                  {updateStore.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
