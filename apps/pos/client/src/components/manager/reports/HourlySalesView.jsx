import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, TrendingUp } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';

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
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-hourly-sales', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/hourly-sales', {
          params: {
            since: `${dateFrom}T00:00:00`,
            until: `${dateTo}T23:59:59`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });
  const data = Array.isArray(rawData) ? rawData : [];

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
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Busiest Hour (Gross Sales)</p>
            <p className="text-sm font-bold text-slate-200">
              {peakHourStats
                ? `${formatHour(peakHourStats.hour)} (${formatCurrency(peakHourStats.revenue)})`
                : 'No sales data'}
            </p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Avg Sales Per Hour</p>
            <p className="text-sm font-bold text-slate-200">
              {formatCurrency(totalRevenue / 24)}
            </p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Combined Ticket Avg</p>
            <p className="text-sm font-bold text-slate-200">
              {formatCurrency(totalAvgTicket)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Chart & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Visual Line/Area Chart */}
        <div className="xl:col-span-3 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-200">Hourly Revenue Curve</h3>
            <p className="text-xs text-slate-500">Sales volume spread across the 24-hour day cycle</p>
          </div>
          {isPending ? (
            <div className="h-64 flex items-center justify-center text-slate-700 animate-pulse text-sm">
              Analyzing timestamps...
            </div>
          ) : totalOrders === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
              No orders logged in range
            </div>
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ color: '#fbbf24', fontSize: 11 }}
                    formatter={(val) => [formatCurrency(val), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Hour-by-Hour Sorting Table */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          <ResponsiveTable
            rows={sortedData}
            rowKey={(d) => d.hour}
            loading={isPending}
            skeletonRows={12}
            emptyState="No sales data in range"
            currentSort={sortField}
            currentOrder={sortOrder}
            onSort={handleSort}
            maxHeight="360px"
            columns={[
              {
                key: 'hour',
                header: 'Hour',
                sortField: 'hour',
                mobilePrimary: true,
                render: (d) => <span className="font-medium text-slate-200">{formatHour(d.hour)}</span>,
              },
              {
                key: 'orders',
                header: 'Orders',
                sortField: 'orders',
                className: 'text-right',
                headerClassName: 'text-right',
                render: (d) => <span className="font-mono text-slate-350">{d.orders}</span>,
              },
              {
                key: 'revenue',
                header: 'Revenue',
                sortField: 'revenue',
                className: 'text-right',
                headerClassName: 'text-right',
                render: (d) => <span className="font-semibold text-slate-200 tabular-nums">{formatCurrency(d.revenue)}</span>,
              },
              {
                key: 'avgOrderValue',
                header: 'Ticket Avg',
                sortField: 'avgOrderValue',
                className: 'text-right',
                headerClassName: 'text-right',
                render: (d) => <span className="font-mono text-slate-400">{formatCurrency(d.avgOrderValue)}</span>,
              },
            ]}
          />
          {/* Summary Row */}
          <div className="bg-[var(--pos-panel)] border border-slate-700 rounded-xl px-4 py-3 flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Total: 24h Summary</span>
            <div className="flex gap-4">
              <span>Orders: <span className="text-slate-200">{totalOrders}</span></span>
              <span>Sales: <span className="text-amber-400">{formatCurrency(totalRevenue)}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
