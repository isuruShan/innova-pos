import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, X, ArrowLeft, Plus, Search, Star, Trash2, Clock, ChevronDown, Check, Filter, ArrowUpDown } from 'lucide-react';
import api from '../../api/axios';
import { fieldAttrs, PLACEHOLDERS } from '../../utils/formFields';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import ListPagination from '../../components/common/ListPagination';
import SortableTh from '../../components/common/SortableTh';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useListSort } from '../../hooks/useListSort';
import PaymentMethodLogo from '../../components/subscription/PaymentMethodLogo';
import { BillingQuotePanel, formatMoney } from '../../components/billing/ProrationBreakdown';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';
import BankReceiptFields from '../../components/billing/BankReceiptFields';
import { useMerchantBillingRegion } from '../../hooks/useMerchantBillingRegion';
import StoreCreateDrawer from '../../components/superadmin/StoreCreateDrawer';
import MobilePhoneField, { validateMobileField, phoneValueFromField } from '../../components/MobilePhoneField';
import { parsePhoneForField } from '../../utils/phone';
import { DEFAULT_COUNTRY_CODE } from '../../constants/countries';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_wallet', label: 'Mobile Wallet' },
];

const SORT_OPTIONS = [
  { label: 'Name (A-Z)', sort: 'name', order: 'asc' },
  { label: 'Name (Z-A)', sort: 'name', order: 'desc' },
  { label: 'Newest First', sort: 'createdAt', order: 'desc' },
  { label: 'Oldest First', sort: 'createdAt', order: 'asc' },
  { label: 'Active First', sort: 'status', order: 'asc' },
  { label: 'Inactive First', sort: 'status', order: 'desc' },
];

