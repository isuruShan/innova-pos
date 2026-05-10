import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, RefreshCw, ChevronDown, X,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Badge from '../../components/Badge';
import OrderTypeBadge from '../../components/OrderTypeBadge';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';
import { MANAGER_LINKS } from '../../constants/managerLinks';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { useStoreContext, normalizeStoreId } from '../../context/StoreContext';
import { StatsRowSkeleton, OrdersTableSkeleton } from '../../components/StoreSkeletons';
import PosDateField from '../../components/PosDateField';

const ORDER_TYPE_OPTIONS = [
  { value: 'dine-in',   label: 'Dine-In' },
  { value: 'takeaway',  label: 'Take Away' },
  { value: 'uber-eats', label: 'Uber Eats' },
  { value: 'pickme',    label: 'PickMe' },
];
const STATUS_OPTIONS = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

function todayStr() {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

const PAYMENT_LABELS = { cash: 'Cash', card: 'Card', online: 'Online', bank_transfer: 'Bank transfer' };

function formatPaymentTypeLabel(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (PAYMENT_LABELS[s]) return PAYMENT_LABELS[s];
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OrdersView() {
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch]           = useState('');
  const [fromDate, setFromDate]       = useState(sevenDaysAgo());
  const [toDate, setToDate]           = useState(todayStr());
  const [statusFilter, setStatusFilter]     = useState([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState([]);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState([]);

  const selectedStore = useMemo(
    () => stores.find((s) => normalizeStoreId(s._id) === normalizeStoreId(selectedStoreId)),
    [stores, selectedStoreId],
  );

  const paymentFilterOptions = useMemo(() => {
    const raw = selectedStore?.paymentMethods?.length ? selectedStore.paymentMethods : ['cash', 'card'];
    const uniq = [...new Set(raw)];
    return uniq.map((value) => ({
      value,
      label: PAYMENT_LABELS[value] || formatPaymentTypeLabel(value),
    }));
  }, [selectedStore]);

  // Build query params
  const params = useMemo(() => {
    const p = {};
    if (fromDate) p.since = `${fromDate}T00:00:00`;
    if (toDate)   p.until = `${toDate}T23:59:59`;
    if (statusFilter.length)    p.status    = statusFilter.join(',');
    if (orderTypeFilter.length) p.orderType = orderTypeFilter.join(',');
    if (paymentTypeFilter.length) p.paymentType = paymentTypeFilter.join(',');
    if (search.trim()) p.search = search.trim();
    return p;
  }, [fromDate, toDate, statusFilter, orderTypeFilter, paymentTypeFilter, search]);

  useEffect(() => {
    setSelectedOrder(null);
  }, [selectedStoreId]);

  const { data: orders = [], isPending, refetch, isFetching } = useQuery({
    queryKey: ['manager-orders', selectedStoreId, params],
    queryFn: () => api.get('/orders', { params }).then(r => r.data),
    enabled: isStoreReady,
    staleTime: 30_000,
  });

  const showSkeleton = !isStoreReady || isPending;

  const toggleFilter = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

  const activeFilterCount =
    statusFilter.length + orderTypeFilter.length + paymentTypeFilter.length +
    (fromDate !== sevenDaysAgo() || toDate !== todayStr() ? 1 : 0);

  const liveSelected = selectedOrder
    ? orders.find(o => o._id === selectedOrder._id) || selectedOrder
    : null;

  // Summary stats
  const stats = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed');
    const revenue = completed.reduce((s, o) => s + o.totalAmount, 0);
    const discounts = completed.reduce((s, o) => s + (o.discountTotal || 0), 0);
    return { total: orders.length, completed: completed.length, revenue, discounts };
  }, [orders]);

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar links={MANAGER_LINKS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Orders</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-xl text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700 transition"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Orders', value: stats.total },
            { label: 'Completed', value: stats.completed },
            { label: 'Revenue', value: formatCurrency(stats.revenue) },
            { label: 'Discounts Given', value: formatCurrency(stats.discounts) },
          ].map(s => (
            <div key={s.label} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-bold text-[var(--pos-text-primary)] mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter row */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search order #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-slate-500" /></button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
              showFilters || activeFilterCount > 0
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-[var(--pos-panel)] border-slate-700/50 text-slate-400 hover:text-[var(--pos-text-primary)]'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 mb-4 space-y-4">
            {/* Date range */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Date Range</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">From</label>
                  <PosDateField
                    value={fromDate}
                    onChange={setFromDate}
                    max={toDate}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">To</label>
                  <PosDateField
                    value={toDate}
                    onChange={setToDate}
                    min={fromDate}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Status filter */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => toggleFilter(statusFilter, setStatusFilter, s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition capitalize ${
                      statusFilter.includes(s)
                        ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)]'
                        : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-[var(--pos-text-primary)]'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Order type filter */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Order Type</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_TYPE_OPTIONS.map(t => (
                  <button key={t.value} onClick={() => toggleFilter(orderTypeFilter, setOrderTypeFilter, t.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      orderTypeFilter.includes(t.value)
                        ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)]'
                        : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-[var(--pos-text-primary)]'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment type filter */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Payment Type</p>
              <div className="flex flex-wrap gap-2">
                {paymentFilterOptions.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleFilter(paymentTypeFilter, setPaymentTypeFilter, t.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      paymentTypeFilter.includes(t.value)
                        ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)]'
                        : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-[var(--pos-text-primary)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setStatusFilter([]);
                setOrderTypeFilter([]);
                setPaymentTypeFilter([]);
                setFromDate(sevenDaysAgo());
                setToDate(todayStr());
              }}
              className="text-xs text-slate-500 hover:text-red-400 transition"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Table */}
        {showSkeleton ? (
          <OrdersTableSkeleton />
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <p className="text-xl font-semibold">No orders found</p>
            <p className="text-sm mt-1 opacity-60">Try adjusting the filters</p>
          </div>
        ) : (
          <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[56px_72px_76px_96px_minmax(0,1fr)_88px_80px_92px_28px] gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
              {['Order #', 'Type', 'Pay', 'Status', 'Items', 'Total', 'Discount', 'Time', ''].map(h => (
                <span key={h} className="text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-slate-700/30">
              {orders.map(order => (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left hover:bg-slate-700/20 transition group"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[56px_72px_76px_96px_minmax(0,1fr)_88px_80px_92px_28px] gap-3 px-4 py-3 items-center">
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      #{String(order.orderNumber).padStart(3, '0')}
                    </span>
                    <OrderTypeBadge
                      orderType={order.orderType}
                      tableNumber={order.tableNumber}
                      reference={order.reference}
                      size="xs"
                    />
                    <span className="text-xs font-medium text-slate-300 truncate" title={formatPaymentTypeLabel(order.paymentType)}>
                      {formatPaymentTypeLabel(order.paymentType)}
                    </span>
                    <div><Badge label={order.status} variant={order.status} /></div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-300 truncate">
                        {order.items.map(i => `${i.name} ×${i.qty}`).join(', ')}
                      </p>
                      {order.createdBy?.name && (
                        <p className="text-xs text-slate-600">{order.createdBy.name}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[var(--pos-text-primary)]">{formatCurrency(order.totalAmount)}</span>
                    <span className="text-sm text-green-400">
                      {order.discountTotal > 0 ? `-${formatCurrency(order.discountTotal)}` : '—'}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</span>
                    <span className="text-slate-600 group-hover:text-slate-400 text-xs">›</span>
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        #{String(order.orderNumber).padStart(3, '0')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge label={order.status} variant={order.status} />
                        <span className="text-sm font-bold text-[var(--pos-text-primary)]">{formatCurrency(order.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <OrderTypeBadge orderType={order.orderType} tableNumber={order.tableNumber} reference={order.reference} size="xs" />
                      <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-md">
                        {formatPaymentTypeLabel(order.paymentType)}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {order.items.map(i => `${i.name} ×${i.qty}`).join(', ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-700/30 text-xs text-slate-600 text-right">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      <OrderDetailSlideOver
        order={liveSelected}
        onClose={() => setSelectedOrder(null)}
        canCancel={true}
      />
    </div>
  );
}
