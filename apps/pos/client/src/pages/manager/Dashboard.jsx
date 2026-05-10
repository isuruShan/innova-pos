import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  DollarSign, ShoppingBag, TrendingUp, Award, CalendarRange, Store,
  Sun, Percent, Trophy, Tag,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import { DashboardSkeleton } from '../../components/StoreSkeletons';
import PosDateField from '../../components/PosDateField';

const formatPrice = formatCurrency;

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#06b6d4'];

function toYMD(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[var(--pos-panel)] border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-sm">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-semibold text-amber-400">{formatPrice(payload[0].value)}</p>
        {payload[1] && <p className="text-slate-400 text-xs">{payload[1].value} orders</p>}
      </div>
    );
  }
  return null;
};

const OrdersTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[var(--pos-panel)] border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-sm">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-semibold text-sky-400 tabular-nums">{payload[0].value} orders</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const selectedStore = stores.find((s) => s._id === selectedStoreId) || null;

  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = addDays(end, -6);
    return { from: toYMD(start), to: toYMD(end) };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const applyPreset = useCallback((preset) => {
    const end = new Date();
    const endStr = toYMD(end);
    if (preset === '7d') {
      setDateFrom(toYMD(addDays(end, -6)));
      setDateTo(endStr);
    } else if (preset === '30d') {
      setDateFrom(toYMD(addDays(end, -29)));
      setDateTo(endStr);
    } else if (preset === 'month') {
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      setDateFrom(toYMD(start));
      setDateTo(endStr);
    }
  }, []);

  const rangeInvalid = dateFrom && dateTo && dateFrom > dateTo;

  const { data, isPending: salesPending } = useQuery({
    queryKey: ['sales-report', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/sales', { params: { from: dateFrom, to: dateTo } })
        .then((r) => r.data),
    enabled: isStoreReady && Boolean(dateFrom && dateTo && !rangeInvalid),
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });

  const { data: recentOrders = [], isPending: recentPending } = useQuery({
    queryKey: ['recent-orders', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/orders', {
          params: {
            since: `${dateFrom}T00:00:00.000`,
            until: `${dateTo}T23:59:59.999`,
          },
        })
        .then((r) => r.data.slice(0, 10)),
    enabled: isStoreReady && Boolean(dateFrom && dateTo && !rangeInvalid),
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });

  const showSkeleton = !isStoreReady || (!rangeInvalid && (salesPending || recentPending));

  const periodOrders = data?.orderCount ?? 0;
  const rangeLabel =
    data?.rangeFrom && data?.rangeTo
      ? `${formatDate(data.rangeFrom + 'T12:00:00')} – ${formatDate(data.rangeTo + 'T12:00:00')}`
      : `${formatDate(dateFrom + 'T12:00:00')} – ${formatDate(dateTo + 'T12:00:00')}`;

  const dailyData = data?.daily?.map(d => ({
    ...d,
    label: formatDate(d.date + 'T00:00:00'),
    revenue: Math.round(d.revenue * 100) / 100,
    orders: d.orders ?? 0,
  })) || [];

  const peakDay = useMemo(() => {
    if (!dailyData.length) return null;
    return dailyData.reduce((best, d) => (d.revenue > best.revenue ? d : best), dailyData[0]);
  }, [dailyData]);

  const sortedPromos = useMemo(() => {
    const list = data?.promotionStats || [];
    return [...list].sort((a, b) => (b.totalDiscount || 0) - (a.totalDiscount || 0)).slice(0, 8);
  }, [data?.promotionStats]);

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[var(--pos-text-primary)]">Sales Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-3 flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold mb-2">
              <Store size={15} className="text-amber-400 flex-shrink-0" />
              Selected store
            </div>
            {selectedStore ? (
              <>
                <p className="text-[var(--pos-text-primary)] font-semibold text-sm mb-2 truncate leading-tight" title={selectedStore.name}>
                  {selectedStore.name}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
                  <div className="min-w-0">
                    <span className="text-slate-500 block text-[10px] leading-tight">Code</span>
                    <span className="text-slate-300 leading-snug">{selectedStore.code}</span>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <span className="text-slate-500 block text-[10px] leading-tight">Address</span>
                    <span className="text-slate-300 line-clamp-2 leading-snug">{selectedStore.address || '—'}</span>
                  </div>
                  <div className="min-w-0 sm:col-span-3">
                    <span className="text-slate-500 block text-[10px] leading-tight">Payments</span>
                    <span className="text-slate-300 leading-snug">{(selectedStore.paymentMethods || ['cash']).join(', ')}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-xs leading-snug">Choose a store from the navigation bar.</p>
            )}
          </div>

          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-3 flex flex-col">
            <div className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold mb-2">
              <CalendarRange size={15} className="text-amber-400 flex-shrink-0" />
              Report period
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { id: '7d', label: 'Last 7 days' },
                { id: '30d', label: 'Last 30 days' },
                { id: 'month', label: 'This month' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-[var(--pos-text-primary)] transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <label className="flex-1 text-[11px] text-slate-500 leading-tight">
                From
                <div className="mt-0.5">
                  <PosDateField
                    value={dateFrom}
                    onChange={setDateFrom}
                    max={dateTo}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </label>
              <label className="flex-1 text-[11px] text-slate-500 leading-tight">
                To
                <div className="mt-0.5">
                  <PosDateField
                    value={dateTo}
                    onChange={setDateTo}
                    min={dateFrom}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </label>
            </div>
            {rangeInvalid && (
              <p className="text-red-400 text-[11px] mt-1.5 leading-snug">“From” must be on or before “To”.</p>
            )}
            {!rangeInvalid && dateFrom && dateTo && (
              <p className="text-slate-500 text-[11px] mt-1.5 tabular-nums leading-snug">{rangeLabel}</p>
            )}
          </div>
        </div>

        {rangeInvalid ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-4 py-8 text-center text-sm">
            Choose a valid range: “From” must be on or before “To”.
          </div>
        ) : showSkeleton ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard label="Period revenue" value={formatPrice(data?.totalRevenue || 0)} icon={DollarSign} color="amber" />
              <StatCard label="Orders (period)" value={periodOrders} icon={ShoppingBag} color="blue" />
              <StatCard
                label="Best Seller"
                value={data?.bestSeller?.name || 'N/A'}
                icon={Award}
                color="purple"
                sub={data?.bestSeller ? `${data.bestSeller.qty} sold` : undefined}
              />
              <StatCard label="Avg Order Value" value={formatPrice(data?.avgOrderValue || 0)} icon={TrendingUp} color="green" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Today (so far)"
                value={formatPrice(data?.todayRevenue ?? 0)}
                icon={Sun}
                color="amber"
                sub={`${data?.todayOrders ?? 0} completed orders`}
              />
              <StatCard
                label="Discounts (period)"
                value={formatPrice(data?.totalDiscounts ?? 0)}
                icon={Percent}
                color="red"
                sub="Promos & adjustments"
              />
              <StatCard
                label="Peak day (range)"
                value={peakDay ? formatPrice(peakDay.revenue) : '—'}
                icon={Trophy}
                color="green"
                sub={peakDay ? `${peakDay.label} · ${peakDay.orders} orders` : 'No sales in range'}
              />
              <StatCard
                label="Promo programs"
                value={(data?.promotionStats || []).length}
                icon={Tag}
                color="purple"
                sub="With discounts in period"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Revenue bar chart */}
              <div className="lg:col-span-2 bg-[var(--pos-panel)] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-[var(--pos-text-primary)] mb-1">Daily revenue</h2>
                <p className="text-slate-500 text-xs mb-4">{rangeLabel}</p>
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
              <div className="bg-[var(--pos-panel)] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-[var(--pos-text-primary)] mb-4">Sales by category (qty)</h2>
                {data?.categorySales?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={[...data.categorySales].sort((a, b) => b.value - a.value)}
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

            {/* Order volume + promotions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 bg-[var(--pos-panel)] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-[var(--pos-text-primary)] mb-1">Daily order volume</h2>
                <p className="text-slate-500 text-xs mb-4">Completed orders per day in this range</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<OrdersTooltip />} cursor={{ fill: 'rgba(56,189,248,0.06)' }} />
                    <Bar dataKey="orders" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[var(--pos-panel)] rounded-2xl p-5 border border-slate-700/50 flex flex-col min-h-[280px]">
                <h2 className="font-semibold text-[var(--pos-text-primary)] mb-1">Promotion impact</h2>
                <p className="text-slate-500 text-xs mb-3">Discount value attributed to promos</p>
                {sortedPromos.length > 0 ? (
                  <ul className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                    {sortedPromos.map((p) => (
                      <li
                        key={p.name}
                        className="flex items-start justify-between gap-2 text-sm border-b border-slate-700/40 pb-2.5 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-slate-300 truncate" title={p.name}>{p.name}</p>
                          <p className="text-[11px] text-slate-500">{p.uses} uses · {p.type || 'promo'}</p>
                        </div>
                        <span className="text-amber-400 font-semibold text-xs whitespace-nowrap tabular-nums">
                          −{formatPrice(p.totalDiscount || 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-slate-600 text-sm text-center px-2">
                    No promotion discounts in this period
                  </div>
                )}
              </div>
            </div>

            {/* Top selling items + recent orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-[var(--pos-panel)] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-[var(--pos-text-primary)] mb-4">Top Selling Items</h2>
                {data?.topItems?.length > 0 ? (
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
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No sales data yet</div>
                )}
              </div>

              <div className="bg-[var(--pos-panel)] rounded-2xl p-5 border border-slate-700/50">
                <h2 className="font-semibold text-[var(--pos-text-primary)] mb-4">Recent Orders</h2>
                <div className="space-y-2">
                  {recentOrders.slice(0, 6).map(order => (
                    <div key={order._id} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-amber-400 text-xs w-12">
                        #{String(order.orderNumber).padStart(3, '0')}
                      </span>
                      <span className="text-slate-400 text-xs w-24 truncate">
                        {order.orderType === 'dine-in'
                          ? `Table ${order.tableNumber || '-'}`
                          : (order.reference || order.orderType)}
                      </span>
                      <Badge label={order.status} variant={order.status} />
                      <span className="ml-auto font-semibold text-[var(--pos-text-primary)]">{formatPrice(order.totalAmount)}</span>
                      <span className="text-slate-600 text-xs">{formatTime(order.createdAt)}</span>
                    </div>
                  ))}
                  {recentOrders.length === 0 && (
                    <p className="text-slate-600 text-sm text-center py-8">No orders yet</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