const formatAddress = (addr) => {
  if (!addr) return 'No address';
  if (typeof addr === 'string') return addr;
  const parts = [addr.street1, addr.street2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
  return parts.join(', ') || 'No address';
};

function MultiSelectDropdown({ label, options, selected, onChange, icon: Icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value) => {
    const isSelected = selected.includes(value);
    const nextSelected = isSelected
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(nextSelected);
  };

  const displayText = selected.length === 0
    ? 'None'
    : selected.length === options.length
      ? 'All'
      : selected.map(val => options.find(o => o.value === val)?.label || val).join(', ');

  return (
    <div ref={containerRef} className="relative inline-block text-left w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between w-full sm:w-auto min-w-[160px] gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange shadow-xs"
      >
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon size={16} className="text-gray-400 shrink-0" />}
          <span className="text-gray-450 font-normal">{label}:</span>{' '}
          <span className="truncate font-semibold text-gray-800">{displayText}</span>
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 z-25 mt-2 w-56 rounded-xl bg-white border border-gray-150 shadow-lg py-1.5 focus:outline-none animate-fade-in">
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{label} Options</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange(options.map(o => o.value))}
                className="text-[10px] font-semibold text-brand-orange hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-semibold text-gray-400 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto px-1 py-1 space-y-0.5">
            {options.map((option) => {
              const isChecked = selected.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-gray-750 hover:bg-gray-50 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(option.value)}
                    className="rounded border-gray-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SortDropdown({ sort, order, onSortChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOption = options.find((o) => o.sort === sort && o.order === order) || options[0];

  return (
    <div ref={containerRef} className="relative inline-block text-left w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between w-full sm:w-auto min-w-[160px] gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange shadow-xs"
      >
        <span className="flex items-center gap-1.5 truncate">
          <ArrowUpDown size={16} className="text-gray-400 shrink-0" />
          <span className="text-gray-450 font-normal">Sort:</span>{' '}
          <span className="truncate font-semibold text-gray-800">{activeOption?.label}</span>
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-25 mt-2 w-56 rounded-xl bg-white border border-gray-150 shadow-lg py-1 focus:outline-none animate-fade-in">
          <div className="px-3 py-1.5 border-b border-gray-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Sort By</span>
          </div>
          <div className="py-1 px-1 space-y-0.5">
            {options.map((option, idx) => {
              const isActive = option.sort === sort && option.order === order;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSortChange(option.sort, option.order);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-brand-orange/5 text-brand-orange font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{option.label}</span>
                  {isActive && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}




export default function StoresPage({ tenantIdOverride = null, workspaceMode = false, workspaceTitle = '' }) {
  const { isSuperAdmin, isMerchantAdmin } = useAuth();
  const canCreateStore = isSuperAdmin || isMerchantAdmin;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    phone: '',
    paymentMethods: ['cash'],
  });
  const [editingStoreId, setEditingStoreId] = useState('');
  const [editingStore, setEditingStore] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    paymentMethods: ['cash'],
    isActive: true,
    posMenuLayout: 'default',
  });
  const [editMeta, setEditMeta] = useState({ deactivatedBySuperadmin: false });
  const [editPhoneCountryIso, setEditPhoneCountryIso] = useState(DEFAULT_COUNTRY_CODE);
  const [editPhoneNationalDigits, setEditPhoneNationalDigits] = useState('');
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { isInternational } = useMerchantBillingRegion();
  const { currencySymbol: merchantSymbol } = useTenantCurrency();
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_admin_stores') || 'table');
  const [storePage, setStorePage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(['active', 'inactive']);
  const [paymentMethodsFilter, setPaymentMethodsFilter] = useState(['cash', 'card', 'bank_transfer', 'mobile_wallet']);
  const { sort, order, toggleSort, sortParams, setSort, setOrder } = useListSort('name', 'asc');
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Route-based tab navigation
  const activeTab = location.pathname.endsWith('/pending') ? 'pending' : 'active';
  const setActiveTab = (tab) => navigate(`/stores/${tab}`);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState('review');
  const [chosenMethod, setChosenMethod] = useState(null);
  const [purchaseQuote, setPurchaseQuote] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [bankForm, setBankForm] = useState({ bankReference: '', notes: '', storeName: '' });
  const [bankFile, setBankFile] = useState(null);
  const bankFileRef = useRef(null);
  const paypalContainerRef = useRef(null);
  const editingStoreIdRef = useRef('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [startCreateLoading, setStartCreateLoading] = useState(false);

  const storeIdStr = (store) => {
    const raw = store?._id ?? store?.id;
    if (raw == null || raw === '') return '';
    if (typeof raw === 'object') {
      if (raw._id != null) return String(raw._id);
      if (typeof raw.toString === 'function') {
        const s = raw.toString();
        if (/^[a-f0-9]{24}$/i.test(s)) return s;
      }
      return '';
    }
    return String(raw);
  };

  const buildEditFormFromStore = (store) => {
    const parsed = parsePhoneForField(store.phone, DEFAULT_COUNTRY_CODE);
    setEditPhoneCountryIso(parsed.countryIso);
    setEditPhoneNationalDigits(parsed.nationalDigits);
    const addr = store.address || {};
    const addressObj = typeof addr === 'string'
      ? { street1: addr, street2: '', city: '', state: '', postalCode: '', country: '' }
      : {
          street1: addr.street1 || '',
          street2: addr.street2 || '',
          city: addr.city || '',
          state: addr.state || '',
          postalCode: addr.postalCode || '',
          country: addr.country || '',
        };
    return {
      name: store.name || '',
      address: addressObj,
      paymentMethods: store.paymentMethods?.length ? [...store.paymentMethods] : ['cash'],
      isActive: store.isActive !== false,
      posMenuLayout: store.posMenuLayout || 'default',
    };
  };

  const closeEditDrawer = () => {
    editingStoreIdRef.current = '';
    setEditingStoreId('');
    setEditingStore(null);
    setEditPhoneCountryIso(DEFAULT_COUNTRY_CODE);
    setEditPhoneNationalDigits('');
    setError('');
  };

  const openEdit = async (storeOrId) => {
    const id = typeof storeOrId === 'string' ? storeOrId.trim() : storeIdStr(storeOrId);
    if (!id) return;
    editingStoreIdRef.current = id;
    setEditingStoreId(id);
    setError('');

    const fromList = stores.find((s) => storeIdStr(s) === id);
    if (fromList) {
      setEditingStore({ ...fromList, _id: id });
      setEditForm(buildEditFormFromStore(fromList));
      setEditMeta({ deactivatedBySuperadmin: Boolean(fromList.deactivatedBySuperadmin) });
      return;
    }

    try {
      const { data } = await api.get(`/stores/${id}`);
      setEditingStore({ ...data, _id: id });
      setEditForm(buildEditFormFromStore(data));
      setEditMeta({ deactivatedBySuperadmin: Boolean(data.deactivatedBySuperadmin) });
    } catch (err) {
      closeEditDrawer();
      setError(err.response?.data?.message || 'Could not load store');
    }
  };

  const { data: storeList = { items: [], page: 1, pages: 1, total: 0 }, isLoading, isFetching } = useQuery({
    queryKey: ['admin-stores', tenantIdOverride, storePage, search, statusFilter, paymentMethodsFilter, sortParams],
    queryFn: async () => {
      const params = { page: storePage, limit: 20, sort, order };
      if (tenantIdOverride) params.tenantId = tenantIdOverride;
      if (search.trim()) params.search = search.trim();
      if (statusFilter && statusFilter.length > 0) {
        params.status = statusFilter.join(',');
      } else {
        // If status filter is cleared, we filter for none
        params.status = 'none';
      }
      if (paymentMethodsFilter && paymentMethodsFilter.length > 0) {
        params.paymentMethods = paymentMethodsFilter.join(',');
      } else {
        // If payment method filter is cleared, filter for none
        params.paymentMethods = 'none';
      }
      const { data } = await api.get('/stores', { params });
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

  const { data: pendingStoreReceipts = [] } = useQuery({
    queryKey: ['merchant-receipts', 'pending-store'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/receipts', {
        params: { status: 'pending', kind: 'store', limit: 50 },
      });
      return unwrapPagedList(data).items;
    },
    enabled: isMerchantAdmin && !workspaceMode,
  });

  const createStoreSuper = useMutation({
    mutationFn: (payload) => api.post('/stores', tenantIdOverride ? { ...payload, tenantId: tenantIdOverride } : payload),
    onSuccess: () => {
      setForm({
        name: '',
        address: {
          street1: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        phone: '',
        paymentMethods: ['cash'],
      });
      setError('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create store'),
  });

  const createIncludedStore = useMutation({
    mutationFn: () => api.post('/stores/create-included').then((r) => r.data),
    onSuccess: (created) => {
      toast.success(`Store ${created?.code || ''} created. Edit name and settings below.`);
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      closePurchase();
      if (created) openEdit(storeIdStr(created));
    },
    onError: (err) => setPurchaseError(err.response?.data?.message || 'Failed to create store'),
  });

  const bankReceiptMutation = useMutation({
    mutationFn: (fd) => api.post('/subscriptions/receipts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Receipt submitted. Your store will be created after verification.');
      closePurchase();
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
    },
    onError: (err) => setPurchaseError(err.response?.data?.message || 'Upload failed'),
  });

  const paypalCaptureMutation = useMutation({
    mutationFn: (orderId) => api.post('/subscriptions/checkout/paypal/capture', { orderId }).then((r) => r.data),
    onSuccess: (data) => {
      const createdId = data?.storeId
        ? storeIdStr({ _id: data.storeId })
        : (typeof data?.store === 'object' && data.store ? storeIdStr(data.store) : '');
      if (createdId) {
        toast.success(data.message || 'Store created.');
        queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
        queryClient.invalidateQueries({ queryKey: ['stores'] });
        closePurchase();
        openEdit(createdId);
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
    setBankForm({ bankReference: '', notes: '', storeName: '' });
    setBankFile(null);
  }, []);

  const startCreateStore = async () => {
    setPurchaseError('');
    setStartCreateLoading(true);
    try {
      const { data: quote } = await api.get('/stores/create-quote');
      if (quote.error) {
        setError(quote.error);
        return;
      }
      if (!quote.requiresPayment) {
        createIncludedStore.mutate();
        setStartCreateLoading(false);
        return;
      }
      setPurchaseQuote(quote);
      setPurchaseOpen(true);
      setPurchaseStep('review');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load store pricing');
    } finally {
      setStartCreateLoading(false);
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
    if (bankForm.storeName.trim()) fd.append('storeLocationName', bankForm.storeName.trim());
    fd.append('receipt', bankFile);
    bankReceiptMutation.mutate(fd);
  };

  const updateStore = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/stores/${id}`, payload),
    onSuccess: (_data, { id }) => {
      toast.success('Store saved.');
      closeEditDrawer();
      setEditForm({
        name: '', address: '', paymentMethods: ['cash'], isActive: true,
      });
      setEditMeta({ deactivatedBySuperadmin: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['users-for-store-access'] });
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

  const deleteStore = useMutation({
    mutationFn: (id) => api.delete(`/stores/${id}`, {
      data: tenantIdOverride ? { tenantId: tenantIdOverride } : undefined,
    }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Store deleted.');
      setDeleteTarget(null);
      closeEditDrawer();
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['users-for-store-access'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-receipts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete store');
      setDeleteTarget(null);
    },
  });

  useEffect(() => { setStorePage(1); }, [search, statusFilter, paymentMethodsFilter, sort, order]);

  const onCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Store name is required');
      return;
    }
    createStoreSuper.mutate(form);
  };

  const onEditSave = (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setError('Store name is required');
      return;
    }
    const id = editingStoreId || editingStoreIdRef.current;
    if (!id) {
      setError('Store not found');
      return;
    }
    const phoneErr = validateMobileField(editPhoneCountryIso, editPhoneNationalDigits);
    if (phoneErr) { setError(phoneErr); return; }
    const phone = phoneValueFromField(editPhoneCountryIso, editPhoneNationalDigits);
    updateStore.mutate({
      id,
      payload: {
        ...(tenantIdOverride ? { tenantId: tenantIdOverride } : {}),
        name: editForm.name.trim(),
        address: {
          street1: editForm.address.street1.trim(),
          street2: editForm.address.street2.trim(),
          city: editForm.address.city.trim(),
          state: editForm.address.state.trim(),
          postalCode: editForm.address.postalCode.trim(),
          country: editForm.address.country.trim(),
        },
        phone,
        paymentMethods: [...editForm.paymentMethods],
        isActive: editForm.isActive,
        posMenuLayout: editForm.posMenuLayout,
      },
    });
  };
  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_admin_stores', mode);
  };

  const handleSortChange = (newSort, newOrder) => {
    setSort(newSort);
    setOrder(newOrder);
  };

  const storeUsers = (storeId) => {
    const sid = storeIdStr({ _id: storeId });
    return users.filter(
      (u) => Array.isArray(u.storeIds)
        && u.storeIds.some((s) => storeIdStr({ _id: s }) === sid),
    );
  };

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
        <h2 className="text-xl font-bold text-gray-900">
          {workspaceMode ? `Stores — ${workspaceTitle || 'Merchant'}` : 'Stores'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {workspaceMode
            ? 'Manage branches for this merchant. The default store is marked with a star and cannot be deleted.'
            : isSuperAdmin
              ? 'Create and manage store branches for merchants.'
              : isMerchantAdmin
                ? 'Your first store is included in your plan. Additional locations require payment, then you can edit name and settings.'
                : 'Edit details for stores assigned to your admin account.'}
        </p>
        {isMerchantAdmin && !workspaceMode && (
          <button
            type="button"
            onClick={startCreateStore}
            disabled={startCreateLoading || createIncludedStore.isPending}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover disabled:opacity-60"
          >
            {(startCreateLoading || createIncludedStore.isPending) ? <Loader size={14} className="animate-spin" /> : <Plus size={16} />}
            {startCreateLoading ? 'Checking pricing…' : createIncludedStore.isPending ? 'Creating…' : 'Create store'}
          </button>
        )}
      </div>

      {isSuperAdmin && canCreateStore && !workspaceMode && (
        <form onSubmit={onCreate} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Create store</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Store Name</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={PLACEHOLDERS.storeName}
              maxLength={fieldAttrs('storeName').maxLength} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            
            <div className="md:col-span-2 grid gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
              <span className="block text-xs font-semibold text-gray-700">Address Details</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Street 1</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Street 1" value={form.address.street1} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, street1: e.target.value } }))} maxLength={100} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Street 2 (Optional)</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Street 2" value={form.address.street2} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, street2: e.target.value } }))} maxLength={100} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">City</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" placeholder="City" value={form.address.city} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))} maxLength={50} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">State / Province</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" placeholder="State" value={form.address.state} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, state: e.target.value } }))} maxLength={50} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Postal / Zip Code</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Postal Code" value={form.address.postalCode} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, postalCode: e.target.value } }))} maxLength={20} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Country</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Country" value={form.address.country} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, country: e.target.value } }))} maxLength={50} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Payment Methods (cash required)</label>
              <div className="flex flex-wrap gap-3">
                {['cash', 'card', 'bank_transfer', 'mobile_wallet'].map((m) => (
                  <label key={m} className="text-sm text-gray-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.paymentMethods.includes(m)}
                      disabled={m === 'cash'}
                      onChange={() => setForm((p) => {
                        const has = p.paymentMethods.includes(m);
                        let next = has ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m];
                        if (!next.includes('cash')) next.unshift('cash');
                        return { ...p, paymentMethods: [...new Set(next)] };
                      })}
                    />
                    <span className="capitalize">{m.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold disabled:opacity-60" disabled={createStoreSuper.isPending}>
              {createStoreSuper.isPending ? 'Creating...' : 'Create store'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'active'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Stores ({stores.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending Approval
          {pendingStoreReceipts.length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendingStoreReceipts.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'active' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stores…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MultiSelectDropdown
                  label="Status"
                  options={STATUS_OPTIONS}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                  icon={Filter}
                />
                <MultiSelectDropdown
                  label="Payment Methods"
                  options={PAYMENT_METHOD_OPTIONS}
                  selected={paymentMethodsFilter}
                  onChange={setPaymentMethodsFilter}
                  icon={Filter}
                />
                <SortDropdown
                  sort={sort}
                  order={order}
                  onSortChange={handleSortChange}
                  options={SORT_OPTIONS}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {workspaceMode && isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold"
                >
                  <Plus size={16} /> New store
                </button>
              )}
              <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {viewMode === 'grid' ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stores.map((store) => {
                  const sid = storeIdStr(store);
                  return (
                    <div key={sid || store.code} className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                          {store.isDefault && (
                            <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" aria-label="Default store" title="Default store" />
                          )}
                          {store.name}
                        </p>
                        {store.isActive === false && (
                          <span className="inline-block text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{formatAddress(store.address)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">City: {store.address?.city || '—'} · Phone: {store.phone || '-'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Payments: {Array.isArray(store.paymentMethods) ? store.paymentMethods.map(m => m.replace('_', ' ')).join(', ') : 'cash'}</p>
                      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-150">
                        <button type="button" className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 flex-1" onClick={() => openEdit(sid)}>
                          Edit details
                        </button>
                        {!store.isDefault && (isMerchantAdmin || isSuperAdmin) && (
                          <button type="button" className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(store)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!isLoading && !stores.length && (
                  <div className="col-span-full text-center py-12 text-gray-400">No stores yet</div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3"><SortableTh label="Store Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} /></th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3 text-gray-500 font-semibold select-none">Phone</th>
                      <th className="px-4 py-3"><SortableTh label="Status" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} /></th>
                      <th className="px-4 py-3"><SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} /></th>
                      <th className="px-4 py-3 text-gray-500 font-semibold select-none">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stores.map((store) => {
                      const sid = storeIdStr(store);
                      return (
                        <tr key={sid || store.code} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-1.5">
                            {store.isDefault && (
                              <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" aria-label="Default store" title="Default store" />
                            )}
                            {store.name}
                          </td>
                          <td className="px-4 py-3 text-sm">{store.address?.city || '—'}</td>
                          <td className="px-4 py-3">{store.phone || '-'}</td>
                          <td className="px-4 py-3">
                            {store.isActive === false ? (
                              <span className="text-xs font-medium text-red-600">Inactive</span>
                            ) : (
                              <span className="text-xs font-medium text-green-700">Active</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {store.createdAt ? new Date(store.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="text-xs px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50" onClick={() => openEdit(sid)}>
                                Edit
                              </button>
                              {!store.isDefault && (isMerchantAdmin || isSuperAdmin) && (
                                <button type="button" className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(store)}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Clock className="text-amber-500" size={20} />
            <div>
              <h3 className="font-semibold text-gray-900">Stores Pending Approval</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                These store locations will be automatically initialized once your payment receipt is verified by our team.
              </p>
            </div>
          </div>
          {pendingStoreReceipts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No store requests pending verification.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-gray-50/20">
              {pendingStoreReceipts.map((r) => (
                <div key={r._id} className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm">
                    {r.userLicensePayload?.name ? r.userLicensePayload.name : 'Additional Store Location'}
                  </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Submitted: {new Date(r.createdAt).toLocaleDateString()} at {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Bank Ref: <span className="font-mono text-gray-600">{r.bankReference}</span>
                      {r.notes ? ` · Note: "${r.notes}"` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                      <Clock size={11} /> Pending review
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Store name <span className="text-gray-400">(optional – helps identify this request)</span></label>
                  <input
                    type="text"
                    value={bankForm.storeName}
                    onChange={(e) => setBankForm((f) => ({ ...f, storeName: e.target.value }))}
                    placeholder="e.g. Colombo City Branch"
                    maxLength={100}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <BillingQuotePanel
                  recurringRates={purchaseQuote.recurringRates}
                  proration={purchaseQuote.proration}
                  amountDue={purchaseQuote.priced?.amount}
                  currency={purchaseQuote.priced?.currency}
                  fullCycle={purchaseQuote.fullCycle}
                  merchantSymbol={merchantSymbol}
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
                <BillingQuotePanel
                  recurringRates={purchaseQuote.recurringRates}
                  proration={purchaseQuote.proration}
                  amountDue={purchaseQuote.priced?.amount}
                  currency={purchaseQuote.priced?.currency}
                  fullCycle={purchaseQuote.fullCycle}
                  merchantSymbol={merchantSymbol}
                />
                {!paypalReady ? <p className="text-xs text-gray-500">Loading PayPal…</p> : null}
                <div ref={paypalContainerRef} className="min-h-[44px]" />
                <button type="button" onClick={() => setPurchaseStep('method')} className="text-sm text-gray-600 flex items-center gap-1">
                  <ArrowLeft size={14} /> Change method
                </button>
              </div>
            )}
            {purchaseStep === 'pay' && chosenMethod === 'bank_transfer' && paymentOptions?.bankAccounts?.length > 0 && (
              <div className="space-y-4">
                <BillingQuotePanel
                  recurringRates={purchaseQuote.recurringRates}
                  proration={purchaseQuote.proration}
                  amountDue={purchaseQuote.priced?.amount}
                  currency={purchaseQuote.priced?.currency}
                  fullCycle={purchaseQuote.fullCycle}
                  merchantSymbol={merchantSymbol}
                />
                <div className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="font-medium">Transfer exactly {formatMoney(purchaseQuote.priced.currency, purchaseQuote.priced.amount, merchantSymbol)} to:</p>
                  {paymentOptions.bankAccounts.map((b) => (
                    <div key={b._id} className="mt-2">
                      <p className="font-medium">{b.bankName}</p>
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

      {editingStoreId && editingStore && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={closeEditDrawer}
            aria-hidden="true"
          />
          <aside
            key={editingStoreId}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Edit Store</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingStore.name}
                  {editingStore.address?.city ? ` · ${editingStore.address.city}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditDrawer}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              >
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
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <span className="block text-xs font-semibold text-gray-700">Address Details</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Street 1</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" placeholder="Street 1" value={editForm.address.street1} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, street1: e.target.value } }))} maxLength={100} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Street 2 (Optional)</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" placeholder="Street 2" value={editForm.address.street2} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, street2: e.target.value } }))} maxLength={100} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">City</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" placeholder="City" value={editForm.address.city} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))} maxLength={50} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">State / Province</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" placeholder="State" value={editForm.address.state} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, state: e.target.value } }))} maxLength={50} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Postal / Zip Code</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" placeholder="Postal Code" value={editForm.address.postalCode} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, postalCode: e.target.value } }))} maxLength={20} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Country</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange" placeholder="Country" value={editForm.address.country} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, country: e.target.value } }))} maxLength={50} />
                  </div>
                </div>
              </div>
              <MobilePhoneField
                countryIso={editPhoneCountryIso}
                nationalDigits={editPhoneNationalDigits}
                onCountryIsoChange={(iso) => setEditPhoneCountryIso(iso)}
                onNationalDigitsChange={(d) => setEditPhoneNationalDigits(d)}
                label="Phone"
              />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">POS Cashier Screen Layout</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'default', label: 'Standard', sub: 'Larger cards, wider cart' },
                    { id: 'compact', label: 'Compact Grid', sub: 'Small squares, 1/3 cart + images' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, posMenuLayout: opt.id }))}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${
                        editForm.posMenuLayout === opt.id
                          ? 'border-brand-orange bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`block text-sm font-medium ${
                        editForm.posMenuLayout === opt.id ? 'text-brand-orange' : 'text-gray-800'
                      }`}>{opt.label}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{opt.sub}</span>
                    </button>
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
                  onClick={closeEditDrawer}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete store permanently?"
        message={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.name}" and all its data. Store subscription charges and user assignments will be removed from your next billing cycle. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete permanently"
        variant="delete"
        isLoading={deleteStore.isPending}
        onConfirm={() => deleteStore.mutate(storeIdStr(deleteTarget))}
        onCancel={() => setDeleteTarget(null)}
      />

      {workspaceMode && (
        <StoreCreateDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSubmit={(f) => createStoreSuper.mutate(f)}
          isPending={createStoreSuper.isPending}
        />
      )}
    </div>
  );
}
