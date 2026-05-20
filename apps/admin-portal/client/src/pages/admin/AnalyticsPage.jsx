import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, Award, CalendarRange, Store, Sun, Percent, Trophy, Tag } from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';
import { unwrapPagedList } from '../../utils/unwrapPagedList';

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

function StatCard({ label, value, icon: Icon, sub, color = 'orange' }) {
  const ring = { orange: 'text-brand-orange bg-brand-orange/10', blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50', purple: 'text-purple-600 bg-purple-50', red: 'text-red-600 bg-red-50' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-lg font-bold text-gray-900 mt-1 truncate" title={String(value)}>{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <span className={`p-2 rounded-lg ${ring[color] || ring.orange}`}><Icon size={18} /></span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const defaultRange = useMemo(() => {
    const end = new Date();
    return { from: toYMD(addDays(end, -6)), to: toYMD(end) };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const { data: storesRaw } = useQuery({
    queryKey: ['analytics-stores'],
    queryFn: async () => {
      const { data } = await api.get('/stores', { params: { page: 1, limit: 200 } });
      return unwrapPagedList(data).items;
    },
  });
  const stores = storesRaw || [];

  useEffect(() => {
    if (!selectedStoreId && stores.length) setSelectedStoreId(stores[0]._id);
  }, [stores, selectedStoreId]);

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
      setDateFrom(toYMD(new Date(end.getFullYear(), end.getMonth(), 1)));
      setDateTo(endStr);
    }
  }, []);

  const rangeInvalid = dateFrom && dateTo && dateFrom > dateTo;
  const storeReady = Boolean(selectedStoreId);

  const { data, isPending: salesPending } = useQuery({
    queryKey: ['analytics-sales', selectedStoreId, dateFrom, dateTo],
    queryFn: () => api.get('/reports/sales', { params: { from: dateFrom, to: dateTo }, headers: { 'x-store-id': selectedStoreId } }).then((r) => r.data),
    enabled: storeReady && Boolean(dateFrom && dateTo && !rangeInvalid),
    refetchInterval: 30_000,
  });

  const { data: orderVolume, isPending: volumePending } = useQuery({
    queryKey: ['analytics-order-volume', selectedStoreId, dateFrom, dateTo],
    queryFn: () => api.get('/analytics/order-volume', { params: { from: dateFrom, to: dateTo }, headers: { 'x-store-id': selectedStoreId } }).then((r) => r.data),
    enabled: storeReady && Boolean(dateFrom && dateTo && !rangeInvalid),
    refetchInterval: 30_000,
  });

  const { data: topItemsData, isPending: topItemsPending } = useQuery({
    queryKey: ['analytics-top-items', selectedStoreId, dateFrom, dateTo],
    queryFn: () => api.get('/analytics/top-items', { params: { from: dateFrom, to: dateTo, limit: 10 }, headers: { 'x-store-id': selectedStoreId } }).then((r) => r.data),
    enabled: storeReady && Boolean(dateFrom && dateTo && !rangeInvalid),
    refetchInterval: 30_000,
  });

  const { data: anlyStatus } = useQuery({
    queryKey: ['analytics-status'],
    queryFn: () => api.get('/analytics/status').then((r) => r.data),
    staleTime: 60_000,
  });

  /** Recent orders: live transactional data (not anly aggregates). */
  const { data: recentOrders = [], isPending: recentPending } = useQuery({
    queryKey: ['analytics-recent', selectedStoreId],
    queryFn: () => api.get('/orders', {
      params: { limit: 10 },
      headers: { 'x-store-id': selectedStoreId },
    }).then((r) => r.data),
    enabled: storeReady,
    refetchInterval: 30_000,
  });

  const dailyData = data?.daily?.map((d) => ({
    ...d,
    label: formatDate(d.date + 'T00:00:00'),
    revenue: Math.round(d.revenue * 100) / 100,
    orders: d.orders ?? 0,
  })) || [];

  const sortedPromos = useMemo(() => {
    const list = data?.promotionStats || [];
    return [...list].sort((a, b) => (b.totalDiscount || 0) - (a.totalDiscount || 0)).slice(0, 8);
  }, [data?.promotionStats]);

  const peakDay = useMemo(() => {
    if (!dailyData.length) return null;
    return dailyData.reduce((best, d) => (d.revenue > best.revenue ? d : best), dailyData[0]);
  }, [dailyData]);

  const volumeDaily = orderVolume?.daily?.map((d) => ({
    ...d,
    label: formatDate(d.date + 'T00:00:00'),
  })) || [];

  const topItems = topItemsData?.topItems || [];

  const loading = !storeReady || (!rangeInvalid && (salesPending || volumePending || topItemsPending || recentPending));
  const selectedStore = stores.find((s) => s._id === selectedStoreId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-0.5">Sales performance for the selected store and date range.</p>
        {anlyStatus?.enabled && anlyStatus?.intervalMs ? (
          <p className="text-xs text-gray-400 mt-1">
            Order volume matches completed orders in real time. Top sellers refresh every{' '}
            {Math.round(anlyStatus.intervalMs / 60000)} min
            {anlyStatus.lastRunAt ? ` (last sync ${formatTime(anlyStatus.lastRunAt)})` : ''}.
            Recent orders are always live.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
            <Store size={15} className="text-brand-orange" /> Store
          </div>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {stores.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          {selectedStore && (
            <p className="text-xs text-gray-500 mt-2">{selectedStore.address || 'No address on file'}</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
            <CalendarRange size={15} className="text-brand-orange" /> Report period
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { id: '7d', label: 'Last 7 days' },
              { id: '30d', label: 'Last 30 days' },
              { id: 'month', label: 'This month' },
            ].map((p) => (
              <button key={p.id} type="button" onClick={() => applyPreset(p.id)} className="px-2 py-1 rounded-md text-[11px] font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-500">From
              <AdminDateField value={dateFrom} onChange={setDateFrom} max={dateTo} className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
            </label>
            <label className="text-[11px] text-gray-500">To
              <AdminDateField value={dateTo} onChange={setDateTo} min={dateFrom} className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
            </label>
          </div>
          {rangeInvalid && <p className="text-red-600 text-xs mt-1">“From” must be on or before “To”.</p>}
        </div>
      </div>

      {rangeInvalid ? (
        <p className="text-sm text-red-600 text-center py-8">Choose a valid date range.</p>
      ) : loading ? (
        <p className="text-sm text-gray-500 text-center py-12">Loading analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Period revenue" value={formatCurrency(data?.totalRevenue || 0)} icon={DollarSign} color="orange" />
            <StatCard label="Orders (period)" value={data?.orderCount ?? 0} icon={ShoppingBag} color="blue" />
            <StatCard label="Best seller" value={data?.bestSeller?.name || 'N/A'} icon={Award} color="purple" sub={data?.bestSeller ? `${data.bestSeller.qty} sold` : undefined} />
            <StatCard label="Avg order value" value={formatCurrency(data?.avgOrderValue || 0)} icon={TrendingUp} color="green" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Today (so far)" value={formatCurrency(data?.todayRevenue ?? 0)} icon={Sun} sub={`${data?.todayOrders ?? 0} orders`} />
            <StatCard label="Discounts (period)" value={formatCurrency(data?.totalDiscounts ?? 0)} icon={Percent} color="red" />
            <StatCard label="Peak day" value={peakDay ? formatCurrency(peakDay.revenue) : '—'} icon={Trophy} color="green" sub={peakDay ? `${peakDay.label}` : undefined} />
            <StatCard label="Promo programs" value={(data?.promotionStats || []).length} icon={Tag} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Daily revenue</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#fa7237" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Sales by category</h3>
              {data?.categorySales?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.categorySales} dataKey="value" nameKey="name" outerRadius={75}>
                      {data.categorySales.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500 text-center py-16">No category data</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">Daily order volume</h3>
              <p className="text-xs text-gray-500 mb-4">Completed orders per day in this range</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Promotion impact</h3>
              {sortedPromos.length ? (
                <ul className="space-y-2 text-sm">
                  {sortedPromos.map((p) => (
                    <li key={p.name} className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                      <span className="text-gray-700 truncate">{p.name}</span>
                      <span className="text-brand-orange font-semibold shrink-0">−{formatCurrency(p.totalDiscount || 0)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No promotion discounts in this period.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Top selling items</h3>
              {topItems.length > 0 ? (
                <div className="space-y-3">
                  {topItems.slice(0, 8).map((item, i) => (
                    <div key={item.menuItemId || item.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-800 truncate">{item.name}</span>
                          <span className="text-xs text-gray-500 ml-2 shrink-0">{item.qty} sold</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-orange rounded-full"
                            style={{ width: `${Math.min(100, (item.qty / topItems[0].qty) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-20 text-right tabular-nums">
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-12">No sales data in this period</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">Recent orders</h3>
              <p className="text-xs text-gray-500 mb-3">Live from transactional data</p>
              <div className="space-y-2 text-sm">
                {recentOrders.map((o) => (
                  <div key={o._id} className="flex items-center gap-2 border-b border-gray-50 pb-2">
                    <span className="font-mono text-xs text-gray-500">#{String(o.orderNumber).padStart(3, '0')}</span>
                    <span className="flex-1 font-medium text-gray-900">{formatCurrency(o.totalAmount)}</span>
                    <span className="text-xs text-gray-400">{formatTime(o.createdAt)}</span>
                  </div>
                ))}
                {!recentOrders.length && <p className="text-gray-500 text-center py-6">No orders yet</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
