import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, TrendingUp, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH} ${ampm}`;
}

export default function HourlySalesView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [sortField, setSortField] = useState('hour');
  const [sortOrder, setSortOrder] = useState('asc');

  // Fetch hourly sales data
  const { data = [], isPending } = useQuery({
    queryKey: ['report-hourly-sales', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/hourly-sales', {
          params: {
            since: `${dateFrom}T00:00:00`,
            until: `${dateTo}T23:59:59`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          headers: { 'x-store-id': selectedStoreId }
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [data, sortField, sortOrder]);

  // Project chart friendly hours
  const chartData = useMemo(() => {
    return data.map((d) => ({
      hour: d.hour,
      label: formatHour(d.hour),
      orders: d.orders,
      revenue: d.revenue,
    }));
  }, [data]);

  // Export CSV
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = ['Hour of Day', 'Orders Placed', 'Gross Sales ($)', 'Avg Ticket ($)'];
        const rows = sortedData.map((d) => [
          formatHour(d.hour),
          d.orders,
          d.revenue.toFixed(2),
          d.avgOrderValue.toFixed(2),
        ]);
        exportToCsv('hourly_sales_report', headers, rows);
      });
    }
  }, [sortedData, registerExport]);

  // Operational metrics summary
  const peakHourStats = useMemo(() => {
    if (data.length === 0) return null;
    const peakObj = data.reduce((max, d) => (d.revenue > max.revenue ? d : max), data[0]);
    return peakObj.revenue > 0 ? peakObj : null;
  }, [data]);

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
  const totalAvgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-brand-orange/10 text-brand-orange rounded-lg">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-550 font-medium">Busiest Hour (Gross Sales)</p>
            <p className="text-sm font-bold text-gray-900">
              {peakHourStats
                ? `${formatHour(peakHourStats.hour)} (${formatCurrency(peakHourStats.revenue)})`
                : 'No sales data'}
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-550 font-medium">Avg Sales Per Hour</p>
            <p className="text-sm font-bold text-gray-900">
              {formatCurrency(totalRevenue / 24)}
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-550 font-medium">Combined Ticket Avg</p>
            <p className="text-sm font-bold text-gray-900">
              {formatCurrency(totalAvgTicket)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Chart & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Visual Line/Area Chart */}
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Hourly Revenue Curve</h3>
            <p className="text-xs text-gray-450">Sales volume spread across the 24-hour day cycle</p>
          </div>
          {isPending ? (
            <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse text-sm">
              Analyzing timestamps...
            </div>
          ) : totalOrders === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-450 text-sm">
              No orders logged in range
            </div>
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fa7237" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#fa7237" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    labelStyle={{ color: '#475569', fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ color: '#f97316', fontSize: 11 }}
                    formatter={(val) => [formatCurrency(val), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#fa7237" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Hour-by-Hour Sorting Table */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="overflow-y-auto max-h-[360px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5">
                    <button onClick={() => handleSort('hour')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Hour {sortField === 'hour' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button onClick={() => handleSort('orders')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Orders {sortField === 'orders' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button onClick={() => handleSort('revenue')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Revenue {sortField === 'revenue' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button onClick={() => handleSort('avgOrderValue')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Ticket Avg {sortField === 'avgOrderValue' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {isPending ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-2"><div className="h-3.5 bg-gray-100 rounded w-10" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-3.5 bg-gray-100 rounded w-6 ml-auto" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-3.5 bg-gray-100 rounded w-10 ml-auto" /></td>
                      <td className="px-3 py-2 text-right"><div className="h-3.5 bg-gray-100 rounded w-10 ml-auto" /></td>
                    </tr>
                  ))
                ) : (
                  sortedData.map((d) => (
                    <tr key={d.hour} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium">{formatHour(d.hour)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{d.orders}</td>
                      <td className="px-3 py-2 text-right font-semibold font-mono text-gray-800">{formatCurrency(d.revenue)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{formatCurrency(d.avgOrderValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Summary Row */}
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex justify-between items-center text-[10px] font-semibold text-gray-500">
            <span>Total: 24h Summary</span>
            <div className="flex gap-3">
              <span>Orders: <span className="text-gray-800">{totalOrders}</span></span>
              <span>Sales: <span className="text-brand-orange">{formatCurrency(totalRevenue)}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
