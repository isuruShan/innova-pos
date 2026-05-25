import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutGrid, Globe, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

const COLORS = ['#fa7237', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#06b6d4'];

const ORDER_TYPE_LABELS = {
  'dine-in': 'Dine-In',
  takeaway: 'Takeaway',
  'uber-eats': 'Uber Eats',
  pickme: 'PickMe',
};

const SOURCE_LABELS = {
  pos: 'Cashier Register (POS)',
  qr: 'Customer QR Ordering',
};

export default function OrderDistributionView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [typeSortField, setTypeSortField] = useState('orders');
  const [typeSortOrder, setTypeSortOrder] = useState('desc');
  const [sourceSortField, setSourceSortField] = useState('orders');
  const [sourceSortOrder, setSourceSortOrder] = useState('desc');

  // Fetch data
  const { data, isPending } = useQuery({
    queryKey: ['report-order-distribution', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/order-distribution', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId }
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });

  const byTypeData = data?.byType || [];
  const bySourceData = data?.bySource || [];

  // Sorting handlers
  const handleSortType = (field) => {
    if (typeSortField === field) {
      setTypeSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTypeSortField(field);
      setTypeSortOrder('desc');
    }
  };

  const handleSortSource = (field) => {
    if (sourceSortField === field) {
      setSourceSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSourceSortField(field);
      setSourceSortOrder('desc');
    }
  };

  // Sorted Arrays
  const sortedTypes = useMemo(() => {
    return [...byTypeData].sort((a, b) => {
      const valA = a[typeSortField];
      const valB = b[typeSortField];
      return typeSortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [byTypeData, typeSortField, typeSortOrder]);

  const sortedSources = useMemo(() => {
    return [...bySourceData].sort((a, b) => {
      const valA = a[sourceSortField];
      const valB = b[sourceSortField];
      return sourceSortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [bySourceData, sourceSortField, sourceSortOrder]);

  // Export CSV
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = ['Metric Category', 'Type/Source Label', 'Orders Placed', 'Total Revenue ($)'];
        const typeRows = sortedTypes.map((t) => [
          'Order Type',
          ORDER_TYPE_LABELS[t.type] || t.type,
          t.orders,
          t.revenue.toFixed(2),
        ]);
        const sourceRows = sortedSources.map((s) => [
          'Order Source',
          SOURCE_LABELS[s.source] || s.source,
          s.orders,
          s.revenue.toFixed(2),
        ]);

        exportToCsv('order_distribution', headers, [...typeRows, [], ...sourceRows]);
      });
    }
  }, [sortedTypes, sortedSources, registerExport]);

  // Formatting helper for pie labels
  const typeChartData = useMemo(() => {
    return byTypeData.map((t) => ({
      name: ORDER_TYPE_LABELS[t.type] || t.type,
      value: t.orders,
      revenue: t.revenue,
    }));
  }, [byTypeData]);

  const sourceChartData = useMemo(() => {
    return bySourceData.map((s) => ({
      name: SOURCE_LABELS[s.source] || s.source,
      value: s.orders,
      revenue: s.revenue,
    }));
  }, [bySourceData]);

  const totalOrders = typeChartData.reduce((s, c) => s + c.value, 0);
  const totalRevenue = typeChartData.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-250 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-lg">
            <LayoutGrid size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Orders</p>
            <p className="text-lg font-bold text-gray-900">{totalOrders}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Globe size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Aggregated Revenue</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Grid: Order Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table & Chart by Type */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">Order Channel split</h3>
            <p className="text-xs text-gray-450">Distribution by Dine-in, Takeaway, or delivery partners</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
            {/* Chart */}
            <div className="sm:col-span-2 h-44">
              {isPending ? (
                <div className="h-full flex items-center justify-center text-gray-400 animate-pulse text-xs">Loading...</div>
              ) : typeChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ fontSize: 11 }}
                      formatter={(val, name) => [`${val} orders`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Table */}
            <div className="sm:col-span-3 overflow-hidden border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-550 border-b border-gray-200">
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => handleSortType('orders')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-medium">
                        Orders {typeSortField === 'orders' ? (typeSortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => handleSortType('revenue')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-medium">
                        Revenue {typeSortField === 'revenue' ? (typeSortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {sortedTypes.map((t, idx) => (
                    <tr key={t.type} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {ORDER_TYPE_LABELS[t.type] || t.type}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{t.orders}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800 font-mono">{formatCurrency(t.revenue)}</td>
                    </tr>
                  ))}
                  {sortedTypes.length === 0 && !isPending && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-gray-400">No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Table & Chart by Source */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">Device/Source breakdown</h3>
            <p className="text-xs text-gray-450">Compare POS terminal orders vs Customer-scanned QR web orders</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
            {/* Chart */}
            <div className="sm:col-span-2 h-44">
              {isPending ? (
                <div className="h-full flex items-center justify-center text-gray-400 animate-pulse text-xs">Loading...</div>
              ) : sourceChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ fontSize: 11 }}
                      formatter={(val, name) => [`${val} orders`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Table */}
            <div className="sm:col-span-3 overflow-hidden border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-550 border-b border-gray-200">
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => handleSortSource('orders')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-medium">
                        Orders {sourceSortField === 'orders' ? (sourceSortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => handleSortSource('revenue')} className="hover:text-gray-900 inline-flex items-center gap-0.5 font-medium">
                        Revenue {sourceSortField === 'revenue' ? (sourceSortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {sortedSources.map((s, idx) => (
                    <tr key={s.source} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }} />
                        {SOURCE_LABELS[s.source] || s.source}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{s.orders}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800 font-mono">{formatCurrency(s.revenue)}</td>
                    </tr>
                  ))}
                  {sortedSources.length === 0 && !isPending && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-gray-400">No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
