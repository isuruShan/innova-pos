import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Phone, Search, X, CheckCircle, RefreshCw, MessageSquare, AlertCircle,
  Lock, Settings, Eye, HelpCircle, Save, ArrowRight, ShoppingBag, List, LayoutGrid
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { formatMoney } from '../../components/billing/ProrationBreakdown';
import { useTenantCurrency } from '../../context/TenantCurrencyContext';

export default function WhatsAppConfigPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { currencySymbol: merchantSymbol } = useTenantCurrency();
  const { stores, selectedStoreId, selectStore } = useStoreContext();

  const [search, setSearch] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

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

  useEffect(() => {
    if (selectedStore?.whatsappSettings) {
      setPhoneId(selectedStore.whatsappSettings.phoneNumberId || '');
      setAccessToken(selectedStore.whatsappSettings.accessToken || '');
      setCatalogId(selectedStore.whatsappSettings.catalogId || '');
    } else {
      setPhoneId('');
      setAccessToken('');
      setCatalogId('');
    }
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stores'] });
      toast.success('WhatsApp credentials updated successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save settings');
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

  const handleSaveSettings = (e) => {
    e.preventDefault();
    saveSettingsMutation.mutate({
      phoneNumberId: phoneId.trim(),
      accessToken: accessToken.trim(),
      catalogId: catalogId.trim(),
    });
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
        {/* Left column: credentials setup */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 mb-4">
              <Settings size={17} className="text-gray-500" />
              API Settings
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="e.g. 10484738592"
                  className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-teal focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Catalog ID</label>
                <input
                  type="text"
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                  placeholder="e.g. 847385928174"
                  className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-teal focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Access Token</label>
                <textarea
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAGz..."
                  rows={4}
                  className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-teal focus:bg-white font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                className="w-full py-2 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Save size={14} />
                Save API Credentials
              </button>
            </form>
          </div>

          {/* Webhook details panel */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-xs text-gray-700 flex items-center gap-1.5">
              <HelpCircle size={15} />
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
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/40' : 'text-gray-400 hover:text-gray-900'}`}
                  >
                    <List size={12} /> Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
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
    </div>
  );
}
