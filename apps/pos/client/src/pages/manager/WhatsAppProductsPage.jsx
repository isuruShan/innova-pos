import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Search, X, CheckCircle, RefreshCw, MessageSquare, AlertCircle, ShoppingBag,
  Calendar, Lock, List, LayoutGrid, ShieldCheck
} from 'lucide-react';
import { adminPath } from '@innovapos/app-urls';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SortableTh from '../../components/SortableTh';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useToast } from '../../hooks/useToast';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, getItemDisplayPrice } from '../../utils/format';

export default function WhatsAppProductsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState('table');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // 1. Fetch active addons to verify subscription status
  const { data: paidAddons, isPending: addonsPending } = useTenantPaidAddons();
  const whatsappAddonActive = paidAddons?.whatsapp === true;

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
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then((r) => r.data),
    enabled: whatsappAddonActive && isStoreReady,
  });

  // 4. Mutation to toggle catalog sync preference on items
  const toggleSyncMutation = useMutation({
    mutationFn: ({ id, featured }) =>
      api.put(`/menu/${id}`, { 'whatsappSync.featured': featured }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu', selectedStoreId] });
      showToast('Catalog preference updated successfully', { type: 'success' });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to update item preference', { type: 'error' });
    },
  });

  // 5. Category Tabs Calculation
  const categories = useMemo(() => {
    const list = new Set(items.map((i) => i.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [items]);

  // 6. Filter & Search Logic
  const filtered = useMemo(() => {
    return items.filter((i) => {
      const matchSearch =
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.category || '').toLowerCase().includes(search.toLowerCase());
      const matchCategory = activeCategory === 'All' || i.category === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [items, search, activeCategory]);

  // 7. Sort Logic
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'price') {
        valA = getItemDisplayPrice(a).price;
        valB = getItemDisplayPrice(b).price;
      } else if (sortBy === 'syncStatus') {
        valA = a.whatsappSync?.whatsappProductId ? 1 : 0;
        valB = b.whatsappSync?.whatsappProductId ? 1 : 0;
      } else if (sortBy === 'whatsappFeatured') {
        valA = a.whatsappSync?.featured !== false ? 1 : 0;
        valB = b.whatsappSync?.featured !== false ? 1 : 0;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  if (addonsPending) {
    return (
      <div className="min-h-screen bg-[var(--pos-page-bg)] flex flex-col">
        <Navbar groups={MANAGER_NAV_GROUPS} />
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="animate-spin text-amber-500 w-8 h-8" />
        </div>
      </div>
    );
  }

  // --- Gate 1: Paid Premium Add-on Lock Screen ---
  if (!whatsappAddonActive) {
    const subscribeUrl = adminPath('/addons?code=whatsapp_integration');

    return (
      <div className="min-h-screen bg-[var(--pos-page-bg)] flex flex-col">
        <Navbar groups={MANAGER_NAV_GROUPS} />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-[var(--pos-panel)] rounded-2xl border border-slate-700 p-8 md:p-12 overflow-hidden shadow-2xl">
            {/* Glowing background circles representing WhatsApp theme */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              {/* Animated Lock + Icon container */}
              <div className="relative w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center justify-center text-green-400 shadow-inner">
                <Lock className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 border border-slate-700 text-amber-400 p-1.5 rounded-full" />
                <Phone className="w-10 h-10 animate-pulse" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-green-400 bg-green-500/15 px-3 py-1 rounded-full border border-green-500/25">
                  Paid Premium Add-on
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--pos-text-primary)] mt-3">
                  WhatsApp Business Integration
                </h1>
                <p className="text-sm text-slate-400 max-w-lg mt-2 mx-auto leading-relaxed">
                  Unlock conversational checkout, instant menu synchronization, automated shipping status alerts, and scheduled order logic directly inside WhatsApp.
                </p>
              </div>

              {/* Grid of features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left bg-slate-950/40 p-5 rounded-xl border border-slate-800">
                <div className="flex gap-2">
                  <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Catalog Synchronization</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Publish your menu to Meta's Catalog dynamically.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ShoppingBag className="text-green-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Conversational Checkout</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Let guests customize carts and place orders inside chats.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Calendar className="text-green-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Order Scheduling</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Support delayed delivery/takeaway order slots automatically.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <MessageSquare className="text-green-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Instant Status Notifications</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Alert customers instantly when order changes to preparing or ready.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <a
                  href={subscribeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-green-500/20 text-sm"
                >
                  Subscribe in Admin
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Gate 2: Setup/Meta Connection Required ---
  if (isStoreReady && !hasCredentials) {
    const adminConfigUrl = adminPath('/whatsapp-config');

    return (
      <div className="min-h-screen bg-[var(--pos-page-bg)] flex flex-col">
        <Navbar groups={MANAGER_NAV_GROUPS} />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--pos-panel)] rounded-2xl border border-slate-700 p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-500">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[var(--pos-text-primary)]">WhatsApp Account Not Connected</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your store <strong>{selectedStore?.name || 'Main Store'}</strong> has not been linked to a WhatsApp Business Account yet.
              </p>
              <p className="text-xs text-slate-500">
                To start syncing your menu catalog and receiving orders, please complete the Meta Embedded Sign-up flow in the Admin Portal.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={adminConfigUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold transition shadow-lg shadow-amber-500/10"
              >
                <span>Go to WhatsApp Settings in Admin</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Active Premium Page ---
  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)] flex flex-col">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--pos-text-primary)] flex items-center gap-2">
              <Phone className="text-green-500" size={24} /> WhatsApp Catalog Products
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select which products appear in your customers' WhatsApp Catalog in real time.
            </p>
          </div>
        </div>

        {/* Search + View Toggle */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--pos-panel)] p-3 rounded-xl border border-slate-700">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or category…"
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg pl-10 pr-8 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-550"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg p-0.5 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'table' ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={14} /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'grid' ? 'bg-amber-500 text-[var(--pos-selection-text)]' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>
        </div>

        {/* Sticky Category Tabs */}
        {categories.length > 1 && (
          <div className="sticky top-[64px] z-20 bg-[var(--pos-page-bg)] py-3 border-b border-slate-700 mb-5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    activeCategory === cat
                      ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow-lg shadow-amber-500/20'
                      : 'text-slate-450 hover:text-[var(--pos-text-primary)] bg-[var(--pos-panel)] hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Catalog Table / Grid Content */}
        {menuPending ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
            <RefreshCw className="animate-spin text-amber-500 w-6 h-6" />
            <p className="text-sm">Loading catalog items…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
            <AlertCircle className="mx-auto mb-2 text-slate-650" size={32} />
            <p className="text-sm">No items found</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/60 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-[var(--pos-panel)]">
                    <SortableTh label="Product Name" field="name" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <SortableTh label="Category" field="category" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <SortableTh label="Base Price" field="price" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} align="right" />
                    <SortableTh label="WhatsApp Visibility" field="whatsappFeatured" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} align="center" />
                    <SortableTh label="Catalog Sync Status" field="syncStatus" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sorted.map((item) => {
                    const isFeatured = item.whatsappSync?.featured !== false;
                    const lastSynced = item.whatsappSync?.lastSyncedAt;
                    return (
                      <tr key={item._id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{item.category}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-amber-400 font-semibold font-mono text-sm">
                            {(() => {
                              const { price, prefix } = getItemDisplayPrice(item);
                              return (
                                <>
                                  {prefix && <span className="text-slate-500 font-normal text-[10px]">{prefix}</span>}
                                  {formatCurrency(price)}
                                </>
                              );
                            })()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSyncMutation.mutate({ id: item._id, featured: !isFeatured })}
                            disabled={toggleSyncMutation.isPending}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                              isFeatured
                                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/15'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                            }`}
                          >
                            {isFeatured ? 'Featured' : 'Excluded'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col text-[11px] items-end">
                            <span className={item.whatsappSync?.whatsappProductId ? "text-green-500 font-medium" : "text-slate-550"}>
                              {item.whatsappSync?.whatsappProductId ? "Synced to Meta Catalog" : "Unsynced"}
                            </span>
                            {lastSynced && (
                              <span className="text-[10px] text-slate-500 mt-0.5">
                                Last synced: {new Date(lastSynced).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {sorted.map((item) => {
              const isFeatured = item.whatsappSync?.featured !== false;
              const lastSynced = item.whatsappSync?.lastSyncedAt;
              return (
                <div
                  key={item._id}
                  className={`bg-[var(--pos-panel)] rounded-xl border p-4 transition-all flex flex-col justify-between ${
                    isFeatured
                      ? 'border-green-500/30 shadow-sm shadow-green-500/5'
                      : 'border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] uppercase font-semibold border border-slate-700">
                        {item.category}
                      </span>
                      {lastSynced && (
                        <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                          <CheckCircle size={10} className="text-green-500 animate-pulse" />
                          Synced
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-[var(--pos-text-primary)] text-sm leading-snug">{item.name}</h4>
                      <p className="text-xs text-amber-400 font-medium mt-1 font-mono">
                        {(() => {
                          const { price, prefix } = getItemDisplayPrice(item);
                          return (
                            <>
                              {prefix && <span className="text-slate-550 font-normal text-[9px]">{prefix}</span>}
                              {formatCurrency(price)}
                            </>
                          );
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 mt-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">
                      {lastSynced ? `Updated: ${new Date(lastSynced).toLocaleDateString()}` : 'Never synced'}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleSyncMutation.mutate({ id: item._id, featured: !isFeatured })}
                      disabled={toggleSyncMutation.isPending}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        isFeatured
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/15'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {isFeatured ? 'Featured ✓' : 'Excluded'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
