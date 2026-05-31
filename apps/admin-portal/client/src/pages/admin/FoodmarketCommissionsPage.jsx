import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, Percent, BarChart3, ArrowUpRight, TrendingUp } from 'lucide-react';
import api from '../../api/axios';

export default function FoodmarketCommissionsPage() {
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [partnerId, setPartnerId] = useState('');

  // Fetch partners for dropdown
  const { data: partners = [] } = useQuery({
    queryKey: ['foodmarket-partners'],
    queryFn: () => api.get('/foodmarket-partners').then((r) => r.data),
  });

  // Fetch report data
  const { data: report = { totalRevenue: 0, totalCommissions: 0, ordersCount: 0, partnerSummary: [], orders: [] }, isLoading } = useQuery({
    queryKey: ['foodmarket-report', from, to, partnerId],
    queryFn: () =>
      api
        .get('/reports/foodmarket', {
          params: {
            from,
            to,
            foodmarketPartnerId: partnerId || undefined,
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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 flex flex-col md:flex-row gap-4 items-end shadow-sm">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Partner Channel</label>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
          >
            <option value="">All Channels</option>
            {partners.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Start Date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">End Date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange bg-white"
          />
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
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-bold text-gray-900">Recent Completed Channel Orders</h3>
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
                <tbody className="divide-y divide-gray-150">
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
