import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  Clock, ChevronRight, ChevronLeft, RefreshCw,
  Link2, Eye, CalendarDays,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import CashierSessionGate from '../../components/cashier/CashierSessionGate';
import { useFohrMode } from '../../hooks/useFohrMode';
import { CASHIER_SESSION_QUERY_KEY, useCashierSession } from '../../components/cashier/cashierSessionContext';
import { mergeOrderLists } from '../../offline/mergeOrders.js';
import { listPendingOrders } from '../../offline/idb.js';
import { resolveLiveOrder, useSyncOfflineOrderSelection } from '../../offline/orderSelection.js';
import OrderTypeBadge from '../../components/OrderTypeBadge';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';
import { useStoreContext } from '../../context/StoreContext';
import { useBranding } from '../../context/BrandingContext';
import { formatCurrency } from '../../utils/format';
import { KanbanSkeleton } from '../../components/StoreSkeletons';
import { printReceipt } from '../../utils/receiptPrint';
import { shouldPrintReceiptForUpdatedOrder } from '../../utils/receiptPolicy';
import PosDateField from '../../components/PosDateField';

function todayStr() {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function sevenDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}
function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 29);
  return d.toISOString().split('T')[0];
}

const STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

const STATUS_META = {
  pending: {
    label: 'Pending', color: 'text-yellow-400', border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5', dot: 'bg-yellow-400',
    next: 'preparing', prev: null,
    nextLabel: 'Start Preparing', nextClass: 'bg-yellow-500 hover:bg-yellow-400 text-[var(--pos-text-primary)]',
  },
  preparing: {
    label: 'Preparing', color: 'text-blue-400', border: 'border-blue-500/30',
    bg: 'bg-blue-500/5', dot: 'bg-blue-400',
    next: 'ready', prev: 'pending',
    nextLabel: 'Mark Ready', nextClass: 'bg-blue-500 hover:bg-blue-400 text-[var(--pos-text-primary)]',
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

const formatTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

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

function OrderCard({ order, onAdvanceStatus, onViewEdit, busyId }) {
  const meta = STATUS_META[order.status];
  const isBusy = busyId === order._id;

  return (
    <div className={`bg-[var(--pos-panel)] rounded-xl border ${meta.border} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`px-3 py-2.5 flex items-center justify-between gap-1 ${meta.bg}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {order._offlinePending && (
            <span
              className="text-[9px] font-bold uppercase tracking-tight text-amber-200/90 bg-amber-500/20 border border-amber-500/35 rounded px-1 py-0.5 flex-shrink-0"
              title="Saved on this device — will sync when online"
            >
              Pending sync
            </span>
          )}
          <span className="font-mono font-bold text-amber-400 text-sm flex-shrink-0">
            {order._offlinePending ? (
              <span title="Temporary reference until synced">#···</span>
            ) : (
              <>#{String(order.orderNumber).padStart(3, '0')}</>
            )}
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
            className="p-1 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition"
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
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  {item.isCombo && <Link2 size={10} className="text-amber-400 flex-shrink-0" />}
                  <span className="text-xs text-slate-300 truncate">{item.name}</span>
                </div>
                {item.variantName && (
                  <span className="text-[10px] text-amber-400/80 truncate ml-3 block">
                    ↳ {item.variantName}
                  </span>
                )}
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
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-semibold text-[var(--pos-text-primary)] text-sm">{formatCurrency(order.totalAmount)}</span>
          {order.paymentCollected === false && (
            <span className="block text-[10px] text-amber-400 font-medium">Payment pending</span>
          )}
        </div>
        <span className="text-xs text-slate-600">{order.createdBy?.name || '—'}</span>
      </div>

      {/* Status action buttons */}
      {(meta.next || meta.prev) && (
        <div className="px-3 pb-3 flex gap-1.5">
          {meta.prev && (
            <button
              onClick={() => onAdvanceStatus(order, meta.prev)}
              disabled={isBusy}
              className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-medium py-2 rounded-lg transition"
            >
              <ChevronLeft size={12} />
              {meta.prevLabel}
            </button>
          )}
          {meta.next && (
            <button
              onClick={() => onAdvanceStatus(order, meta.next)}
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

function Column({ status, orders, onAdvanceStatus, onViewEdit, busyId }) {
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
              onAdvanceStatus={onAdvanceStatus}
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
  const fohr = useFohrMode();
  const qc = useQueryClient();
  const branding = useBranding();
  const { user } = useAuth();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const selectedStore = useMemo(
    () => stores.find((s) => s._id === selectedStoreId) || stores.find((s) => s.isDefault) || null,
    [stores, selectedStoreId],
  );
  const availablePaymentMethods = selectedStore?.paymentMethods?.length
    ? selectedStore.paymentMethods
    : ['cash'];
  const [searchParams, setSearchParams] = useSearchParams();
  const orderFromUrl = searchParams.get('order');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [completePaymentOrder, setCompletePaymentOrder] = useState(null);
  const [completePaymentType, setCompletePaymentType] = useState('cash');

  useEffect(() => {
    if (!orderFromUrl) setSelectedOrder(null);
  }, [selectedStoreId, orderFromUrl]);

  useEffect(() => {
    const bump = () => {
      qc.invalidateQueries({ queryKey: ['order-board'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['cashier-ready-orders'] });
    };
    window.addEventListener('pos-offline-sync-done', bump);
    window.addEventListener('pos-offline-queue', bump);
    return () => {
      window.removeEventListener('pos-offline-sync-done', bump);
      window.removeEventListener('pos-offline-queue', bump);
    };
  }, [qc]);

  const cashierSession = useCashierSession();
  const sessionSince = fohr.orderBoardScopeSession ? cashierSession?.session?.openedAt : undefined;

  // Date filter — only for manager/register mode (cashier uses session scoping)
  const [datePreset, setDatePreset] = useState('today');
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);

  const { boardFrom, boardTo } = useMemo(() => {
    if (!fohr.isRegister) return {};
    const today = todayStr();
    if (datePreset === 'today') return { boardFrom: today, boardTo: today };
    if (datePreset === '7days') return { boardFrom: sevenDaysAgo(), boardTo: today };
    if (datePreset === '30days') return { boardFrom: thirtyDaysAgo(), boardTo: today };
    if (datePreset === 'custom') return { boardFrom: customFrom || today, boardTo: customTo || today };
    return { boardFrom: today, boardTo: today };
  }, [fohr.isRegister, datePreset, customFrom, customTo]);

  const { data: orders = [], isPending, refetch, isFetching } = useQuery({
    queryKey: ['order-board', selectedStoreId, sessionSince, boardFrom, boardTo],
    queryFn: async () => {
      const params = { board: 'true' };
      if (sessionSince) {
        params.since = new Date(sessionSince).toISOString();
      } else if (fohr.isRegister && boardFrom) {
        params.since = `${boardFrom}T00:00:00`;
        if (boardTo) params.until = `${boardTo}T23:59:59`;
      }
      const remote = await api.get('/orders', { params }).then((r) => r.data);
      const pendingLocal = await listPendingOrders();
      return mergeOrderLists(remote, pendingLocal, selectedStoreId);
    },
    enabled: isStoreReady,
    refetchInterval: 15_000,
  });

  useSyncOfflineOrderSelection(orders, selectedOrder, setSelectedOrder);

  useEffect(() => {
    if (!orderFromUrl || !isStoreReady) return;
    const found = orders.find((o) => String(o._id) === orderFromUrl);
    if (found) {
      setSelectedOrder(found);
      return;
    }
    api.get(`/orders/${orderFromUrl}`).then((r) => setSelectedOrder(r.data)).catch(() => {});
  }, [orderFromUrl, orders, isStoreReady]);

  const mutation = useMutation({
    mutationFn: async ({ id, status, paymentType: pt, paymentAmount: pa }) => {
      const body = {};
      if (status != null) body.status = status;
      if (pt) body.paymentType = pt;
      if (pa != null) body.paymentAmount = pa;
      const { data } = await api.put(`/orders/${encodeURIComponent(id)}/status`, body);
      return data;
    },
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: (updatedOrder, variables) => {
      qc.invalidateQueries({ queryKey: ['order-board'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['cashier-ready-orders'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      qc.invalidateQueries({ queryKey: ['recent-orders'] });
      qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] });
      
      const isOfflineOrder = updatedOrder?._offlinePending === true;
      const policyPrint = updatedOrder && shouldPrintReceiptForUpdatedOrder(branding, updatedOrder);
      const paidOnComplete =
        variables?.status === 'completed' &&
        variables?.paymentType &&
        variables.paymentType !== 'pending';
      
      // Skip printing for offline orders to avoid popup issues
      if (updatedOrder && !isOfflineOrder && (policyPrint || paidOnComplete)) {
        try {
          printReceipt(updatedOrder, {
            branding,
            store: selectedStore,
            paymentType: updatedOrder.paymentType,
          });
        } catch (err) {
          console.warn('[Receipt Print] Failed:', err);
        }
      }
    },
    onError: (e) => alert(e.response?.data?.message || 'Failed to update status'),
    onSettled: () => setBusyId(null),
  });

  const handleAdvanceStatus = (order, nextStatus) => {
    if (nextStatus === 'completed' && order.paymentCollected === false) {
      const canPay = ['cashier', 'manager', 'merchant_admin'].includes(normalizeRole(user?.role));
      if (!canPay) {
        window.alert('Payment must be collected at the register before completing this order.');
        return;
      }
      setCompletePaymentType(availablePaymentMethods[0] || 'cash');
      setCompletePaymentOrder(order);
      return;
    }
    mutation.mutate({ id: order._id, status: nextStatus });
  };

  const confirmCompleteWithPayment = () => {
    if (!completePaymentOrder) return;
    const total = Number(completePaymentOrder.totalAmount || 0);
    mutation.mutate({
      id: completePaymentOrder._id,
      status: 'completed',
      paymentType: completePaymentType,
      paymentAmount: total,
    });
    setCompletePaymentOrder(null);
  };

  const grouped = useMemo(() => {
    const g = { pending: [], preparing: [], ready: [], completed: [], cancelled: [] };
    [...orders].reverse().forEach((o) => {
      if (!g[o.status]) return;
      g[o.status].push(o);
    });
    return g;
  }, [orders]);

  const totalActive = grouped.pending.length + grouped.preparing.length + grouped.ready.length;

  const liveSelectedOrder = resolveLiveOrder(orders, selectedOrder);

  return (
    <CashierSessionGate requireSession={fohr.requireCashierSession}>
    <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
      <Navbar groups={fohr.navGroups} />

      <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              Order Board
              {totalActive > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {totalActive} active
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {fohr.isRegister
                ? 'All active orders for this store (not limited to your drawer session)'
                : sessionSince
                  ? 'Showing orders from your open cashier session'
                  : 'Open a cashier session to scope the board to this shift'}
              {' '}
              · Click <Eye size={12} className="inline" /> to view or edit
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-slate-400 hover:text-[var(--pos-text-primary)] text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Date filter — manager/register mode only */}
        {fohr.isRegister && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-2xl bg-[var(--pos-panel)] border border-slate-700/50 flex-shrink-0">
            <CalendarDays size={15} className="text-slate-500 shrink-0" />
            {[
              { key: 'today', label: 'Today' },
              { key: '7days', label: 'Last 7 days' },
              { key: '30days', label: 'Last 30 days' },
              { key: 'custom', label: 'Custom' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDatePreset(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  datePreset === key
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-[var(--pos-text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 ml-1">
                <PosDateField
                  value={customFrom}
                  onChange={setCustomFrom}
                  max={customTo}
                  className="w-[140px] bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <span className="text-slate-500 text-xs">to</span>
                <PosDateField
                  value={customTo}
                  onChange={setCustomTo}
                  min={customFrom}
                  className="w-[140px] bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            )}
          </div>
        )}

        {!isStoreReady || isPending ? (
          <div className="flex-1 flex flex-col min-h-0 py-2">
            <KanbanSkeleton />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3 min-h-0 overflow-hidden">
            {STATUSES.map(status => (
              <Column
                key={status}
                status={status}
                orders={grouped[status]}
                onAdvanceStatus={handleAdvanceStatus}
                onViewEdit={setSelectedOrder}
                busyId={busyId}
              />
            ))}
          </div>
        )}
      </div>

      <OrderDetailSlideOver
        order={liveSelectedOrder}
        onClose={() => {
          setSelectedOrder(null);
          if (orderFromUrl) {
            const next = new URLSearchParams(searchParams);
            next.delete('order');
            setSearchParams(next, { replace: true });
          }
        }}
      />

      {completePaymentOrder && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md bg-[var(--pos-panel)] border border-slate-600/80 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-[var(--pos-text-primary)] font-bold text-lg">Collect payment</h3>
            <p className="text-sm text-slate-400 mt-1">
              Order #{String(completePaymentOrder.orderNumber).padStart(3, '0')} · Total{' '}
              <span className="text-amber-400 font-semibold tabular-nums">
                {formatCurrency(completePaymentOrder.totalAmount || 0)}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Guest tabs are paid when you complete the order. Pick how they paid, then confirm.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availablePaymentMethods.map((method) => {
                const label = method.replace(/_/g, ' ');
                const pretty = label.charAt(0).toUpperCase() + label.slice(1);
                const active = completePaymentType === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setCompletePaymentType(method)}
                    className={`min-h-[48px] rounded-xl px-3 text-sm font-semibold border-2 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/15 text-[var(--pos-selection-text)] ring-2 ring-amber-500/40'
                        : 'border-slate-600 bg-[var(--pos-surface-inset)] text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {pretty}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setCompletePaymentOrder(null)}
                className="flex-1 min-h-[48px] rounded-xl border-2 border-slate-600 text-slate-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCompleteWithPayment}
                disabled={mutation.isPending}
                className="flex-1 min-h-[48px] rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white text-sm font-bold"
              >
                {mutation.isPending ? 'Processing…' : 'Complete & print bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CashierSessionGate>
  );
}
