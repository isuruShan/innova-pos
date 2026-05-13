import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, X, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useStoreContext } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

const FOHR_ROLES = new Set(['cashier', 'manager', 'merchant_admin']);

function WaiterCallDetailModal({ notification, order, orderLoading, orderError, onClose }) {
  const meta = notification?.meta || {};
  const tableLabel = meta.tableLabel || '—';
  const isOrder = meta.resourceType === 'order' && meta.resourceId;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiter-call-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-[var(--pos-panel)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-700/60 bg-amber-500/10">
          <div className="min-w-0">
            <h2 id="waiter-call-title" className="text-base font-bold text-[var(--pos-text-primary)]">
              Guest called waiter
            </h2>
            <p className="text-sm text-amber-200/90 mt-0.5">
              Table <span className="font-mono font-semibold">{tableLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-800/80 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-sm text-slate-300 max-h-[min(70vh,28rem)] overflow-y-auto">
          {notification?.body && <p className="text-slate-400">{notification.body}</p>}

          {isOrder ? (
            <>
              {orderLoading && (
                <div className="flex items-center gap-2 text-slate-500 py-6 justify-center">
                  <Loader2 className="animate-spin w-5 h-5" /> Loading order…
                </div>
              )}
              {orderError && (
                <p className="text-red-400 text-sm">Could not load order details. Open the order board for this table.</p>
              )}
              {order && !orderLoading && (
                <div className="rounded-xl border border-slate-700/50 bg-[var(--pos-surface-inset)] p-3 space-y-2">
                  <div className="flex justify-between gap-2 text-[var(--pos-text-primary)] font-semibold">
                    <span className="font-mono">#{String(order.orderNumber).padStart(3, '0')}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">{order.status}</span>
                  </div>
                  <ul className="divide-y divide-slate-700/40 text-xs">
                    {(order.items || []).map((line, i) => (
                      <li key={line._id || i} className="py-1.5 flex justify-between gap-2">
                        <span className="truncate">{line.name}</span>
                        <span className="text-slate-500 shrink-0">×{line.qty}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between text-[var(--pos-text-primary)] font-bold pt-2 border-t border-slate-700/40">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500 text-sm">There is no open tab on this table yet. Check the floor for table {tableLabel}.</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-medium text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WaiterCallBar() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [active, setActive] = useState(null);

  const role = String(user?.role || '').toLowerCase();
  const enabled =
    !!user?.tenantId &&
    FOHR_ROLES.has(role) &&
    isStoreReady &&
    !!selectedStoreId;

  const { data: items = [] } = useQuery({
    queryKey: ['waiter-call-notifications', selectedStoreId],
    queryFn: () =>
      api
        .get('/notifications', {
          params: {
            type: 'table_waiter_call',
            unread: '1',
            limit: 25,
            storeId: selectedStoreId,
          },
        })
        .then((r) => r.data),
    enabled,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });

  const orderId =
    active?.meta?.resourceType === 'order' && active?.meta?.resourceId ? active.meta.resourceId : null;

  const { data: order, isPending: orderLoading, isError: orderLoadError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get(`/orders/${encodeURIComponent(orderId)}`).then((r) => r.data),
    enabled: !!orderId && !!active,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['waiter-call-notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    qc.invalidateQueries({ queryKey: ['notifications-all'] });
  };

  const onChip = async (n) => {
    if (!n.readAt) {
      try {
        await api.patch(`/notifications/${encodeURIComponent(n._id)}/read`);
        invalidate();
      } catch {
        /* still show modal */
      }
    }
    setActive(n);
  };

  if (!enabled || !items.length) return null;

  return (
    <>
      <div className="border-b border-amber-500/25 bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 px-3 py-2 flex items-center gap-2 shrink-0 z-[55]">
        <BellRing size={16} className="text-amber-400 shrink-0 animate-pulse" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90 shrink-0 hidden sm:inline">
          Waiter calls
        </span>
        <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto pb-0.5">
          {items.map((n) => (
            <button
              key={n._id}
              type="button"
              onClick={() => onChip(n)}
              className="shrink-0 max-w-[14rem] text-left px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/35 hover:bg-amber-500/25 transition text-xs text-amber-50"
            >
              <span className="font-semibold line-clamp-2">{n.title}</span>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <WaiterCallDetailModal
          notification={active}
          order={order}
          orderLoading={orderLoading}
          orderError={orderLoadError}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
