import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, Percent, BarChart3, ArrowUpRight, TrendingUp, Filter } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import { useStoreContext } from '../../context/StoreContext';

function toYMD(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function FoodmarketCommissionsPage() {
  const { stores } = useStoreContext();
  const [selectedStore, setSelectedStore] = useState('all');
  const [from, setFrom] = useState(() => {
    const today = new Date();
    return toYMD(addDays(today, -6));
  });
  const [to, setTo] = useState(() => {
    return toYMD(new Date());
  });
  const [quickPeriod, setQuickPeriod] = useState('7days');
  const [partnerId, setPartnerId] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_foodmarket_commissions');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const applyPreset = (preset) => {
    const end = new Date();
    const endStr = toYMD(end);
    if (preset === '7days') {
      setFrom(toYMD(addDays(end, -6)));
      setTo(endStr);
      setQuickPeriod('7days');
    } else if (preset === '30days') {
      setFrom(toYMD(addDays(end, -29)));
      setTo(endStr);
      setQuickPeriod('30days');
    } else if (preset === 'month') {
      setFrom(toYMD(new Date(end.getFullYear(), end.getMonth(), 1)));
      setTo(endStr);
      setQuickPeriod('month');
    }
  };

  const handleResetFilters = () => {
    setSelectedStore('all');
    setPartnerId('');
    applyPreset('7days');
  };

  // Fetch partners for dropdown
  const { data: partners = [] } = useQuery({
    queryKey: ['foodmarket-partners'],
    queryFn: () => api.get('/foodmarket-partners').then((r) => r.data),
  });

  // Fetch report data
  const { data: report = { totalRevenue: 0, totalCommissions: 0, ordersCount: 0, partnerSummary: [], orders: [] }, isLoading } = useQuery({
    queryKey: ['foodmarket-report', from, to, partnerId, selectedStore],
    queryFn: () =>
      api
        .get('/reports/foodmarket', {
          params: {
            from,
            to,
            foodmarketPartnerId: partnerId || undefined,
          },
          headers: {
            'x-store-id': selectedStore,
          },
        })
        .then((r) => r.data),
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Commissions & Channel Sales</h1>
        <p className="text-gray-500 mt-1">Monitor revenue share, flat charges, and payouts for integrated food market channels.</p>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-500" />
            <h3 className="text-sm font-bold text-gray-800">Filter Commissions</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium mr-1">Period:</span>
            {[
              { value: '7days', label: '7 Days' },
              { value: '30days', label: '30 Days' },
              { value: 'month', label: 'This Month' }
            ].map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => applyPreset(p.value)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                  quickPeriod === p.value
                    ? 'bg-brand-orange text-white border-brand-orange shadow-sm'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Store selector */}
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Store</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white text-gray-955 font-medium"
            >
              <option value="all">All Stores</option>
              {stores.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Partner Channel</label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white text-gray-955 font-medium"
            >
              <option value="">All Channels</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Start Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setQuickPeriod('custom');
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white text-gray-955 font-medium"
            />
          </div>
          <div className="w-full">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">End Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setQuickPeriod('custom');
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white text-gray-955 font-medium"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={handleResetFilters}
            className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-650 transition cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Total Orders', value: report.ordersCount, icon: BarChart3, color: 'text-brand-orange bg-brand-orange/10' },
          { label: 'Gross Channel Sales', value: `${report.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Total Commissions', value: `${report.totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Percent, color: 'text-sky-600 bg-sky-50' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
              <stat.icon size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">{stat.label}</p>
              <h3 className="text-2xl font-black text-gray-900 mt-0.5">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Partner Breakdown */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-fit">
          <h3 className="text-base font-bold text-gray-900 mb-4">Breakdown by Partner</h3>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-lg" />
              ))}
            </div>
          ) : report.partnerSummary.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No sales recorded for this period.</p>
          ) : (
            <div className="space-y-4">
              {report.partnerSummary.map((ps) => (
                <div key={ps.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-gray-900">{ps.name}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange">
                      {ps.ordersCount} orders
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3 pt-3 border-t border-gray-200/60">
                    <div>
                      <p className="text-gray-500">Gross Sales</p>
                      <p className="font-bold text-gray-900 mt-0.5">{ps.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Commission</p>
                      <p className="font-bold text-sky-700 mt-0.5">{ps.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <h3 className="text-base font-bold text-gray-900">Recent Completed Channel Orders</h3>
            <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_admin_foodmarket_commissions', m); }} />
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-lg" />
                ))}
              </div>
            ) : report.orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No matching orders found.</div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 bg-gray-50/50">
                {report.orders.map((o) => (
                  <div key={o._id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">#{o.orderNumber}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(o.createdAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">Channel:</span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800">
                          {o.partnerName}
                        </span>
                      </div>
                      <div className="border-t border-gray-100 my-2 pt-2 flex justify-between text-xs font-medium">
                        <div>
                          <p className="text-[9px] text-gray-400">Amount</p>
                          <p className="text-gray-900 font-semibold">{o.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400">Commission</p>
                          <p className="text-sky-700 font-bold">{o.commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                    <th className="px-6 py-3">Order No</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Channel</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-155">
                  {report.orders.map((o) => (
                    <tr key={o._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">#{o.orderNumber}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(o.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800">
                          {o.partnerName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {o.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-sky-700">
                        {o.commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
