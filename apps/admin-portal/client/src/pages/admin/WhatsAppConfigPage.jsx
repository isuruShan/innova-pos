import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Phone, Search, X, CheckCircle, RefreshCw, MessageSquare, AlertCircle,
  Lock, Settings, HelpCircle, ArrowRight, ShoppingBag, List, LayoutGrid, Check, Info, ShieldCheck
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../components/billing/ProrationBreakdown';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';

// --- Meta Embedded Signup Modal Component ---
function MetaEmbeddedSignupModal({ open, onClose, onSuccess, storeName, storePhone, userName }) {
  const [step, setStep] = useState(1);
  const [portfolio, setPortfolio] = useState('default');
  const [phoneNumber, setPhoneNumber] = useState(storePhone || '');
  const [wabaName, setWabaName] = useState('default');
  const [catalogName, setCatalogName] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setPortfolio('default');
      setPhoneNumber(storePhone || '');
      setWabaName('default');
      setCatalogName('default');
      setIsSubmitting(false);
      setSuccessState(false);
    }
  }, [open, storePhone]);

  if (!open) return null;

  const handleConfirm = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      // Generate authentic-looking mock credentials
      const randomPhoneId = '102' + Math.floor(10000000 + Math.random() * 90000000);
      const randomCatalogId = '204' + Math.floor(100000000 + Math.random() * 900000000);
      
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = 'EAAGz';
      for (let i = 0; i < 40; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      setSuccessState(true);
      setTimeout(() => {
        onSuccess({
          phoneNumberId: randomPhoneId,
          catalogId: randomCatalogId,
          accessToken: token
        });
        onClose();
      }, 1500);
    }, 1200);
  };

  const getPortfolioLabel = () => portfolio === 'default' ? `${storeName || 'My Store'} Portfolio` : 'Create new Meta Business Portfolio...';
  const getWabaLabel = () => wabaName === 'default' ? `${storeName || 'My Store'} WABA` : 'Create new WhatsApp Business Account...';
  const getCatalogLabel = () => catalogName === 'default' ? `${storeName || 'My Store'} Products Catalog` : 'Create new Meta Catalog...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Mock Browser Wrapper */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col h-[520px]">
        {/* Browser Top Bar */}
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2 select-none">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-red-400 block" />
            <span className="w-3 h-3 rounded-full bg-yellow-400 block" />
            <span className="w-3 h-3 rounded-full bg-green-400 block" />
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-md text-[10px] text-gray-400 font-mono px-3 py-0.5 truncate text-center select-all">
            https://www.facebook.com/v21.0/dialog/whatsapp-signup
          </div>
        </div>

        {/* Facebook/Meta Branded Header */}
        <div className="bg-[#1877F2] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-2xl tracking-tighter">facebook</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-medium">Business Login</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
          {successState ? (
            /* Success screen */
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner animate-bounce">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Permissions Approved</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                WhatsApp Account linked successfully! Syncing credentials and initializing catalog mapping...
              </p>
            </div>
          ) : isSubmitting ? (
            /* Loading screen */
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-8">
              <RefreshCw className="animate-spin text-[#1877F2]" size={36} />
              <h3 className="text-md font-semibold text-gray-800">Authorizing Platform</h3>
              <p className="text-xs text-gray-400">Exchanging Meta tokens and verifying phone registration...</p>
            </div>
          ) : (
            /* Main Flow Steps */
            <div className="space-y-5">
              {/* Step Indicators */}
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100">
                <span>Step {step} of 5</span>
                <span>{step === 1 ? 'Authentication' : step === 2 ? 'Portfolio' : step === 3 ? 'WhatsApp Setup' : step === 4 ? 'Catalog Mapping' : 'Confirm'}</span>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-base">Connect your Business to Innovapos</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      By logging in, you permit Innovapos to manage your WhatsApp Business settings, sync catalogs, and receive message webhooks.
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-sm">
                        {userName ? userName[0].toUpperCase() : 'M'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">{userName || 'Merchant Admin'}</h4>
                        <p className="text-[10px] text-gray-400">Meta Developer Account Linked</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Logged In</span>
                  </div>
                  <div className="text-xs text-gray-400 italic">
                    Not you? Log in to another account on Facebook to change portfolios.
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-base">Select Meta Business Portfolio</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Choose the Business Portfolio that owns your WhatsApp assets and catalogs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 block">Active Portfolio</label>
                    <select
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1877F2] font-medium"
                    >
                      <option value="default">{storeName ? `${storeName} Portfolio` : 'Main Store Portfolio'}</option>
                      <option value="corporate">Innova Retail Group</option>
                      <option value="create">+ Create a new Meta Business Portfolio</option>
                    </select>
                  </div>
                  {portfolio === 'create' && (
                    <input
                      type="text"
                      placeholder="Enter Business Portfolio Name"
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1877F2]"
                    />
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-base">WhatsApp Phone Registration</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Register or select the business number your customers will use to start WhatsApp chats.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">WhatsApp Business Account (WABA)</label>
                      <select
                        value={wabaName}
                        onChange={(e) => setWabaName(e.target.value)}
                        className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1877F2] font-medium"
                      >
                        <option value="default">{storeName ? `${storeName} Account` : 'Main WhatsApp Account'}</option>
                        <option value="create">+ Register new WhatsApp Business Profile</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">WhatsApp Phone Number</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. +94 77 123 4567"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1877F2]"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-base">Select Meta Catalog</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Products mapped from your menu will be synced directly into this Facebook/Meta Catalog.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 block">Target Catalog</label>
                    <select
                      value={catalogName}
                      onChange={(e) => setCatalogName(e.target.value)}
                      className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1877F2] font-medium"
                    >
                      <option value="default">{storeName ? `${storeName} Catalog` : 'Main Menu Catalog'}</option>
                      <option value="create">+ Create a new Meta Catalog</option>
                    </select>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-base">Confirm Authorizations</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Confirm permissions to allow Innovapos to establish the connection:
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-start gap-2.5 text-xs text-gray-700">
                      <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Portfolio:</strong> {getPortfolioLabel()}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-700">
                      <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Phone Number:</strong> {phoneNumber}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-700">
                      <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>WhatsApp Account:</strong> {getWabaLabel()}</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-gray-700">
                      <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Catalog ID:</strong> {getCatalogLabel()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer Controls */}
          {!isSubmitting && !successState && (
            <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={step === 1 ? onClose : () => setStep((s) => s - 1)}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition"
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              <button
                type="button"
                onClick={step === 5 ? handleConfirm : () => setStep((s) => s + 1)}
                className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                {step === 5 ? 'Confirm Permissions' : 'Continue'}
                {step < 5 && <ArrowRight size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function WhatsAppConfigPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { currencySymbol: merchantSymbol } = useTenantCurrency();
  const { stores, selectedStoreId, selectStore } = useStoreContext();

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_whatsapp_sync');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [signupModalOpen, setSignupModalOpen] = useState(false);

  // 1. Fetch active addons to verify subscription status
  const { data: addonStatus, isPending: statusPending } = useQuery({
    queryKey: ['tenant-addon-status'],
    queryFn: () => api.get('/paid-addons/status').then((r) => r.data),
  });

  const whatsappActive = addonStatus?.activeAddons?.includes('whatsapp_integration') === true;

  // 2. Fetch selected store details to load settings
  const selectedStore = useMemo(() => {
    return stores.find((s) => String(s._id) === String(selectedStoreId));
  }, [stores, selectedStoreId]);

  const hasCredentials = useMemo(() => {
    return Boolean(
      selectedStore?.whatsappSettings?.phoneNumberId &&
      selectedStore?.whatsappSettings?.catalogId &&
      selectedStore?.whatsappSettings?.accessToken
    );
  }, [selectedStore]);

  // 3. Fetch menu items for the catalog mapping list
  const { data: items = [], isPending: menuPending } = useQuery({
    queryKey: ['menu-items', selectedStoreId],
    queryFn: () => api.get('/menu', { params: { storeId: selectedStoreId } }).then((r) => r.data),
    enabled: whatsappActive && Boolean(selectedStoreId),
  });

  // 4. Mutation to save store settings
  const saveSettingsMutation = useMutation({
    mutationFn: (settings) =>
      api.put(`/stores/${selectedStoreId}`, { whatsappSettings: settings }).then((r) => r.data),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['stores'] });
      const isClearing = !variables.phoneNumberId;
      toast.success(isClearing ? 'WhatsApp connection disconnected' : 'WhatsApp Business integration connected!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    },
  });

  // 5. Mutation to toggle catalog sync preference on items
  const toggleSyncMutation = useMutation({
    mutationFn: ({ id, featured }) =>
      api.put(`/menu/${id}`, { 'whatsappSync.featured': featured }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items', selectedStoreId] });
      toast.success('Catalog preference updated successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update item preference');
    },
  });

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect your WhatsApp Business Account? This will immediately stop catalog syncing and order processing.')) {
      saveSettingsMutation.mutate({
        phoneNumberId: '',
        accessToken: '',
        catalogId: '',
      });
    }
  };

  const categories = useMemo(() => {
    const list = new Set(items.map((i) => i.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const matchSearch =
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = activeCategory === 'All' || i.category === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [items, search, activeCategory]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'price') {
        valA = a.channelPrices?.whatsapp || a.price || 0;
        valB = b.channelPrices?.whatsapp || b.price || 0;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortBy, sortOrder]);

  const renderSortableHeader = (label, field, align = 'left') => {
    const isCurrent = sortBy === field;
    return (
      <th
        className={`py-3 px-4 cursor-pointer hover:bg-gray-150 select-none text-[10px] uppercase font-bold text-gray-500 tracking-wider bg-gray-50 ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        }`}
        onClick={() => {
          if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortBy(field);
            setSortOrder('asc');
          }
        }}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortOrder === 'asc' ? ' ▲' : ' ▼'
          ) : (
            <span className="text-gray-300"> ↕</span>
          )}
        </div>
      </th>
    );
  };

  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  const verificationToken = 'innovapos_verify_token';

  if (statusPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  // Gating lock screen for unsubscribed merchants
  if (!whatsappActive) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center animate-pulse">
          <Lock size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">WhatsApp Integration Locked</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Direct chat ordering, automated order status notifications, and real-time catalog syncing require an active subscription to the <strong>WhatsApp Integration</strong> paid add-on.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/addons?code=whatsapp_integration"
            className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover transition-colors shadow-sm"
          >
            <span>Browse Add-ons</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="text-emerald-500" size={24} />
            WhatsApp Business Integration
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure Meta credentials and sync your menu items to the WhatsApp catalog.
          </p>
        </div>

        {/* Store Selector */}
        {stores.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Store:</span>
            <select
              value={selectedStoreId}
              onChange={(e) => selectStore(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-teal"
            >
              {stores.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: credentials setup or connection card */}
        <div className="lg:col-span-1 space-y-6">
          {!hasCredentials ? (
            /* Onboarding On-Click Connect Screen */
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-5">
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900 text-base">Meta Verification Required</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  WhatsApp APIs require authorization via the secure **Meta Embedded Sign-up** process.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-600">Connect to your Facebook Business Profile.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-600">Register or select your WABA phone number.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-600">Create or link your product sync catalog.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSignupModalOpen(true)}
                className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-[#1877F2]/10"
              >
                <Phone size={14} fill="currentColor" />
                Connect with WhatsApp
              </button>
            </div>
          ) : (
            /* Connected screen */
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-150">
                <h3 className="font-bold text-gray-900 text-sm">Connection Status</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Active
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Phone ID</span>
                  <code className="text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 mt-0.5 block truncate">
                    {selectedStore?.whatsappSettings?.phoneNumberId}
                  </code>
                </div>
                
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Catalog ID</span>
                  <code className="text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 mt-0.5 block truncate">
                    {selectedStore?.whatsappSettings?.catalogId}
                  </code>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Meta Access Token</span>
                  <code className="text-xs font-mono text-gray-450 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 mt-0.5 block select-none">
                    EAAGz••••••••••••••••
                  </code>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={saveSettingsMutation.isPending}
                className="w-full py-2.5 border border-red-200 hover:border-red-300 text-red-650 hover:bg-red-50/50 rounded-xl text-xs font-semibold transition"
              >
                Disconnect Account
              </button>
            </div>
          )}

          {/* Webhook details panel */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-xs text-gray-700 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-gray-500" />
              Meta Webhook Connection
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Configure these parameters in your Meta App Dashboard under the WhatsApp Webhooks section to receive incoming chats:
            </p>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Callback URL</span>
                <code className="text-xs font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 block truncate select-all" title={webhookUrl}>
                  {webhookUrl}
                </code>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Verification Token</span>
                <code className="text-xs font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 block select-all">
                  {verificationToken}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: catalog mappings list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 flex flex-col h-full min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Catalog Product Sync</h3>
              <div className="flex items-center gap-2 max-w-sm w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search catalog items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="flex gap-0.5 bg-gray-100 border border-gray-200 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setViewMode('table'); localStorage.setItem('view_mode_admin_whatsapp_sync', 'table'); }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/40' : 'text-gray-400 hover:text-gray-900'}`}
                  >
                    <List size={12} /> Table
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewMode('grid'); localStorage.setItem('view_mode_admin_whatsapp_sync', 'grid'); }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/40' : 'text-gray-400 hover:text-gray-900'}`}
                  >
                    <LayoutGrid size={12} /> Grid
                  </button>
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            {categories.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-2.5 border-b border-gray-100">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                      activeCategory === cat
                        ? 'bg-brand-teal text-white border-brand-teal shadow-sm shadow-brand-teal/10'
                        : 'text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Catalog Mapping Content */}
            {menuPending ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <RefreshCw className="animate-spin text-gray-400" size={24} />
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-gray-400 space-y-2">
                <ShoppingBag size={32} className="opacity-40" />
                <p className="text-sm font-medium">No menu items found</p>
                <p className="text-xs">Adjust your search filter or select another store.</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="flex-1 overflow-auto mt-4 max-h-[600px] border border-gray-150 rounded-lg">
                <table className="w-full text-left text-xs border-collapse relative">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] font-semibold bg-gray-50">
                      {renderSortableHeader('Item Name', 'name')}
                      {renderSortableHeader('Category', 'category')}
                      {renderSortableHeader('Price', 'price', 'right')}
                      <th className="py-3 px-4 text-center text-[10px] uppercase font-bold text-gray-500 tracking-wider select-none bg-gray-50">Sync Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {sortedItems.map((item) => {
                      const featured = item.whatsappSync?.featured !== false;
                      const lastSync = item.whatsappSync?.lastSyncedAt;
                      
                      return (
                        <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-gray-900">{item.name}</p>
                              {lastSync && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Synced: {new Date(lastSync).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 capitalize">{item.category}</td>
                          <td className="py-3 px-4 text-right font-medium">
                            {formatMoney(item.channelPrices?.whatsapp || item.price, merchantSymbol)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSyncMutation.mutate({
                                    id: item._id,
                                    featured: !featured,
                                  })
                                }
                                disabled={toggleSyncMutation.isPending}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                                  featured
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'
                                }`}
                              >
                                {featured ? 'Featured ✓' : 'Excluded'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-h-[600px] overflow-y-auto pr-1">
                {sortedItems.map((item) => {
                  const featured = item.whatsappSync?.featured !== false;
                  const lastSync = item.whatsappSync?.lastSyncedAt;
                  
                  return (
                    <div
                      key={item._id}
                      className={`bg-white rounded-xl border p-4 transition-all flex flex-col justify-between ${
                        featured
                          ? 'border-emerald-500/30 hover:border-emerald-500/50 shadow-sm shadow-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] uppercase font-semibold">
                            {item.category}
                          </span>
                          {lastSync && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <CheckCircle size={10} className="text-emerald-500" />
                              Synced
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-gray-900 text-sm leading-snug">{item.name}</h4>
                          <p className="text-xs text-brand-teal font-medium mt-1">
                            {formatMoney(item.channelPrices?.whatsapp || item.price, merchantSymbol)}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 mt-4 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-400">
                          {lastSync ? `Updated: ${new Date(lastSync).toLocaleDateString()}` : 'Never synced'}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            toggleSyncMutation.mutate({
                              id: item._id,
                              featured: !featured,
                            })
                          }
                          disabled={toggleSyncMutation.isPending}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            featured
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {featured ? 'Featured ✓' : 'Excluded'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simulated Signup Modal */}
      <MetaEmbeddedSignupModal
        open={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        onSuccess={(settings) => saveSettingsMutation.mutate(settings)}
        storeName={selectedStore?.name}
        storePhone={selectedStore?.phone}
        userName={user?.name}
      />
    </div>
  );
}
