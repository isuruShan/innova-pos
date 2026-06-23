import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutGrid, Globe, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#06b6d4'];

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
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });

  const byTypeData = Array.isArray(data?.byType) ? data.byType : [];
  const bySourceData = Array.isArray(data?.bySource) ? data.bySource : [];

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

  const sortedTypesWithColors = useMemo(() => {
    return sortedTypes.map((t, idx) => ({
      ...t,
      colorIndex: idx,
    }));
  }, [sortedTypes]);

  const sortedSourcesWithColors = useMemo(() => {
    return sortedSources.map((s, idx) => ({
      ...s,
      colorIndex: idx + 2,
    }));
  }, [sortedSources]);

  // Export CSV
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        // We write out both distribution summaries in one CSV separated by a row
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
    <div className="space-y-8">
      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <LayoutGrid size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Orders</p>
            <p className="text-lg font-bold text-slate-200">{totalOrders}</p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <Globe size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Aggregated Revenue</p>
            <p className="text-lg font-bold text-slate-200">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Grid: Order Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table & Chart by Type */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-200">Order Channel split</h3>
            <p className="text-xs text-slate-500">Distribution by Dine-in, Takeaway, or delivery partners</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
            {/* Chart */}
            <div className="sm:col-span-2 h-44">
              {isPending ? (
                <div className="h-full flex items-center justify-center text-slate-700 animate-pulse text-xs">Loading...</div>
              ) : typeChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">No data</div>
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
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ fontSize: 11 }}
                      formatter={(val, name) => [`${val} orders`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Table */}
            <div className="sm:col-span-3">
              <ResponsiveTable
                rows={sortedTypesWithColors}
                rowKey={(t) => t.type}
                loading={isPending}
                emptyState="No data available"
                currentSort={typeSortField}
                currentOrder={typeSortOrder}
                onSort={handleSortType}
                columns={[
                  {
                    key: 'type',
                    header: 'Type',
                    mobilePrimary: true,
                    render: (t) => (
                      <span className="flex items-center gap-1.5 font-medium text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[t.colorIndex % COLORS.length] }} />
                        {ORDER_TYPE_LABELS[t.type] || t.type}
                      </span>
                    ),
                  },
                  {
                    key: 'orders',
                    header: 'Orders',
                    sortField: 'orders',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (t) => <span className="text-slate-350">{t.orders}</span>,
                  },
                  {
                    key: 'revenue',
                    header: 'Revenue',
                    sortField: 'revenue',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (t) => <span className="font-semibold text-slate-200">{formatCurrency(t.revenue)}</span>,
                  },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Table & Chart by Source */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-200">Device/Source breakdown</h3>
            <p className="text-xs text-slate-500">Compare POS terminal orders vs Customer-scanned QR web orders</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
            {/* Chart */}
            <div className="sm:col-span-2 h-44">
              {isPending ? (
                <div className="h-full flex items-center justify-center text-slate-700 animate-pulse text-xs">Loading...</div>
              ) : sourceChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">No data</div>
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
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ fontSize: 11 }}
                      formatter={(val, name) => [`${val} orders`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Table */}
            <div className="sm:col-span-3">
              <ResponsiveTable
                rows={sortedSourcesWithColors}
                rowKey={(s) => s.source}
                loading={isPending}
                emptyState="No data available"
                currentSort={sourceSortField}
                currentOrder={sourceSortOrder}
                onSort={handleSortSource}
                columns={[
                  {
                    key: 'source',
                    header: 'Source',
                    mobilePrimary: true,
                    render: (s) => (
                      <span className="flex items-center gap-1.5 font-medium text-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[s.colorIndex % COLORS.length] }} />
                        {SOURCE_LABELS[s.source] || s.source}
                      </span>
                    ),
                  },
                  {
                    key: 'orders',
                    header: 'Orders',
                    sortField: 'orders',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (s) => <span className="text-slate-355">{s.orders}</span>,
                  },
                  {
                    key: 'revenue',
                    header: 'Revenue',
                    sortField: 'revenue',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (s) => <span className="font-semibold text-slate-200">{formatCurrency(s.revenue)}</span>,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
