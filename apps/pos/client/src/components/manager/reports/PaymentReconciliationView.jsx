import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { CreditCard, Wallet, HelpCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#6366f1'];

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
  const { data = [], isPending } = useQuery({
    queryKey: ['report-payment-reconciliation', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/payment-reconciliation', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });

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
            <div key={item.paymentType} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl"
                style={{
                  backgroundColor: `${COLORS[idx % COLORS.length]}10`,
                  color: COLORS[idx % COLORS.length],
                }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  {PAYMENT_LABELS[item.paymentType] || item.paymentType} Total
                </p>
                <p className="text-lg font-bold text-slate-200">{formatCurrency(item.revenue)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.orders} settled receipts</p>
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="col-span-3 text-center py-6 text-slate-600 text-sm">
            No payment transaction logs found in date range
          </div>
        )}
      </div>

      {/* Grid: Charts & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Table representation */}
        <div className="xl:col-span-3 bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/40 text-slate-500 border-b border-slate-800">
                  <th className="px-4 py-3.5">
                    <button onClick={() => handleSort('paymentType')} className="hover:text-slate-300 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Payment Type {sortField === 'paymentType' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button onClick={() => handleSort('orders')} className="hover:text-slate-300 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Orders Count {sortField === 'orders' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button onClick={() => handleSort('revenue')} className="hover:text-slate-300 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Settled Sales {sortField === 'revenue' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <button onClick={() => handleSort('avgOrderValue')} className="hover:text-slate-300 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider">
                      Average Ticket {sortField === 'avgOrderValue' ? (sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 bg-slate-800 rounded w-24" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-slate-800 rounded w-8 ml-auto" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-slate-800 rounded w-16 ml-auto" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-slate-800 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-500">No payment data logged.</td>
                  </tr>
                ) : (
                  sortedData.map((d, idx) => (
                    <tr key={d.paymentType} className="hover:bg-slate-800/10 text-sm">
                      <td className="px-4 py-3.5 flex items-center gap-2 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {PAYMENT_LABELS[d.paymentType] || d.paymentType}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-400">{d.orders}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-200 font-mono">{formatCurrency(d.revenue)}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-400">{formatCurrency(d.avgOrderValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Summary Row */}
          <div className="bg-slate-950/40 px-4 py-3 border-t border-slate-800 flex justify-between items-center text-xs font-semibold text-slate-500">
            <span>Payment Summary</span>
            <div className="flex gap-4">
              <span>Orders: <span className="text-slate-350">{totalOrders}</span></span>
              <span>Sales: <span className="text-amber-400">{formatCurrency(totalRevenue)}</span></span>
            </div>
          </div>
        </div>

        {/* Pie Chart Representation */}
        <div className="xl:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-200">Reconciliation share</h3>
            <p className="text-xs text-slate-500">Percentage distribution of gross settled volume</p>
          </div>
          {pieChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
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
                    formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
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
