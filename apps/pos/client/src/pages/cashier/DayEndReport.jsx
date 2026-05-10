import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, TrendingUp, ShoppingBag, DollarSign, ClipboardList, ShoppingCart } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import { formatCurrency, formatTime } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import { DayEndReportSkeleton } from '../../components/StoreSkeletons';
import PosDateField from '../../components/PosDateField';

const formatPrice = formatCurrency;
const todayStr = () => {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default function DayEndReport() {
  const [date, setDate] = useState(todayStr());
  const { selectedStoreId, isStoreReady } = useStoreContext();

  const { data, isPending, isError } = useQuery({
    queryKey: ['day-end-report', selectedStoreId, date],
    queryFn: () => api.get(`/reports/day-end?date=${date}`).then(r => r.data),
    enabled: isStoreReady,
  });

  const exportCSV = () => {
    if (!data?.orders?.length) return;
    const header = 'Order#,Table,Items,Total,Status,Time\n';
    const rows = data.orders.map(o =>
      `#${String(o.orderNumber).padStart(3, '0')},${o.tableNumber},${o.items.reduce((s, i) => s + i.qty, 0)},${o.totalAmount},${o.status},${formatTime(o.createdAt)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `day-end-report-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar links={[
        { to: '/cashier/order', label: 'New Order', icon: ShoppingCart },
        { to: '/cashier/orders', label: 'Order Board', icon: ClipboardList },
      ]} />

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/cashier/order"
              className="p-2 rounded-lg text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/50 transition"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Day-End Report</h1>
              <p className="text-slate-500 text-sm">Sales summary for selected date</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PosDateField
              value={date}
              onChange={setDate}
              className="flex items-center gap-2 bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 min-w-[200px]"
            />
            <button
              onClick={exportCSV}
              disabled={!data?.orders?.length}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>

        {(!isStoreReady || isPending) && (
          <DayEndReportSkeleton />
        )}

        {isError && !isPending && (
          <div className="text-center text-red-400 py-20">Failed to load report.</div>
        )}

        {data && !isPending && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Total Orders"
                value={data.totalOrders}
                icon={ShoppingBag}
                color="amber"
              />
              <StatCard
                label="Total Revenue"
                value={formatPrice(data.totalRevenue)}
                icon={DollarSign}
                color="green"
              />
              <StatCard
                label="Avg Order Value"
                value={formatPrice(data.avgOrderValue)}
                icon={TrendingUp}
                color="blue"
              />
            </div>

            {/* Orders table */}
            <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700/50">
                <h2 className="font-semibold text-[var(--pos-text-primary)]">Order Breakdown</h2>
              </div>

              {data.orders.length === 0 ? (
                <div className="text-center text-slate-500 py-16">
                  <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
                  <p>No orders found for this date</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Order #</th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Table</th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Items</th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Total</th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {data.orders.map((order) => (
                        <tr key={order._id} className="hover:bg-slate-700/20 transition">
                          <td className="px-5 py-3 font-mono font-semibold text-amber-400">
                            #{String(order.orderNumber).padStart(3, '0')}
                          </td>
                          <td className="px-4 py-3 text-slate-300">Table {order.tableNumber}</td>
                          <td className="px-4 py-3">
                            <div className="text-slate-300">
                              {order.items.map(i => `${i.name} x${i.qty}`).join(', ')}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {order.items.reduce((s, i) => s + i.qty, 0)} items
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[var(--pos-text-primary)]">{formatPrice(order.totalAmount)}</td>
                          <td className="px-4 py-3">
                            <Badge label={order.status} variant={order.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatTime(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
