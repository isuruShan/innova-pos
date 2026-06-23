import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { CreditCard, Wallet, HelpCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

const COLORS = ['#fa7237', '#3b82f6', '#10b981', '#ec4899', '#6366f1'];

const PAYMENT_LABELS = {
  cash: 'Cash Drawer',
  card: 'Credit/Debit Card',
  online: 'Online Gateway',
  bank_transfer: 'Bank Transfer',
};

const PAYMENT_ICONS = {
  cash: Wallet,
  card: CreditCard,
  online: CreditCard,
  bank_transfer: Wallet,
};

export default function PaymentReconciliationView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [sortField, setSortField] = useState('revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch reconciliation data
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-payment-reconciliation', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/payment-reconciliation', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId }
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
      setSortOrder('desc');
    }
  };

  // Sort reconciliation lines
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [data, sortField, sortOrder]);

  // Export CSV
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = ['Payment Method', 'Orders Count', 'Settled Volume ($)', 'Avg Ticket ($)'];
        const rows = sortedData.map((d) => [
          PAYMENT_LABELS[d.paymentType] || d.paymentType,
          d.orders,
          d.revenue.toFixed(2),
          d.avgOrderValue.toFixed(2),
        ]);
        exportToCsv('payment_reconciliation_report', headers, rows);
      });
    }
  }, [sortedData, registerExport]);

  // Total summary metrics
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

  const pieChartData = useMemo(() => {
    return data.map((d) => ({
      name: PAYMENT_LABELS[d.paymentType] || d.paymentType,
      value: d.revenue,
      orders: d.orders,
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.slice(0, 3).map((item, idx) => {
          const Icon = PAYMENT_ICONS[item.paymentType] || HelpCircle;
          return (
            <div key={item.paymentType} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div
                className="p-2.5 rounded-lg"
                style={{
                  backgroundColor: `${COLORS[idx % COLORS.length]}10`,
                  color: COLORS[idx % COLORS.length],
                }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {PAYMENT_LABELS[item.paymentType] || item.paymentType} Total
                </p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(item.revenue)}</p>
                <p className="text-[10px] text-gray-550 mt-0.5">{item.orders} settled receipts</p>
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="col-span-3 text-center py-6 text-gray-400 text-sm">
            No payment transaction logs found in date range
          </div>
        )}
      </div>

      {/* Grid: Charts & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Table representation */}
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-3.5">
                    <button
                      onClick={() => handleSort('paymentType')}
                      className={`inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider hover:text-gray-900 transition-colors ${
                        sortField === 'paymentType' ? 'text-brand-teal' : 'text-gray-500'
                      }`}
                    >
                      Payment Type {sortField === 'paymentType' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleSort('orders')}
                      className={`inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider hover:text-gray-900 transition-colors ${
                        sortField === 'orders' ? 'text-brand-teal' : 'text-gray-500'
                      }`}
                    >
                      Orders Count {sortField === 'orders' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleSort('revenue')}
                      className={`inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider hover:text-gray-900 transition-colors ${
                        sortField === 'revenue' ? 'text-brand-teal' : 'text-gray-500'
                      }`}
                    >
                      Settled Sales {sortField === 'revenue' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleSort('avgOrderValue')}
                      className={`inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider hover:text-gray-900 transition-colors ${
                        sortField === 'avgOrderValue' ? 'text-brand-teal' : 'text-gray-500'
                      }`}
                    >
                      Average Ticket {sortField === 'avgOrderValue' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-8 ml-auto" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400">No payment data logged.</td>
                  </tr>
                ) : (
                  sortedData.map((d, idx) => (
                    <tr key={d.paymentType} className="hover:bg-gray-50/50 text-sm">
                      <td className="px-4 py-3 flex items-center gap-2 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {PAYMENT_LABELS[d.paymentType] || d.paymentType}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{d.orders}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(d.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(d.avgOrderValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Summary Row */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
            <span>Payment Summary</span>
            <div className="flex gap-4">
              <span>Orders: <span className="text-gray-700">{totalOrders}</span></span>
              <span>Sales: <span className="text-brand-teal">{formatCurrency(totalRevenue)}</span></span>
            </div>
          </div>
        </div>

        {/* Pie Chart Representation */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Reconciliation share</h3>
            <p className="text-xs text-gray-450">Percentage distribution of gross settled volume</p>
          </div>
          {pieChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              No transactions logged
            </div>
          ) : (
            <div className="flex-1 min-h-[220px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ color: '#475569', fontSize: 11 }}>{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    labelStyle={{ display: 'none' }}
                    itemStyle={{ fontSize: 11 }}
                    formatter={(val, name) => [formatCurrency(val), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
