import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, ChefHat, Link2 } from 'lucide-react';
import api from '../../api/axios';
import OfflineBanner from '../../components/OfflineBanner';
import { mergeOrderLists } from '../../offline/mergeOrders.js';
import { listPendingOrders } from '../../offline/idb.js';
import { resolveLiveOrder, useSyncOfflineOrderSelection } from '../../offline/orderSelection.js';
import { useAuth } from '../../context/AuthContext';
import OrderTypeBadge from '../../components/OrderTypeBadge';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';
import { AvatarMenu } from '../../components/Navbar';
import { useStoreContext } from '../../context/StoreContext';
import { useBranding } from '../../context/BrandingContext';
import { KitchenBoardSkeleton } from '../../components/StoreSkeletons';
import { printReceipt } from '../../utils/receiptPrint';
import { shouldPrintReceiptForUpdatedOrder } from '../../utils/receiptPolicy';
// AvatarMenu now uses AvatarDisplay internally, which shows profile image

const REFRESH_INTERVAL = 10_000;

const COLUMNS = [
  {
    status: 'pending',
    label: 'Pending',
    dot: 'bg-yellow-400',
    color: 'text-yellow-400',
    border: 'border-yellow-500/30',
    cardBorder: 'border-yellow-500/30',
    headerBg: 'bg-yellow-500/8',
    btnLabel: 'Start Preparing',
    btnClass: 'bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-[var(--pos-text-primary)]',
  },
  {
    status: 'preparing',
    label: 'Preparing',
    dot: 'bg-blue-400',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    cardBorder: 'border-blue-500/30',
    headerBg: 'bg-blue-500/8',
    btnLabel: 'Mark Ready',
    btnClass: 'bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-[var(--pos-text-primary)]',
  },
  {
    status: 'ready',
    label: 'Ready',
    dot: 'bg-green-400',
    color: 'text-green-400',
    border: 'border-green-500/30',
    cardBorder: 'border-green-500/30',
    headerBg: 'bg-green-500/8',
    btnLabel: null,
    btnClass: '',
  },
];
const COL_MAP = Object.fromEntries(COLUMNS.map(c => [c.status, c]));

