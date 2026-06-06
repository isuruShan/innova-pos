import { useMemo, useState, useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RotateCcw, Loader, Eye } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import CashierSessionGate from '../../components/cashier/CashierSessionGate';
import { useFohrMode } from '../../hooks/useFohrMode';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';
import ReturnApprovalModal from '../../components/cashier/ReturnApprovalModal';
import { limitedInputProps } from '@innovapos/form-validation/react';
import { CashierSessionContext } from '../../components/cashier/cashierSessionContext';

function remainingQty(order, item) {
  const lineId = String(item._id);
  let returned = 0;
  for (const ret of order.returns || []) {
    for (const li of ret.items || []) {
      if (String(li.lineId) === lineId) returned += Number(li.qty) || 0;
    }
  }
  return Math.max(0, (Number(item.qty) || 0) - returned);
}

export default function CashierOrderHistory() {
  const fohr = useFohrMode();
  const qc = useQueryClient();
  const { user } = useAuth();
  const sessionCtx = useContext(CashierSessionContext);
  const isCashier = String(user?.role || '').toLowerCase() === 'cashier';
  // For cashiers, restrict orders to their current session window
  const sessionSince = isCashier && sessionCtx?.session?.openedAt
    ? new Date(sessionCtx.session.openedAt).toISOString()
    : null;
  const [msg, setMsg] = useState('');
  const { isStoreReady } = useStoreContext();
  const [search, setSearch] = useState('');
  // Cashiers only see completed orders by default; lock status to completed for cashiers
  const [statusFilter, setStatusFilter] = useState('completed');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingReturn, setPendingReturn] = useState(null);

  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-settings-returns'],
    queryFn: () => api.get('/tenant-settings').then((r) => r.data),
    enabled: isStoreReady,
  });

  const searchParams = useMemo(() => {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    if (search.trim()) p.search = search.trim();
    // Cashiers: scope to their current session window
    if (sessionSince) p.since = sessionSince;
    return p;
  }, [search, statusFilter, sessionSince]);

  const { data: orders = [], isPending, refetch, isFetching } = useQuery({
    queryKey: ['cashier-order-history', searchParams],
    queryFn: () => api.get('/orders', { params: searchParams }).then((r) => r.data),
    enabled: isStoreReady,
  });

  const returnMutation = useMutation({
    mutationFn: ({ orderId, body }) => api.post(`/orders/${orderId}/returns`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashier-order-history'] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
      setMsg('Return recorded');
      setTimeout(() => setMsg(''), 3000);
      setReturnOrder(null);
      setReturnQty({});
      setReturnReason('');
      setApprovalOpen(false);
      setPendingReturn(null);
    },
    onError: (e) => setMsg(e.response?.data?.message || 'Return failed'),
  });

  const returnsEnabled = true;
  const requireApproval = tenantSettings?.returnsRequireManagerApproval !== false && user?.role !== 'merchant_admin';

  const openReturn = (order) => {
    const init = {};
    for (const item of order.items || []) {
      const rem = remainingQty(order, item);
      if (rem > 0) init[String(item._id)] = 0;
    }
    setReturnQty(init);
    setReturnReason('');
    setReturnOrder(order);
  };

  const buildReturnItems = () =>
    Object.entries(returnQty)
      .map(([lineId, qty]) => ({ lineId, qty: Number(qty) || 0 }))
      .filter((x) => x.qty > 0);

  const submitReturn = () => {
    if (!returnOrder) return;
    const items = buildReturnItems();
    if (!items.length) {
      setMsg('Enter quantity to return for at least one line');
      return;
    }
    const payload = { items, reason: returnReason.trim() };
    if (requireApproval) {
      setPendingReturn({ orderId: returnOrder._id, body: payload });
      setApprovalOpen(true);
      return;
    }
    returnMutation.mutate({ orderId: returnOrder._id, body: payload });
  };

  const onApproved = ({ managerId, approvalSecret }) => {
    if (!pendingReturn) return;
    returnMutation.mutate({
      orderId: pendingReturn.orderId,
      body: { ...pendingReturn.body, managerId, approvalSecret },
    });
  };

  const fullReturn = () => {
    if (!returnOrder) return;
    const next = {};
    for (const item of returnOrder.items || []) {
      const rem = remainingQty(returnOrder, item);
      if (rem > 0) next[String(item._id)] = rem;
    }
    setReturnQty(next);
  };

  const searchAttrs = limitedInputProps('searchQuery');

  return (
    <CashierSessionGate requireSession={fohr.requireCashierSession}>
      <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
        <Navbar groups={fohr.navGroups} />

        <div className="flex-1 p-4 sm:p-5 max-w-5xl mx-auto w-full space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Orders & returns</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Search past orders by order # or customer name. Process full or partial returns when enabled.
            </p>
          </div>

          {msg && (
            <p className="text-sm text-center py-2 rounded-lg bg-slate-800 text-amber-200 border border-slate-600">{msg}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order # or customer name"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-600 bg-[var(--pos-panel)] text-sm text-[var(--pos-text-primary)]"
                {...searchAttrs}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-[var(--pos-panel)] text-[var(--pos-text-primary)]"
            >
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="">All statuses</option>
            </select>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-4 py-2.5 rounded-xl border border-slate-600 text-sm text-slate-300 hover:bg-slate-800"
            >
              {isFetching ? <Loader size={14} className="animate-spin inline" /> : 'Refresh'}
            </button>
          </div>

          {isPending ? (
            <p className="text-slate-500 text-sm py-12 text-center">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="text-slate-500 text-sm py-12 text-center">No orders match your search.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o._id}
                  className="flex flex-wrap items-center gap-3 justify-between bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--pos-text-primary)]">
                      Order #{o.orderNumber}
                      <span className="text-slate-500 font-normal text-sm ml-2 capitalize">{o.status}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {o.customerId?.name || 'Walk-in'} · {new Date(o.createdAt).toLocaleString()}
                      {(o.totalReturnedAmount || 0) > 0 && (
                        <span className="text-amber-400 ml-2">
                          Returned: {Number(o.totalReturnedAmount).toFixed(2)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(o)}
                      className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-medium text-slate-200 inline-flex items-center gap-1"
                    >
                      <Eye size={14} /> View
                    </button>
                    {o.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => openReturn(o)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-semibold text-amber-200 inline-flex items-center gap-1"
                      >
                        <RotateCcw size={14} /> Return
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {returnOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60" onClick={() => setReturnOrder(null)}>
            <div
              className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-[var(--pos-text-primary)] mb-1">
                Return — Order #{returnOrder.orderNumber}
              </h2>
              <p className="text-xs text-slate-500 mb-4">Enter qty to refund per line (partial or full).</p>
              <button
                type="button"
                onClick={fullReturn}
                className="text-xs font-semibold text-amber-400 hover:underline mb-3"
              >
                Return all remaining items
              </button>
              <div className="space-y-3 mb-4">
                {(returnOrder.items || []).map((item) => {
                  const rem = remainingQty(returnOrder, item);
                  if (rem < 1) return null;
                  const id = String(item._id);
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-200 truncate block">{item.name}</span>
                        {item.variantName && (
                          <span className="text-[10px] text-amber-400/90 truncate block">↳ {item.variantName}</span>
                        )}
                      </div>
                      <span className="text-slate-500 text-xs shrink-0">max {rem}</span>
                      <input
                        type="number"
                        min={0}
                        max={rem}
                        value={returnQty[id] ?? 0}
                        onChange={(e) => {
                          const v = Math.min(rem, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setReturnQty((q) => ({ ...q, [id]: v }));
                        }}
                        className="w-16 border border-slate-600 rounded-lg px-2 py-1 text-center bg-slate-800 text-[var(--pos-text-primary)]"
                      />
                    </div>
                  );
                })}
              </div>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                maxLength={500}
                className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-800 text-[var(--pos-text-primary)] mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReturnOrder(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-sm text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitReturn}
                  disabled={returnMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {returnMutation.isPending ? 'Processing…' : requireApproval ? 'Request approval' : 'Process return'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ReturnApprovalModal
          open={approvalOpen}
          onClose={() => {
            setApprovalOpen(false);
            setPendingReturn(null);
          }}
          onApproved={onApproved}
        />

        <OrderDetailSlideOver order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      </div>
    </CashierSessionGate>
  );
}
