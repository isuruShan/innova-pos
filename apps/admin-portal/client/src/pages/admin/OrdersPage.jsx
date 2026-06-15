import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Loader2, Eye, Calendar, Store, Filter, RefreshCw, X,
  Receipt, Sparkles, User, Phone, Mail, Clock, DollarSign
} from 'lucide-react';
import api from '../../api/axios';
import Badge from '../../components/Badge';
import { unwrapPagedList } from '../../utils/unwrapPagedList';

function toYMD(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function OrdersPage() {
  const [selectedStore, setSelectedStore] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sinceDate, setSinceDate] = useState(() => {
    const today = new Date();
    return toYMD(addDays(today, -6));
  });
  const [untilDate, setUntilDate] = useState(() => {
    return toYMD(new Date());
  });
  const [quickPeriod, setQuickPeriod] = useState('7days');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const applyPreset = (preset) => {
    const end = new Date();
    const endStr = toYMD(end);
    if (preset === '7days') {
      setSinceDate(toYMD(addDays(end, -6)));
      setUntilDate(endStr);
      setQuickPeriod('7days');
    } else if (preset === '30days') {
      setSinceDate(toYMD(addDays(end, -29)));
      setUntilDate(endStr);
      setQuickPeriod('30days');
    } else if (preset === 'month') {
      setSinceDate(toYMD(new Date(end.getFullYear(), end.getMonth(), 1)));
      setUntilDate(endStr);
      setQuickPeriod('month');
    }
  };

  // Fetch stores for store mapping & selector
  const { data: stores = [] } = useQuery({
    queryKey: ['admin-stores-list'],
    queryFn: () => api.get('/stores').then((r) => unwrapPagedList(r.data).items),
  });

  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach((s) => {
      map[s._id] = s.name;
    });
    return map;
  }, [stores]);

  // Fetch orders with all filters
  const { data: orders = [], isPending, isFetching, refetch } = useQuery({
    queryKey: ['admin-orders', selectedStore, statusFilter, search, sinceDate, untilDate],
    queryFn: () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (sinceDate) params.since = new Date(sinceDate + 'T00:00:00').toISOString();
      if (untilDate) params.until = new Date(untilDate + 'T23:59:59.999').toISOString();
      return api.get('/orders', {
        params,
        headers: { 'x-store-id': selectedStore },
      }).then((r) => r.data);
    },
  });

  // Calculate quick stats
  const stats = useMemo(() => {
    let completedCount = 0;
    let totalRevenue = 0;
    let totalReturns = 0;

    orders.forEach((o) => {
      if (o.status === 'completed') {
        completedCount += 1;
        totalRevenue += Number(o.totalAmount || 0);
      }
      totalReturns += Number(o.totalReturnedAmount || 0);
    });

    return {
      completedCount,
      revenue: Math.round(totalRevenue * 100) / 100,
      returns: Math.round(totalReturns * 100) / 100,
      totalCount: orders.length,
    };
  }, [orders]);

  const handleResetFilters = () => {
    setSelectedStore('all');
    setStatusFilter('');
    setSearch('');
    applyPreset('7days');
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Comprehensive Orders Tracker</h2>
          <p className="text-xs text-gray-500 mt-1">
            Monitor and track sales, order statuses, and returns across all stores.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700 transition shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isFetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completedCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {stats.revenue.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Returns</p>
          <p className="text-2xl font-bold text-rose-500 mt-1">Rs. {stats.returns.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-500" />
            <h3 className="text-sm font-bold text-gray-800">Filter Orders</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium mr-1">Period:</span>
            {[
              { value: '7days', label: '7 Days' },
              { value: '30days', label: '30 Days' },
              { value: 'month', label: 'This Month' }
            ].map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => applyPreset(p.value)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                  quickPeriod === p.value
                    ? 'bg-brand-orange text-white border-brand-orange shadow-sm'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Store selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Store</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
            >
              <option value="all">All Stores</option>
              {stores.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Order # or customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
              />
            </div>
          </div>

          {/* Since Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Since</label>
            <input
              type="date"
              value={sinceDate}
              onChange={(e) => {
                setSinceDate(e.target.value);
                setQuickPeriod('custom');
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
            />
          </div>

          {/* Until Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Until</label>
            <input
              type="date"
              value={untilDate}
              onChange={(e) => {
                setUntilDate(e.target.value);
                setQuickPeriod('custom');
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
          <button
            onClick={handleResetFilters}
            className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-650 transition cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {isPending ? (
          <div className="py-24 text-center">
            <Loader2 size={24} className="animate-spin text-brand-orange mx-auto" />
            <p className="text-gray-500 text-sm mt-2 font-medium">Fetching orders database...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-24 text-center">
            <Receipt size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-semibold">No orders found</p>
            <p className="text-xs text-gray-400 mt-1">Try expanding your search parameters or date filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-4">Order #</th>
                  <th className="px-6 py-4">Store</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      #{String(o.orderNumber).padStart(3, '0')}
                    </td>
                    <td className="px-6 py-4 text-gray-705 font-medium">
                      {storeMap[o.storeId] || 'Unknown Store'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {o.customerId ? (
                        <div>
                          <p className="font-semibold text-gray-800">{o.customerId.name}</p>
                          {o.customerId.mobile && (
                            <p className="text-[10px] text-gray-500 font-mono">{o.customerId.mobile}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Walk-in Customer</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge label={o.status} variant={o.status} />
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-950">
                      Rs. {Number(o.totalAmount || 0).toFixed(2)}
                      {(o.totalReturnedAmount || 0) > 0 && (
                        <p className="text-[10px] text-rose-500 font-medium">
                          Ref: −{Number(o.totalReturnedAmount).toFixed(2)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-250 hover:border-gray-300 rounded-lg text-xs font-bold text-gray-700 transition cursor-pointer"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details SlideOver / Modal */}
      {selectedOrder && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedOrder(null)} />
          <aside className="fixed inset-y-0 right-0 z-[60] w-full max-w-lg bg-white border-l border-gray-200 shadow-2xl p-6 flex flex-col transform transition-transform duration-200 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-150 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-brand-orange" />
                <h3 className="font-bold text-gray-950 text-base">
                  Order #{String(selectedOrder.orderNumber).padStart(3, '0')} Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-650 p-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 space-y-6">
              {/* Meta stats */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-150 rounded-xl p-3.5 text-xs">
                <div>
                  <span className="text-gray-400 block font-semibold uppercase tracking-wide">Store</span>
                  <span className="font-bold text-gray-800">{storeMap[selectedOrder.storeId] || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-semibold uppercase tracking-wide">Order Type</span>
                  <span className="font-bold text-gray-800 capitalize">{selectedOrder.orderType || 'dine-in'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-semibold uppercase tracking-wide">Placed At</span>
                  <span className="font-bold text-gray-800">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-semibold uppercase tracking-wide">Status</span>
                  <span className="mt-0.5 block">
                    <Badge label={selectedOrder.status} variant={selectedOrder.status} />
                  </span>
                </div>
              </div>

              {/* Customer details */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-gray-800 border-b border-gray-100 pb-2">
                  <User size={14} className="text-brand-orange" />
                  <span>Customer Details</span>
                </div>
                {selectedOrder.customerId ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name</span>
                      <span className="font-semibold text-gray-800">{selectedOrder.customerId.name}</span>
                    </div>
                    {selectedOrder.customerId.mobile && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Phone size={10} /> Phone
                        </span>
                        <span className="font-mono text-gray-800">{selectedOrder.customerId.mobile}</span>
                      </div>
                    )}
                    {selectedOrder.customerId.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Mail size={10} /> Email
                        </span>
                        <span className="text-gray-800">{selectedOrder.customerId.email}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic py-1">Walk-in order (no registered customer)</p>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items summary</p>
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-gray-50/30">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start p-3 text-xs">
                      <div>
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.variantName && (
                          <p className="text-[10px] text-amber-600 font-medium mt-0.5">↳ {item.variantName}</p>
                        )}
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          Rs. {Number(item.price).toFixed(2)} each · qty {item.qty}
                        </p>
                      </div>
                      <span className="font-bold text-gray-800">
                        Rs. {(item.price * item.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill Totals breakdown */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>Rs. {Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                {selectedOrder.discountTotal > 0 && (
                  <div className="flex justify-between text-rose-500 font-medium">
                    <span>Discounts</span>
                    <span>− Rs. {Number(selectedOrder.discountTotal).toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax ({selectedOrder.taxRate || 0}%)</span>
                    <span>Rs. {Number(selectedOrder.taxAmount).toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.serviceFeeAmount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Service Fee</span>
                    <span>Rs. {Number(selectedOrder.serviceFeeAmount).toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.commissionAmount > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Channel Commission</span>
                    <span>Rs. {Number(selectedOrder.commissionAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-sm pt-2 border-t border-gray-200">
                  <span>Net Total</span>
                  <span>Rs. {Number(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                </div>

                {/* Payments */}
                {selectedOrder.paymentCollected && (
                  <div className="pt-2 border-t border-dashed border-gray-200 space-y-1">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Payments</p>
                    {selectedOrder.payments?.length ? (
                      selectedOrder.payments.map((p, pIdx) => (
                        <div key={pIdx} className="flex justify-between text-[11px] text-gray-700">
                          <span className="capitalize">{p.paymentType}</span>
                          <span className="font-mono">Rs. {Number(p.amount).toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-[11px] text-gray-700">
                        <span className="capitalize">{selectedOrder.paymentType || 'cash'}</span>
                        <span className="font-mono">Rs. {Number(selectedOrder.paymentAmount || selectedOrder.totalAmount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Returns / Refund history */}
              {selectedOrder.returns?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Refund History</p>
                  <div className="space-y-3">
                    {selectedOrder.returns.map((ret, rIdx) => (
                      <div key={rIdx} className="bg-rose-50/40 border border-rose-100 rounded-xl p-3.5 text-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-rose-100 pb-1.5">
                          <span className="font-bold text-rose-600">Refund Entry #{rIdx + 1}</span>
                          <span className="text-gray-400">{new Date(ret.returnedAt).toLocaleString()}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Refund Amount</span>
                            <span className="font-bold text-rose-600">Rs. {Number(ret.refundAmount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Refund Method</span>
                            <span className="font-semibold text-gray-700 capitalize">{ret.paymentType || 'cash'}</span>
                          </div>
                          {ret.reason && (
                            <div>
                              <p className="text-gray-500">Reason:</p>
                              <p className="bg-white p-2 border border-rose-100 rounded-lg text-gray-600 mt-1 italic">
                                "{ret.reason}"
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Returned items */}
                        <div className="pt-2 border-t border-rose-100">
                          <p className="text-[10px] text-rose-500 font-semibold mb-1">Returned Items</p>
                          <div className="space-y-1">
                            {ret.items?.map((ri, riIdx) => (
                              <div key={riIdx} className="flex justify-between text-[11px] text-gray-700">
                                <span>{ri.name} (qty {ri.qty})</span>
                                <span className="font-mono text-gray-500">Rs. {Number(ri.lineRefund).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
