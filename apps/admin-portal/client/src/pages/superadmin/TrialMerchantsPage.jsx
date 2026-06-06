import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Info, Phone, Mail, User, ShieldAlert, ArrowLeft, RefreshCw, Layers, Users, ShoppingBag, LayoutGrid, Calendar } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';

export default function TrialMerchantsPage() {
  const [search, setSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [selectedMerchant, setSelectedMerchant] = useState(null); // Contact info modal
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_superadmin_trial_merchants');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const { data: merchants = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['superadmin-trial-merchants'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/superadmin/trial-merchants');
      return data;
    },
  });

  // Client-side search and score filtering
  const filteredMerchants = merchants.filter((m) => {
    const matchesSearch = m.tenant.businessName.toLowerCase().includes(search.toLowerCase());
    
    let matchesScore = true;
    if (scoreFilter === 'high') matchesScore = m.score >= 60;
    else if (scoreFilter === 'medium') matchesScore = m.score >= 30 && m.score < 60;
    else if (scoreFilter === 'low') matchesScore = m.score < 30;

    return matchesSearch && matchesScore;
  });

  const getScoreBadgeClass = (score) => {
    if (score >= 60) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 30) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getScoreLabel = (score) => {
    if (score >= 60) return 'High';
    if (score >= 30) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Trial Conversion Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Identify highly engaged trialing merchants and contact them for plan conversions.</p>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants by business name..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_superadmin_trial_merchants', m); }} />
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none w-full sm:w-48 bg-white cursor-pointer"
          >
            <option value="all">All Conversion Scores</option>
            <option value="high">High Likelihood (&gt;=60)</option>
            <option value="medium">Medium Likelihood (30-59)</option>
            <option value="low">Low Likelihood (&lt;30)</option>
          </select>

          <button
            onClick={() => refetch()}
            className="flex items-center justify-center p-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 min-h-[40px] shrink-0"
            title="Refresh Scoreboard"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading conversion metrics...
        </div>
      ) : !filteredMerchants.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <ShieldAlert size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No trialing merchants found matching your filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredMerchants.map((m) => (
            <div key={m.tenant._id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{m.tenant.businessName}</h3>
                    <span className="text-xs text-gray-400 font-mono mt-0.5 block">ID: {m.tenant._id}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border uppercase tracking-wider shrink-0 ${getScoreBadgeClass(m.score)}`}>
                    {m.score} · {getScoreLabel(m.score)}
                  </span>
                </div>
                
                <div className="mt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 font-medium text-gray-700">
                    <Calendar size={13} className="text-gray-400" />
                    <span>Trial Ends: {m.tenant.trialEndsAt ? new Date(m.tenant.trialEndsAt).toLocaleDateString('en-GB') : '—'}</span>
                  </div>
                  {m.tenant.trialDaysLeft !== null && (
                    <p className={`font-semibold ${m.tenant.trialDaysLeft <= 3 ? 'text-red-650' : m.tenant.trialDaysLeft <= 7 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {m.tenant.trialDaysLeft} day(s) left
                    </p>
                  )}
                  
                  <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-semibold">Stores</span>
                      <span className="font-bold text-sm text-gray-800 tabular-nums">{m.metrics.stores}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-semibold">Users</span>
                      <span className="font-bold text-sm text-gray-800 tabular-nums">{m.metrics.users}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-semibold">Orders</span>
                      <span className="font-bold text-sm text-gray-800 tabular-nums">{m.metrics.orders}</span>
                    </div>
                  </div>
                  <div className="text-center text-[11px] text-gray-500 mt-2">
                    <span className="font-semibold tabular-nums">{m.metrics.cafeTables}</span> tables · <span className="font-semibold tabular-nums">{m.metrics.floorPlans}</span> layouts
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedMerchant(m)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-brand-orange text-brand-orange hover:bg-brand-orange/5 text-xs font-semibold rounded-lg transition duration-200"
                >
                  <Phone size={13} /> Contact Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Merchant</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Trial Period</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Stores</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Users</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Orders</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Tables / Layouts</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Likelihood Score</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMerchants.map((m) => (
                <tr key={m.tenant._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{m.tenant.businessName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ID: {m.tenant._id}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs text-gray-650">
                      <Calendar size={13} className="text-gray-400" />
                      <span>Ends: {m.tenant.trialEndsAt ? new Date(m.tenant.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    </div>
                    {m.tenant.trialDaysLeft !== null && (
                      <p className={`text-xs mt-0.5 font-semibold ${m.tenant.trialDaysLeft <= 3 ? 'text-red-650' : m.tenant.trialDaysLeft <= 7 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {m.tenant.trialDaysLeft} day(s) left
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800 tabular-nums">
                    {m.metrics.stores}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800 tabular-nums">
                    {m.metrics.users}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800 tabular-nums">
                    {m.metrics.orders}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-800 whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{m.metrics.cafeTables}</span> tables · <span className="font-semibold tabular-nums">{m.metrics.floorPlans}</span> layouts
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border uppercase tracking-wider ${getScoreBadgeClass(m.score)}`}>
                        {m.score} · {getScoreLabel(m.score)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedMerchant(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-orange text-brand-orange hover:bg-brand-orange/5 text-xs font-semibold rounded-lg transition duration-200"
                    >
                      <Phone size={13} /> Contact Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contact Details Modal */}
      {selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Contact Information</h3>
              <button
                onClick={() => setSelectedMerchant(null)}
                className="text-gray-400 hover:text-gray-650"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-sm text-gray-700">
              <div className="pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Merchant</p>
                <p className="text-base font-extrabold text-gray-900 mt-1">{selectedMerchant.tenant.businessName}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Phone size={16} className="text-brand-orange shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Business Phone</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{selectedMerchant.contact.phone || 'No business phone set'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Mail size={16} className="text-brand-orange shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Business Email</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{selectedMerchant.contact.email || 'No business email set'}</p>
                  </div>
                </div>

                {selectedMerchant.contact.admins?.length > 0 && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <User size={13} /> Administrators ({selectedMerchant.contact.admins.length})
                    </p>
                    <div className="space-y-2 pl-6">
                      {selectedMerchant.contact.admins.map((adm, index) => (
                        <div key={index} className="text-xs">
                          <p className="font-bold text-gray-800">{adm.name}</p>
                          <p className="text-gray-500 mt-0.5">{adm.email}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMerchant(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