function ElapsedBadge({ createdAt }) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const urgent = mins >= 15;
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${urgent ? 'text-red-400' : 'text-slate-500'}`}>
      <Clock size={11} />
      {mins < 1 ? '< 1m' : `${mins}m`}
      {urgent && <span className="animate-pulse">⚠</span>}
    </span>
  );
}

function KitchenCard({ order, onAdvance, onOpen, isAdvancing }) {
  const col = COL_MAP[order.status];
  const prepItems = (order.items || []).filter((i) => !i.deliveredToTable);
  const totalQty = prepItems.reduce((s, i) => s + i.qty, 0);

  const preview = prepItems.slice(0, 3);
  const overflow = prepItems.length - 3;

  return (
    <div
      onClick={() => onOpen(order)}
      className={`bg-[var(--pos-panel)] rounded-xl border ${col.cardBorder} cursor-pointer hover:border-opacity-80 hover:brightness-110 transition group flex flex-col`}
    >
      {/* Top strip */}
      <div className={`px-3 py-2.5 rounded-t-xl flex items-center justify-between gap-2 ${col.headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          {order._offlinePending && (
            <span className="text-[9px] font-bold uppercase text-amber-200/90 bg-amber-500/20 border border-amber-500/35 rounded px-1 py-0.5 flex-shrink-0">
              Sync
            </span>
          )}
          <span className="font-mono font-bold text-amber-400 text-base leading-none flex-shrink-0">
            {order._offlinePending ? (
              <span title="Temporary until synced">#···</span>
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
        <ElapsedBadge createdAt={order.createdAt} />
      </div>

      {/* Item summary — lines marked delivered are excluded */}
      <div className="px-3 py-2.5 flex-1 space-y-1.5">
        {prepItems.length === 0 ? (
          <p className="text-xs text-slate-500 italic">All items marked delivered to table</p>
        ) : null}
        {preview.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {item.isCombo && <Link2 size={10} className="text-amber-400 flex-shrink-0" />}
              <span className={`text-sm truncate ${item.isCombo ? 'text-amber-300 font-medium' : 'text-slate-200'}`}>
                {item.name}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5 flex-shrink-0">
              ×{item.qty}
            </span>
          </div>
        ))}
        {overflow > 0 && (
          <p className="text-xs text-slate-600 italic">+{overflow} more item{overflow > 1 ? 's' : ''} — tap to see all</p>
        )}
      </div>

      {/* Footer: total qty + advance button */}
      <div className="px-3 pb-3 pt-1 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{totalQty} item{totalQty !== 1 ? 's' : ''} total</span>
          <span className="text-slate-700 text-xs group-hover:text-slate-500 transition">tap for details →</span>
        </div>
        {col.btnLabel && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdvance(order._id); }}
            disabled={isAdvancing}
            className={`w-full py-2.5 rounded-lg text-sm font-bold tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed ${col.btnClass}`}
          >
            {isAdvancing ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={13} className="animate-spin" /> Updating…
              </span>
            ) : col.btnLabel}
          </button>
        )}
        {!col.btnLabel && (
          <div className="w-full py-2 rounded-lg text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 text-center">
            ✓ Ready for pickup
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenColumn({ col, orders, onAdvance, onOpen, advancingId }) {
  return (
    <div className="flex flex-col min-h-0 min-w-0">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-1 pb-3 mb-3 border-b-2 ${col.border} flex-shrink-0`}>
        <div className={`w-3 h-3 rounded-full ${col.dot}`} />
        <h2 className={`font-bold text-sm uppercase tracking-widest ${col.color}`}>{col.label}</h2>
        <span className={`ml-auto text-xs font-bold rounded-full px-2.5 py-1 ${col.dot.replace('bg-', 'bg-').replace('-400', '-500/20')} ${col.color}`}>
          {orders.length}
        </span>
      </div>

      {/* Scrollable cards */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {orders.length === 0 ? (
          <div className={`text-center text-xs py-12 border border-dashed rounded-xl ${col.color} opacity-30`}>
            No {col.label.toLowerCase()} orders
          </div>
        ) : (
          orders.map(order => (
            <KitchenCard
              key={order._id}
              order={order}
              onAdvance={onAdvance}
              onOpen={onOpen}
              isAdvancing={advancingId === order._id}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function KitchenDisplay() {
  const qc = useQueryClient();
  const branding = useBranding();
  const { logout, user } = useAuth();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const selectedStore = useMemo(
    () => stores.find((s) => s._id === selectedStoreId) || stores.find((s) => s.isDefault) || null,
    [stores, selectedStoreId],
  );
  const navigate = useNavigate();
  const [advancingId, setAdvancingId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    setSelectedOrder(null);
  }, [selectedStoreId]);

  useEffect(() => {
    const bump = () => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
    };
    window.addEventListener('pos-offline-sync-done', bump);
    window.addEventListener('pos-offline-queue', bump);
    return () => {
      window.removeEventListener('pos-offline-sync-done', bump);
      window.removeEventListener('pos-offline-queue', bump);
    };
  }, [qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    qc.invalidateQueries({ queryKey: ['order-board'] });
  };

  const { data: orders = [], isPending, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['kitchen-orders', selectedStoreId],
    queryFn: async () => {
      const remote = await api.get('/orders?status=pending,preparing,ready').then((r) => r.data);
      const pendingLocal = await listPendingOrders();
      const merged = mergeOrderLists(remote, pendingLocal, selectedStoreId);
      return merged.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));
    },
    enabled: isStoreReady,
    refetchInterval: REFRESH_INTERVAL,
  });

  useSyncOfflineOrderSelection(orders, selectedOrder, setSelectedOrder);

  const advanceMutation = useMutation({
    mutationFn: async (id) => {
      try {
        await api.put(`/orders/${encodeURIComponent(id)}/clear-kitchen-new`);
      } catch (_) {
        /* non-fatal if route unavailable */
      }
      const { data } = await api.put(`/orders/${encodeURIComponent(id)}/status`);
      return data;
    },
    onMutate: (id) => setAdvancingId(id),
    onSuccess: (updatedOrder) => {
      invalidate();
      if (updatedOrder && shouldPrintReceiptForUpdatedOrder(branding, updatedOrder)) {
        printReceipt(updatedOrder, {
          branding,
          store: selectedStore,
          paymentType: updatedOrder.paymentType,
        });
      }
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to update status'),
    onSettled: () => setAdvancingId(null),
  });

  const grouped = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
  }), [orders]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';

  const totalActive = orders.length;

  const liveSelectedOrder = resolveLiveOrder(orders, selectedOrder);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="h-screen bg-[var(--pos-page-bg)] flex flex-col overflow-hidden">
      <OfflineBanner />
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/cafinity-logo.png" alt="Cafinity" className="h-8 w-auto object-contain rounded-md" />
          <span className="font-bold text-[var(--pos-text-primary)] text-sm tracking-wide hidden sm:block">Cafinity</span>
          <div className="w-px h-5 bg-slate-700" />
          <ChefHat size={16} className="text-amber-400" />
          <h1 className="text-sm font-bold text-[var(--pos-text-primary)] tracking-widest uppercase">Kitchen</h1>
          {totalActive > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {totalActive} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <RefreshCw size={11} className={isFetching ? 'animate-spin text-amber-400' : ''} />
            <span className="hidden sm:block">Auto-refresh · {lastUpdated}</span>
          </div>
          <AvatarMenu user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 p-4 min-h-0 overflow-hidden">
        {!isStoreReady || isPending ? (
          <div className="h-full min-h-0 py-2">
            <KitchenBoardSkeleton />
          </div>
        ) : totalActive === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-700">
            <ChefHat size={56} className="mb-4 opacity-20" />
            <p className="text-2xl font-bold">All caught up!</p>
            <p className="text-sm mt-1 opacity-60">No active orders right now</p>
          </div>
        ) : (
          <div className="h-full grid grid-cols-3 gap-4">
            {COLUMNS.map(col => (
              <KitchenColumn
                key={col.status}
                col={col}
                orders={grouped[col.status]}
                onAdvance={(id) => {
                  if (!advancingId) advanceMutation.mutate(id);
                }}
                onOpen={setSelectedOrder}
                advancingId={advancingId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail slide-over — kitchen cannot cancel */}
      <OrderDetailSlideOver
        order={liveSelectedOrder}
        onClose={() => setSelectedOrder(null)}
        canCancel={false}
      />
    </div>
  );
}
