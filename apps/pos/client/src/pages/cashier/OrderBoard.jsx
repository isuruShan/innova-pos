import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Clock, ChevronRight, ChevronLeft, RefreshCw,
  Link2, Eye, CalendarDays, Search, X, Printer, Receipt,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import CashierSessionGate from '../../components/cashier/CashierSessionGate';
import CollectPaymentModal from '../../components/cashier/CollectPaymentModal';
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
import { printReceipt, printSplitReceipt, printKitchenTicket } from '../../utils/receiptPrint';
import { shouldPrintReceiptForUpdatedOrder } from '../../utils/receiptPolicy';
import PosDateField from '../../components/PosDateField';
import { useAlert } from '../../context/AlertContext';

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

const STATUSES = ['pending', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];

function getStatusMeta(status, isLight) {
  const meta = {
    pending: {
      label: 'Pending',
      color: isLight ? 'text-amber-700 font-bold' : 'text-yellow-400',
      border: isLight ? 'border-amber-300' : 'border-yellow-500/30',
      bg: isLight ? 'bg-amber-500/5' : 'bg-yellow-500/5',
      dot: isLight ? 'bg-amber-600' : 'bg-yellow-400',
      next: 'preparing', prev: null,
      nextLabel: 'Start Preparing',
      nextClass: isLight 
        ? 'bg-amber-600 hover:bg-amber-500 text-white font-bold' 
        : 'bg-yellow-500 hover:bg-yellow-400 text-[var(--pos-text-primary)]',
    },
    preparing: {
      label: 'Preparing',
      color: isLight ? 'text-blue-700 font-bold' : 'text-blue-400',
      border: isLight ? 'border-blue-300' : 'border-blue-500/30',
      bg: isLight ? 'bg-blue-500/5' : 'bg-blue-500/5',
      dot: isLight ? 'bg-blue-600' : 'bg-blue-400',
      next: 'ready', prev: 'pending',
      nextLabel: 'Mark Ready',
      nextClass: isLight 
        ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold' 
        : 'bg-blue-500 hover:bg-blue-400 text-[var(--pos-text-primary)]',
      prevLabel: '← Pending',
    },
    ready: {
      label: 'Ready',
      color: isLight ? 'text-emerald-700 font-bold' : 'text-green-400',
      border: isLight ? 'border-emerald-300' : 'border-green-500/30',
      bg: isLight ? 'bg-emerald-500/5' : 'bg-green-500/5',
      dot: isLight ? 'bg-emerald-600' : 'bg-green-400',
      next: 'completed', prev: 'preparing',
      nextLabel: 'Complete ✓',
      nextClass: isLight 
        ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold' 
        : 'bg-green-500 hover:bg-green-400 text-white',
      prevLabel: '← Preparing',
    },
    delivered: {
      label: 'Delivered',
      color: isLight ? 'text-purple-700 font-bold' : 'text-purple-400',
      border: isLight ? 'border-purple-300' : 'border-purple-500/30',
      bg: isLight ? 'bg-purple-500/5' : 'bg-purple-500/5',
      dot: isLight ? 'bg-purple-600' : 'bg-purple-400',
      next: 'completed', prev: 'ready',
      nextLabel: 'Complete ✓',
      nextClass: isLight 
        ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold' 
        : 'bg-green-500 hover:bg-green-400 text-white',
      prevLabel: '← Ready',
    },
    completed: {
      label: 'Completed',
      color: 'text-[var(--pos-text-muted)]',
      border: isLight ? 'border-slate-300' : 'border-slate-600/30',
      bg: isLight ? 'bg-slate-100' : 'bg-slate-700/10',
      dot: 'bg-slate-500',
      next: null, prev: null,
    },
    cancelled: {
      label: 'Cancelled',
      color: isLight ? 'text-red-700 font-bold' : 'text-red-400',
      border: isLight ? 'border-red-300' : 'border-red-500/20',
      bg: isLight ? 'bg-red-500/5' : 'bg-red-500/5',
      dot: 'bg-red-500',
      next: null, prev: null,
    },
  };
  return meta[status];
}

const formatTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function ElapsedBadge({ createdAt, status }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  if (['completed', 'cancelled'].includes(status)) return null;
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const urgent = mins >= 15;
  return (
    <span className={`flex items-center gap-1 text-xs ${
      urgent
        ? isLight ? 'text-red-750 font-bold' : 'text-red-400 font-semibold'
        : 'text-[var(--pos-text-muted)]'
    }`}>
      <Clock size={11} />{mins < 1 ? '< 1m' : `${mins}m`}
    </span>
  );
}

function OrderCard({ order, onAdvanceStatus, onViewEdit, busyId, branding, selectedStore, isLight }) {
  const meta = getStatusMeta(order.status, isLight);
  const isBusy = busyId === order._id;

  const hasPendingAdds = ['preparing', 'ready'].includes(order.status) &&
    ['pending_adds', 'preparing_adds'].includes(order.kitchenAddsStatus);

  let nextStatus = meta?.next;
  let nextLabel = meta?.nextLabel;
  let nextClass = meta?.nextClass;
  let prevStatus = meta?.prev;
  let prevLabel = meta?.prevLabel;

  if (order.status === 'ready' && order.orderType === 'delivery') {
    nextStatus = 'delivered';
    nextLabel = 'Mark Delivered';
    nextClass = 'bg-purple-600 hover:bg-purple-500 text-white';
  } else if (order.status === 'delivered') {
    nextStatus = 'completed';
    nextLabel = 'Complete ✓';
    nextClass = 'bg-green-600 hover:bg-green-500 text-white';
    prevStatus = 'ready';
    prevLabel = '← Ready';
  }

  const { showAlert } = useAlert();

  const handlePrintReceipt = (e) => {
    e.stopPropagation();
    try {
      printReceipt(order, {
        branding,
        store: selectedStore,
        paymentType: order.paymentType,
      });
    } catch (err) {
      console.error('[Print Receipt] Error:', err);
      showAlert('Failed to print receipt', 'Printing Error', 'error');
    }
  };

  const handlePrintKitchen = (e) => {
    e.stopPropagation();
    try {
      printKitchenTicket(order, {
        branding,
        store: selectedStore,
      });
    } catch (err) {
      console.error('[Print Kitchen Ticket] Error:', err);
      showAlert('Failed to print kitchen ticket', 'Printing Error', 'error');
    }
  };

  return (
    <div className="order-card-container transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-500/35">
      <div className={`bg-[var(--pos-panel)] rounded-xl border ${meta.border} overflow-hidden flex flex-col h-full`}>
        {/* Header */}
        <div className={`px-3 py-2.5 flex items-center justify-between gap-1 border-b ${meta.border} ${meta.bg}`}>
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {order._offlinePending && (
              <span
                className="text-[9px] font-bold uppercase tracking-tight text-amber-200/90 bg-amber-500/20 border border-amber-500/35 rounded px-1 py-0.5 flex-shrink-0"
                title="Saved on this device — will sync when online"
              >
                Pending sync
              </span>
            )}
            <span className={`font-mono font-bold text-sm flex-shrink-0 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
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
              logoUrl={order.orderTypeBranding?.logoUrl}
              icon={order.orderTypeBranding?.icon}
              color={order.orderTypeBranding?.color}
              size="xs"
            />
            {hasPendingAdds && (
              <span
                className={`text-[9px] font-bold uppercase tracking-tight rounded px-1.5 py-0.5 flex-shrink-0 animate-pulse ${isLight ? 'text-orange-850 bg-orange-50 border border-orange-200' : 'text-orange-200 bg-orange-500/20 border border-orange-500/35'}`}
                title="New items added need kitchen preparation"
              >
                Adds Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ElapsedBadge createdAt={order.createdAt} status={order.status} />
            <span className="text-xs text-[var(--pos-text-muted)]">{formatTime(order.createdAt)}</span>
            <button
              onClick={() => onViewEdit(order)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[var(--pos-text-primary)] border border-slate-700/60 transition text-[11px] font-semibold"
              title="View / Edit"
            >
              <Eye size={12} />
              View
            </button>
          </div>
        </div>

        {/* Card Body - Side-by-side on wide screens via container queries */}
        <div className="order-card-body">
          {/* Left panel: Items */}
          <div className="order-card-left p-3 space-y-1.5 min-h-0 flex flex-col justify-start">
            {order.items.map((item, i) => (
              <div key={i}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.isCombo && <Link2 size={10} className={`${isLight ? 'text-amber-600' : 'text-amber-400'} flex-shrink-0`} />}
                      <span className="text-xs font-medium text-[var(--pos-text-secondary)] leading-tight">{item.name}</span>
                    </div>
                    {item.variantName && (
                      <span className={`text-[10px] truncate ml-3.5 block ${isLight ? 'text-amber-700 font-semibold font-mono' : 'text-amber-400/80 font-mono'}`}>
                        ↳ {item.variantName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[var(--pos-text-muted)] flex-shrink-0">×{item.qty}</span>
                </div>
                {item.isCombo && item.comboItems?.length > 0 && (
                  <div className="ml-3.5 border-l border-slate-700/20 pl-1.5 mt-0.5 space-y-0.5">
                    {item.comboItems.map((ci, j) => (
                      <p key={j} className="text-[10px] text-[var(--pos-text-muted)] font-mono leading-tight">↳ {ci.name} ×{ci.qty}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right panel: Details, Print, Actions */}
          <div className="order-card-right p-3 bg-[var(--pos-surface-inset)] border-t border-slate-700/20">
            {/* Total and Cashier Name */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--pos-text-muted)]">Total Amount</span>
                <span className="text-[10px] text-[var(--pos-text-muted)] truncate max-w-[90px]" title={`Created by ${order.createdBy?.name || '—'}`}>
                  {order.createdBy?.name || '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-bold text-base text-[var(--pos-text-primary)]">{formatCurrency(order.totalAmount)}</span>
                {order.paymentCollected === false && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isLight ? 'bg-amber-500/10 text-amber-800 border border-amber-500/20' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'}`}>
                    Unpaid
                  </span>
                )}
              </div>
            </div>

            {/* Prints */}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                onClick={handlePrintReceipt}
                className="flex items-center justify-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 text-[10px] font-semibold py-1.5 rounded-lg transition"
                title="Print customer receipt"
              >
                <Receipt size={11} />
                Receipt
              </button>
              <button
                onClick={handlePrintKitchen}
                className="flex items-center justify-center gap-1 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 text-orange-400 text-[10px] font-semibold py-1.5 rounded-lg transition"
                title="Print kitchen ticket"
              >
                <Printer size={11} />
                Kitchen
              </button>
            </div>

            {/* Actions */}
            {hasPendingAdds ? (
              <div className="w-full py-1.5 rounded-lg text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 text-center animate-pulse">
                {order.kitchenAddsStatus === 'preparing_adds'
                  ? 'Prepping additions...'
                  : 'Additions pending...'}
              </div>
            ) : (
              (nextStatus || prevStatus) && (
                <div className="flex gap-1.5">
                  {prevStatus && (
                    <button
                      onClick={() => onAdvanceStatus(order, prevStatus)}
                      disabled={isBusy}
                      className="flex-1 flex items-center justify-center gap-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[10px] font-medium py-2 rounded-lg transition border border-slate-700/50"
                    >
                      <ChevronLeft size={10} />
                      {prevLabel.replace('← ', '')}
                    </button>
                  )}
                  {nextStatus && (
                    <button
                      onClick={() => onAdvanceStatus(order, nextStatus)}
                      disabled={isBusy}
                      className={`flex-2 flex items-center justify-center gap-0.5 text-[10px] font-bold py-2 rounded-lg transition disabled:opacity-50 ${nextClass}`}
                    >
                      {isBusy ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw size={10} className="animate-spin" /> …
                        </span>
                      ) : (
                        <>{nextLabel.replace(' ✓', '')} {!prevStatus && <ChevronRight size={10} />}</>
                      )}
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({ status, orders, onAdvanceStatus, onViewEdit, busyId, branding, selectedStore, isLight }) {
  const meta = getStatusMeta(status, isLight);
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
          <div className="text-center text-[var(--pos-text-muted)] text-xs py-8 border border-dashed border-slate-700 rounded-xl">
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
              branding={branding}
              selectedStore={selectedStore}
              isLight={isLight}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function OrderBoard() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { showAlert } = useAlert();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMobileStatus, setActiveMobileStatus] = useState('pending');

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
        params.since = new Date(`${boardFrom}T00:00:00`).toISOString();
        if (boardTo) params.until = new Date(`${boardTo}T23:59:59`).toISOString();
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
    mutationFn: async ({ id, status, paymentType: pt, paymentAmount: pa, cashTender }) => {
      const body = {};
      if (status != null) body.status = status;
      if (pt) body.paymentType = pt;
      if (pa != null) body.paymentAmount = pa;
      if (cashTender != null) body.cashTender = cashTender;
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
          if (variables?.paymentType === 'split' && variables?.printMode === 'separate' && Array.isArray(updatedOrder.payments)) {
            updatedOrder.payments.forEach(p => {
              printSplitReceipt(updatedOrder, p, { branding, store: selectedStore });
            });
          } else {
            printReceipt(updatedOrder, {
              branding,
              store: selectedStore,
              paymentType: updatedOrder.paymentType,
              cashTender: variables?.cashTender,
            });
          }
        } catch (err) {
          console.warn('[Receipt Print] Failed:', err);
        }
      }
    },
    onError: (e) => showAlert(e.response?.data?.message || 'Failed to update status', 'Error', 'error'),
    onSettled: () => setBusyId(null),
  });

  const handleAdvanceStatus = (order, nextStatus) => {
    if (nextStatus === 'completed' && order.paymentCollected === false) {
      const canPay = ['cashier', 'manager', 'merchant_admin'].includes(normalizeRole(user?.role));
      if (!canPay) {
        showAlert('Payment must be collected at the register before completing this order.', 'Payment Required', 'info');
        return;
      }
      setCompletePaymentOrder(order);
      return;
    }
    mutation.mutate({ id: order._id, status: nextStatus });
  };

  const handlePaymentConfirm = ({ paymentType, paymentAmount, cashTender, payments, printMode }) => {
    if (!completePaymentOrder) return;
    mutation.mutate({
      id: completePaymentOrder._id,
      status: 'completed',
      paymentType,
      paymentAmount,
      cashTender,
      payments,
      printMode,
    });
    setCompletePaymentOrder(null);
  };

  // Get current user ID for session filtering
  const currentUserId = user?._id || user?.id;

  const grouped = useMemo(() => {
    const g = { pending: [], preparing: [], ready: [], delivered: [], completed: [], cancelled: [] };
    const q = searchQuery.trim().toLowerCase();
    
    [...orders].reverse().forEach((o) => {
      const hasPendingAdds = ['preparing', 'ready'].includes(o.status) &&
        ['pending_adds', 'preparing_adds'].includes(o.kitchenAddsStatus);
      const displayStatus = hasPendingAdds ? 'pending' : o.status;
      if (!g[displayStatus]) return;
      
      // Search filter: match order number, customer name, or table number
      if (q) {
        const orderNum = String(o.orderNumber || '').padStart(3, '0');
        const customerName = (o.customer?.name || o.createdBy?.name || '').toLowerCase();
        const tableNum = (o.tableNumber || '').toLowerCase();
        const reference = (o.reference || '').toLowerCase();
        if (
          !orderNum.includes(q) &&
          !customerName.includes(q) &&
          !tableNum.includes(q) &&
          !reference.includes(q)
        ) {
          return;
        }
      }
      
      // For cashier mode (not register/manager), filter completed/cancelled to session
      if (!fohr.isRegister && (displayStatus === 'completed' || displayStatus === 'cancelled')) {
        const creatorId = o.createdBy?._id || o.createdBy?.id || o.createdById;
        if (creatorId && currentUserId && String(creatorId) !== String(currentUserId)) {
          return;
        }
      }
      
      g[displayStatus].push(o);
    });
    return g;
  }, [orders, searchQuery, fohr.isRegister, currentUserId]);

  const totalActive = grouped.pending.length + grouped.preparing.length + grouped.ready.length + grouped.delivered.length;

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

        {/* Search */}
        <div className="mb-4 flex-shrink-0">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full bg-[var(--pos-panel)] border border-slate-700/50 text-[var(--pos-text-primary)] rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
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
                    ? isLight
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-850 font-semibold'
                      : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-slate-700 text-[var(--pos-text-muted)] hover:border-slate-500 hover:text-[var(--pos-text-primary)]'
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

        {/* Mobile View Tab Switcher */}
        {!isPending && isStoreReady && (
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-2 no-scrollbar scroll-smooth whitespace-nowrap -mx-4 px-4 sm:-mx-5 sm:px-5 flex-shrink-0">
            {STATUSES.map((status) => {
              const count = grouped[status]?.length || 0;
              const meta = getStatusMeta(status, isLight);
              const isActive = activeMobileStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveMobileStatus(status)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 shrink-0 ${
                    isActive
                      ? isLight
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-sm'
                      : isLight
                        ? 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
                        : 'bg-[var(--pos-panel)] border-slate-800/40 text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span>{meta.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive
                      ? isLight
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!isStoreReady || isPending ? (
          <div className="flex-1 flex flex-col min-h-0 py-2">
            <KanbanSkeleton columns={6} />
          </div>
        ) : (
          <>
            {/* Mobile Column View (Single Column tabbed) */}
            <div className="lg:hidden flex-1 min-h-0">
              <Column
                status={activeMobileStatus}
                orders={grouped[activeMobileStatus] || []}
                onAdvanceStatus={handleAdvanceStatus}
                onViewEdit={setSelectedOrder}
                busyId={busyId}
                branding={branding}
                selectedStore={selectedStore}
                isLight={isLight}
              />
            </div>

            {/* Desktop Column View (6 columns) */}
            <div className="hidden lg:grid grid-cols-6 gap-3 min-h-0 flex-1 overflow-hidden">
              {STATUSES.map(status => (
                <Column
                  key={status}
                  status={status}
                  orders={grouped[status]}
                  onAdvanceStatus={handleAdvanceStatus}
                  onViewEdit={setSelectedOrder}
                  busyId={busyId}
                  branding={branding}
                  selectedStore={selectedStore}
                  isLight={isLight}
                />
              ))}
            </div>
          </>
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

      <CollectPaymentModal
        open={Boolean(completePaymentOrder)}
        onClose={() => setCompletePaymentOrder(null)}
        onConfirm={handlePaymentConfirm}
        total={completePaymentOrder?.totalAmount || 0}
        availablePaymentMethods={availablePaymentMethods}
        confirmLabel="Complete & print bill"
        isPending={mutation.isPending}
        orderNumber={completePaymentOrder?.orderNumber}
        orderType={completePaymentOrder?.orderType}
        tableNumber={completePaymentOrder?.tableNumber}
        reference={completePaymentOrder?.reference}
        items={completePaymentOrder?.items || []}
        subtotal={completePaymentOrder?.subtotal}
        discountTotal={completePaymentOrder?.discountTotal}
        taxAmount={completePaymentOrder?.taxAmount}
        serviceFeeAmount={completePaymentOrder?.serviceFeeAmount}
        contextNote="Guest tabs are paid when you complete the order. Pick how they paid, then confirm."
      />

    </div>
    </CashierSessionGate>
  );
}
