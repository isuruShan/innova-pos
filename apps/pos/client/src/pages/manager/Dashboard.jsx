import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, Award } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import { MANAGER_LINKS } from '../../constants/managerLinks';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';

const formatPrice = formatCurrency;

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1e293b] border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-sm">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-semibold text-amber-400">{formatPrice(payload[0].value)}</p>
        {payload[1] && <p className="text-slate-400 text-xs">{payload[1].value} orders</p>}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-report'],
    queryFn: () => api.get('/reports/sales?days=7').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => api.get('/orders').then(r => r.data.slice(-10).reverse()),
    refetchInterval: 30_000,
  });

  const dailyData = data?.daily?.map(d => ({
    ...d,
    label: formatDate(d.date + 'T00:00:00'),
    revenue: Math.round(d.revenue * 100) / 100,
  })) || [];

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Navbar links={MANAGER_LINKS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {isLoading ? (
          <div className="text-slate-500 text-center py-20">Loading dashboard...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Today's Revenue" value={formatPrice(data?.todayRevenue || 0)} icon={DollarSign} color="amber" />
              <StatCard label="Orders Today" value={data?.todayOrders || 0} icon={ShoppingBag} color="blue" />
              <StatCard
                label="Best Seller"
                value={data?.bestSeller?.name || 'N/A'}
                icon={Award}
                color="purple"
                sub={data?.bestSeller ? `${data.bestSeller.qty} sold` : undefined}
              />
              <StatCard label="Avg Order Value" value={formatPrice(data?.avgOrderValue || 0)} icon={TrendingUp} color="green" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Revenue bar chart */}
              <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-white mb-4">Revenue — Last 7 Days</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,158,11,0.05)' }} />
                    <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category pie chart */}
              <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-white mb-4">Orders by Category</h2>
                {data?.categorySales?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.categorySales}
                        cx="50%"
                        cy="45%"
                        outerRadius={75}
                        dataKey="value"
                        nameKey="name"
                      >
                        {data.categorySales.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
                      />
                      <Tooltip
                        formatter={(value, name) => [value, name]}
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                        labelStyle={{ display: 'none' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-52 text-slate-600 text-sm">No data yet</div>
                )}
              </div>
            </div>

            {/* Top selling items */}
            {data?.topItems?.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-700/50">
                  <h2 className="font-semibold text-white mb-4">Top Selling Items</h2>
                  <div className="space-y-3">
                    {data.topItems.slice(0, 6).map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-600 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-300 truncate">{item.name}</span>
                            <span className="text-xs text-slate-500 ml-2">{item.qty} sold</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, (item.qty / data.topItems[0].qty) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-amber-400 w-16 text-right">{formatPrice(item.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent orders */}
                <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-700/50">
                  <h2 className="font-semibold text-white mb-4">Recent Orders</h2>
                  <div className="space-y-2">
                    {recentOrders.slice(0, 6).map(order => (
                      <div key={order._id} className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-amber-400 text-xs w-12">
                          #{String(order.orderNumber).padStart(3, '0')}
                        </span>
                        <span className="text-slate-400 text-xs w-14">Table {order.tableNumber}</span>
                        <Badge label={order.status} variant={order.status} />
                        <span className="ml-auto font-semibold text-white">{formatPrice(order.totalAmount)}</span>
                        <span className="text-slate-600 text-xs">{formatTime(order.createdAt)}</span>
                      </div>
                    ))}
                    {recentOrders.length === 0 && (
                      <p className="text-slate-600 text-sm text-center py-8">No orders yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
