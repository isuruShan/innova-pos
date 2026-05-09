import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, ChevronRight, ChevronLeft, RefreshCw,
  ClipboardList, FileText, ShoppingCart, Link2, Eye,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Badge from '../../components/Badge';
import OrderTypeBadge from '../../components/OrderTypeBadge';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';

const STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

const STATUS_META = {
  pending: {
    label: 'Pending', color: 'text-yellow-400', border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5', dot: 'bg-yellow-400',
    next: 'preparing', prev: null,
    nextLabel: 'Start Preparing', nextClass: 'bg-yellow-500 hover:bg-yellow-400 text-white',
  },
  preparing: {
    label: 'Preparing', color: 'text-blue-400', border: 'border-blue-500/30',
    bg: 'bg-blue-500/5', dot: 'bg-blue-400',
    next: 'ready', prev: 'pending',
    nextLabel: 'Mark Ready', nextClass: 'bg-blue-500 hover:bg-blue-400 text-white',
    prevLabel: '← Pending',
  },
  ready: {
    label: 'Ready', color: 'text-green-400', border: 'border-green-500/30',
    bg: 'bg-green-500/5', dot: 'bg-green-400',
    next: 'completed', prev: 'preparing',
    nextLabel: 'Complete ✓', nextClass: 'bg-green-500 hover:bg-green-400 text-white',
    prevLabel: '← Preparing',
  },
  completed: {
    label: 'Completed', color: 'text-slate-400', border: 'border-slate-600/30',
    bg: 'bg-slate-700/10', dot: 'bg-slate-500',
    next: null, prev: null,
  },
  cancelled: {
    label: 'Cancelled', color: 'text-red-400', border: 'border-red-500/20',
    bg: 'bg-red-500/5', dot: 'bg-red-500',
    next: null, prev: null,
  },
};

const CASHIER_LINKS = [
  { to: '/cashier/order', label: 'New Order', icon: ShoppingCart },
  { to: '/cashier/orders', label: 'Order Board', icon: ClipboardList },
  { to: '/cashier/report', label: 'Day-End Report', icon: FileText },
];

const formatTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function ElapsedBadge({ createdAt, status }) {
  if (['completed', 'cancelled'].includes(status)) return null;
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const urgent = mins >= 15;
  return (
    <span className={`flex items-center gap-1 text-xs ${urgent ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
      <Clock size={11} />{mins < 1 ? '< 1m' : `${mins}m`}
    </span>
  );
}

function OrderCard({ order, onSetStatus, onViewEdit, busyId }) {
  const meta = STATUS_META[order.status];
  const isBusy = busyId === order._id;

  return (
    <div className={`bg-[#1e293b] rounded-xl border ${meta.border} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`px-3 py-2.5 flex items-center justify-between gap-1 ${meta.bg}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-bold text-amber-400 text-sm flex-shrink-0">
            #{String(order.orderNumber).padStart(3, '0')}
          </span>
          <OrderTypeBadge
            orderType={order.orderType}
            tableNumber={order.tableNumber}
            reference={order.reference}
            size="xs"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ElapsedBadge createdAt={order.createdAt} status={order.status} />
          <span className="text-xs text-slate-600">{formatTime(order.createdAt)}</span>
          <button
            onClick={() => onViewEdit(order)}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition"
            title="View / Edit"
          >
            <Eye size={13} />
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-1 flex-1">
        {order.items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0">
                {item.isCombo && <Link2 size={10} className="text-amber-400 flex-shrink-0" />}
                <span className="text-xs text-slate-300 truncate">{item.name}</span>
              </div>
              <span className="text-xs text-slate-500 flex-shrink-0">×{item.qty}</span>
            </div>
            {item.isCombo && item.comboItems?.length > 0 && (
              <div className="ml-3">
                {item.comboItems.map((ci, j) => (
                  <p key={j} className="text-xs text-slate-600">↳ {ci.name} ×{ci.qty}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer total */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="font-semibold text-white text-sm">${order.totalAmount.toFixed(2)}</span>
        <span className="text-xs text-slate-600">{order.createdBy?.name || '—'}</span>
      </div>

      {/* Status action buttons */}
      {(meta.next || meta.prev) && (
        <div className="px-3 pb-3 flex gap-1.5">
          {meta.prev && (
            <button
              onClick={() => onSetStatus(order._id, meta.prev)}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-medium py-2 rounded-lg transition"
            >
              <ChevronLeft size={12} />
              {meta.prevLabel}
            </button>
          )}
          {meta.next && (
            <button
              onClick={() => onSetStatus(order._id, meta.next)}
              disabled={isBusy}
              className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg transition disabled:opacity-50 ${meta.nextClass}`}
            >
              {isBusy ? (
                <span className="flex items-center gap-1">
                  <RefreshCw size={11} className="animate-spin" /> …
                </span>
              ) : (
                <>{meta.nextLabel} {!meta.prev && <ChevronRight size={12} />}</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Column({ status, orders, onSetStatus, onViewEdit, busyId }) {
  const meta = STATUS_META[status];
  return (
    <div className="flex flex-col min-w-0 min-h-0">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
        <h2 className={`font-semibold text-sm ${meta.color}`}>{meta.label}</h2>
        <span className="ml-auto bg-slate-800 text-slate-400 text-xs font-bold rounded-full px-2 py-0.5">
          {orders.length}
        </span>
      </div>
      <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
        {orders.length === 0 ? (
          <div className="text-center text-slate-700 text-xs py-8 border border-dashed border-slate-800 rounded-xl">
            No {meta.label.toLowerCase()} orders
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order._id}
              order={order}
              onSetStatus={onSetStatus}
              onViewEdit={onViewEdit}
              busyId={busyId}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function OrderBoard() {
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['order-board'],
    queryFn: () => api.get('/orders').then(r => r.data),
    refetchInterval: 15_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/orders/${id}/status`, { status }),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order-board'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
    onError: (e) => alert(e.response?.data?.message || 'Failed to update status'),
    onSettled: () => setBusyId(null),
  });

  const grouped = useMemo(() => {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const g = { pending: [], preparing: [], ready: [], completed: [], cancelled: [] };
    [...orders].reverse().forEach(o => {
      if (!g[o.status]) return;
      // show only last 24 hours for all statuses
      if (new Date(o.createdAt) < cutoff24h) return;
      g[o.status].push(o);
    });
    return g;
  }, [orders]);

  const totalActive = grouped.pending.length + grouped.preparing.length + grouped.ready.length;

  // Keep selectedOrder in sync with live data
  const liveSelectedOrder = selectedOrder
    ? orders.find(o => o._id === selectedOrder._id) || selectedOrder
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a]">
      <Navbar links={CASHIER_LINKS} />

      <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Order Board
              {totalActive > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {totalActive} active
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Showing last 24 hours · Click <Eye size={12} className="inline" /> to view or edit
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <RefreshCw size={18} className="animate-spin mr-2" /> Loading orders…
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3 min-h-0 overflow-hidden">
            {STATUSES.map(status => (
              <Column
                key={status}
                status={status}
                orders={grouped[status]}
                onSetStatus={(id, s) => mutation.mutate({ id, status: s })}
                onViewEdit={setSelectedOrder}
                busyId={busyId}
              />
            ))}
          </div>
        )}
      </div>

      <OrderDetailSlideOver
        order={liveSelectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
