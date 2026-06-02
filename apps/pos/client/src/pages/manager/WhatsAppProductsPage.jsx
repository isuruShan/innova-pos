import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, Search, X, CheckCircle, RefreshCw, MessageSquare, AlertCircle, ShoppingBag, Calendar, Lock } from 'lucide-react';
import { adminPath } from '@innovapos/app-urls';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import ResponsiveTable from '../../components/ResponsiveTable';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useToast } from '../../hooks/useToast';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
import { formatCurrency, getItemDisplayPrice } from '../../utils/format';

export default function WhatsAppProductsPage() {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: paidAddons, isPending: addonsPending } = useTenantPaidAddons();
  const whatsappAddonActive = paidAddons?.whatsapp === true;

  const { data: items = [], isPending: menuPending } = useQuery({
    queryKey: ['menu', 'whatsapp-catalog'],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: whatsappAddonActive,
  });

  const toggleSyncMutation = useMutation({
    mutationFn: ({ id, featured }) => api.put(`/menu/${id}`, { 'whatsappSync.featured': featured }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      showToast('Catalog preference updated successfully', { type: 'success' });
    },
    onError: () => {
      showToast('Failed to update catalog sync preference', { type: 'error' });
    }
  });

  const filtered = useMemo(() => {
    return items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, search]);

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

  // --- Premium Gating Screen ---
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

  // --- Active Premium Page ---
  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)] flex flex-col">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
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

        {/* Search Bar */}
        <div className="bg-[var(--pos-panel)] p-4 rounded-xl border border-slate-700/60 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
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
        </div>

        {/* Catalog Table */}
        <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/60 overflow-hidden shadow-lg">
          {menuPending ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-amber-500 w-6 h-6" />
              <p className="text-sm">Loading catalog items…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <AlertCircle className="mx-auto mb-2 text-slate-650" size={32} />
              <p className="text-sm">No items found</p>
            </div>
          ) : (
            <ResponsiveTable
              rows={filtered}
              rowKey={(i) => i._id}
              columns={[
                {
                  key: 'name',
                  header: 'Product Name',
                  render: (item) => (
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200">{item.name}</span>
                      <span className="text-[10px] text-slate-500">{item.category}</span>
                    </div>
                  )
                },
                {
                  key: 'price',
                  header: 'Base Price',
                  render: (item) => (
                    <span className="text-slate-300 font-mono text-sm">
                      {formatCurrency(getItemDisplayPrice(item))}
                    </span>
                  )
                },
                {
                  key: 'whatsappFeatured',
                  header: 'WhatsApp Visibility',
                  render: (item) => {
                    const isFeatured = item.whatsappSync?.featured !== false;
                    return (
                      <button
                        type="button"
                        onClick={() => toggleSyncMutation.mutate({ id: item._id, featured: !isFeatured })}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                          isFeatured
                            ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/15'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        {isFeatured ? 'Featured' : 'Excluded'}
                      </button>
                    );
                  }
                },
                {
                  key: 'syncStatus',
                  header: 'Catalog Sync Status',
                  render: (item) => {
                    const lastSynced = item.whatsappSync?.lastSyncedAt;
                    return (
                      <div className="flex flex-col text-[11px]">
                        <span className={item.whatsappSync?.whatsappProductId ? "text-green-500 font-medium" : "text-slate-500"}>
                          {item.whatsappSync?.whatsappProductId ? "Synced to Meta Catalog" : "Unsynced"}
                        </span>
                        {lastSynced && (
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            Last synced: {new Date(lastSynced).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    );
                  }
                }
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
