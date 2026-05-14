import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, X } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, formatDateTime, formatPaymentTypeLabel } from '../../utils/format';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { CashierSessionContext, CASHIER_SESSION_QUERY_KEY } from './cashierSessionContext';

export { CASHIER_SESSION_QUERY_KEY } from './cashierSessionContext';

const VARIANCE_EPSILON = 0.005;

function sortMovementsNewestFirst(movements) {
  const list = Array.isArray(movements) ? [...movements] : [];
  return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function SessionBreakdownSummary({
  openingCashBalance,
  breakdown,
  cashMovements,
  cashInTotal,
  cashOutTotal,
  netCashMovements,
  expectedCashInDrawer,
}) {
  if (!breakdown) return null;

  const movements = sortMovementsNewestFirst(cashMovements);
  const otherRows = (breakdown.salesByPaymentType || []).filter((row) => {
    const pt = String(row.paymentType || '').toLowerCase();
    return pt !== 'cash' && pt !== 'card';
  });

  return (
    <div className="rounded-xl border border-slate-600/60 bg-[var(--pos-surface-inset)]/50 p-4 mb-4 max-h-[min(50vh,22rem)] overflow-y-auto text-sm space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Session summary</p>

      <div className="space-y-1.5 text-slate-300">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Opening cash</span>
          <span className="tabular-nums font-medium text-[var(--pos-text-primary)]">
            {formatCurrency(openingCashBalance ?? 0)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Cash sales</span>
          <span className="tabular-nums font-semibold text-amber-400">{formatCurrency(breakdown.cashSales ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Card sales</span>
          <span className="tabular-nums font-medium text-[var(--pos-text-primary)]">
            {formatCurrency(breakdown.cardSales ?? 0)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Other sales</span>
          <span className="tabular-nums font-medium text-[var(--pos-text-primary)]">
            {formatCurrency(breakdown.otherSales ?? 0)}
          </span>
        </div>
        {otherRows.length > 0 && (
          <ul className="pl-3 border-l border-slate-600/80 space-y-1 text-xs text-slate-400">
            {otherRows.map((row) => (
              <li key={row.paymentType} className="flex justify-between gap-2">
                <span>{formatPaymentTypeLabel(row.paymentType)}</span>
                <span className="tabular-nums shrink-0">{formatCurrency(row.revenue ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between gap-2 pt-1 border-t border-slate-600/50">
          <span className="text-slate-500">Discounts given</span>
          <span className="tabular-nums font-medium text-rose-300/90">
            {formatCurrency(breakdown.totalDiscounts ?? 0)}
          </span>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2">Cash in ({formatCurrency(cashInTotal ?? 0)})</p>
        {movements.filter((m) => m.kind === 'cash_in').length === 0 ? (
          <p className="text-xs text-slate-500">No cash in entries.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {movements
              .filter((m) => m.kind === 'cash_in')
              .map((m, idx) => (
                <li key={`in-${idx}-${m.createdAt}`} className="rounded-lg bg-slate-800/40 px-2 py-1.5 border border-slate-700/50">
                  <div className="flex justify-between gap-2 text-[var(--pos-text-primary)]">
                    <span className="text-emerald-400 font-semibold tabular-nums">+{formatCurrency(m.amount)}</span>
                    <span className="text-slate-500 shrink-0">{formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.notes ? <p className="text-slate-400 mt-1 leading-snug">{m.notes}</p> : null}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2">Cash out ({formatCurrency(cashOutTotal ?? 0)})</p>
        {movements.filter((m) => m.kind === 'cash_out').length === 0 ? (
          <p className="text-xs text-slate-500">No cash out entries.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {movements
              .filter((m) => m.kind === 'cash_out')
              .map((m, idx) => (
                <li key={`out-${idx}-${m.createdAt}`} className="rounded-lg bg-slate-800/40 px-2 py-1.5 border border-slate-700/50">
                  <div className="flex justify-between gap-2 text-[var(--pos-text-primary)]">
                    <span className="text-amber-300 font-semibold tabular-nums">−{formatCurrency(m.amount)}</span>
                    <span className="text-slate-500 shrink-0">{formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.notes ? <p className="text-slate-400 mt-1 leading-snug">{m.notes}</p> : null}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between gap-2 text-xs border-t border-slate-600/50 pt-2">
        <span className="text-slate-500">Net cash in / out</span>
        <span
          className={`tabular-nums font-semibold ${
            (netCashMovements ?? 0) >= 0 ? 'text-emerald-400' : 'text-amber-300'
          }`}
        >
          {(netCashMovements ?? 0) >= 0 ? '+' : ''}
          {formatCurrency(netCashMovements ?? 0)}
        </span>
      </div>

      <div className="flex justify-between gap-2 pt-1 border-t border-amber-500/25">
        <span className="text-slate-400 font-medium">Expected in drawer</span>
        <span className="tabular-nums font-bold text-amber-400">{formatCurrency(expectedCashInDrawer ?? 0)}</span>
      </div>
    </div>
  );
}

export default function CashierSessionGate({ children }) {
  const { user } = useAuth();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const role = String(user?.role || '').toLowerCase();
  const isCashier = role === 'cashier';

  const [closeOpen, setCloseOpen] = useState(false);
  const [countInput, setCountInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [closeNoteError, setCloseNoteError] = useState('');
  const [cashMovementKind, setCashMovementKind] = useState(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNotes, setMovementNotes] = useState('');

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [CASHIER_SESSION_QUERY_KEY, selectedStoreId],
    queryFn: () => api.get('/cashier-sessions/current').then((r) => r.data),
    enabled: Boolean(isCashier && isStoreReady && online),
    staleTime: 5_000,
    refetchInterval: 60_000,
  });

  const openMutation = useMutation({
    mutationFn: (openingCashBalance) =>
      api.post('/cashier-sessions/open', { openingCashBalance }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] }),
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, closingCountedCash, varianceNotes }) =>
      api.post(`/cashier-sessions/${id}/close`, { closingCountedCash, varianceNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] });
      setCloseOpen(false);
      setCountInput('');
      setNotesInput('');
      setCloseNoteError('');
    },
  });

  const cashMovementMutation = useMutation({
    mutationFn: ({ id, kind, amount, notes }) =>
      api.post(`/cashier-sessions/${id}/movements`, { kind, amount, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] });
      setCashMovementKind(null);
      setMovementAmount('');
      setMovementNotes('');
    },
  });

  const session = data?.session;
  const expected = data?.expectedCashInDrawer;
  const cashSalesSoFar = data?.cashSalesSoFar;
  const breakdown = data?.breakdown;
  const cashInTotal = data?.cashInTotal;
  const cashOutTotal = data?.cashOutTotal;
  const netCashMovements = data?.netCashMovements;

  const openCloseModal = useCallback(() => {
    setCloseOpen(true);
    setCountInput(expected != null ? String(expected) : '');
  }, [expected]);

  const openCashMovementModal = useCallback((kind) => {
    setCashMovementKind(kind);
    setMovementAmount('');
    setMovementNotes('');
  }, []);

  const gateActive = isCashier && isStoreReady && online;
  const needsSession = gateActive && !session && !isError;
  const showSessionLoading = gateActive && needsSession && isPending;
  const showOpenForm = gateActive && needsSession && !isPending;

  const ctxValue = useMemo(
    () => {
      if (!gateActive) return null;
      return {
        session,
        expected,
        cashSalesSoFar,
        breakdown,
        cashInTotal,
        cashOutTotal,
        netCashMovements,
        isError,
        refetch,
        showSessionLoading,
        needsSession,
        openCloseModal,
        openCashMovementModal,
        closeMutationPending: closeMutation.isPending,
        cashMovementMutationPending: cashMovementMutation.isPending,
      };
    },
    [
      gateActive,
      session,
      expected,
      cashSalesSoFar,
      breakdown,
      cashInTotal,
      cashOutTotal,
      netCashMovements,
      isError,
      refetch,
      showSessionLoading,
      needsSession,
      openCloseModal,
      openCashMovementModal,
      closeMutation.isPending,
      cashMovementMutation.isPending,
    ],
  );

  if (!isCashier || !isStoreReady) {
    return children;
  }

  if (!online) {
    return children;
  }

  const openSubmit = (e) => {
    e.preventDefault();
    const raw = e.target.elements.opening?.value;
    const v = parseFloat(raw, 10);
    if (!Number.isFinite(v) || v < 0) return;
    openMutation.mutate(Math.round(v * 100) / 100);
  };

  const submitClose = (e) => {
    e.preventDefault();
    const c = parseFloat(countInput, 10);
    if (!Number.isFinite(c) || c < 0 || !session?._id) return;
    const rounded = Math.round(c * 100) / 100;
    const exp = expected ?? 0;
    if (Math.abs(rounded - exp) > VARIANCE_EPSILON && !notesInput.trim()) {
      setCloseNoteError('Notes are required when counted cash differs from the expected amount.');
      return;
    }
    setCloseNoteError('');
    closeMutation.mutate({
      id: session._id,
      closingCountedCash: rounded,
      varianceNotes: notesInput.trim(),
    });
  };

  const submitCashMovement = (e) => {
    e.preventDefault();
    if (!session?._id || !cashMovementKind) return;
    const amt = parseFloat(String(movementAmount).replace(/,/g, ''), 10);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const kind = cashMovementKind === 'in' ? 'cash_in' : 'cash_out';
    cashMovementMutation.mutate({
      id: session._id,
      kind,
      amount: Math.round(amt * 100) / 100,
      notes: movementNotes.trim(),
    });
  };

  return (
    <CashierSessionContext.Provider value={ctxValue}>
      <div className="relative min-h-screen flex flex-col">
        {showSessionLoading && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4">
            <p className="text-slate-300 text-sm font-medium">Checking cashier session…</p>
          </div>
        )}

        {isError && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl p-6 max-w-md w-full text-center">
              <p className="text-[var(--pos-text-primary)] font-medium mb-3">Could not load cashier session</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {showOpenForm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4">
            <form
              onSubmit={openSubmit}
              className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Wallet size={20} />
                </span>
                <h2 className="text-lg font-bold text-[var(--pos-text-primary)]">Start cashier session</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Enter the opening cash in the drawer before taking orders at this store.
              </p>
              <label htmlFor="opening-cash" className="block text-sm text-slate-300 mb-2">
                Opening cash balance
              </label>
              <input
                id="opening-cash"
                name="opening"
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-lg font-semibold tabular-nums"
              />
              {openMutation.isError && (
                <p className="text-red-400 text-sm mt-2">
                  {openMutation.error?.response?.data?.message || 'Could not start session'}
                </p>
              )}
              <button
                type="submit"
                disabled={openMutation.isPending}
                className="mt-5 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold disabled:opacity-50"
              >
                {openMutation.isPending ? 'Starting…' : 'Start session'}
              </button>
            </form>
          </div>
        )}

        {cashMovementKind && session && (
          <div className="fixed inset-0 z-[302] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (cashMovementMutation.isPending) return;
                  setCashMovementKind(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-[var(--pos-text-primary)] pr-8 mb-1">
                {cashMovementKind === 'in' ? 'Cash in' : 'Cash out'}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {cashMovementKind === 'in'
                  ? 'Record cash added to the drawer (e.g. change fund). This increases the expected drawer balance.'
                  : 'Record cash removed from the drawer (e.g. safe drop). This decreases the expected drawer balance.'}
              </p>
              <form onSubmit={submitCashMovement} className="space-y-4">
                <div>
                  <label htmlFor="movement-amount" className="block text-sm text-slate-300 mb-1">
                    Amount
                  </label>
                  <input
                    id="movement-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-lg font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="movement-notes" className="block text-sm text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="movement-notes"
                    rows={3}
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="Optional context for this entry"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-sm resize-none"
                  />
                </div>
                {cashMovementMutation.isError && (
                  <p className="text-red-400 text-sm">
                    {cashMovementMutation.error?.response?.data?.message || 'Could not save'}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={cashMovementMutation.isPending}
                  className={`w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 ${
                    cashMovementKind === 'in' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {cashMovementMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </form>
            </div>
          </div>
        )}

        {closeOpen && session && (
          <div className="fixed inset-0 z-[301] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[min(92vh,40rem)] flex flex-col">
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (closeMutation.isPending) return;
                  setCloseOpen(false);
                  setCloseNoteError('');
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-[var(--pos-text-primary)] pr-8 mb-1 shrink-0">Close session</h3>
              <p className="text-sm text-slate-400 mb-3 shrink-0">
                Review the session totals, then count the cash. Add a note if the physical count does not match the
                expected amount ({formatCurrency(expected ?? 0)}).
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <SessionBreakdownSummary
                  openingCashBalance={session.openingCashBalance}
                  breakdown={breakdown}
                  cashMovements={session.cashMovements}
                  cashInTotal={cashInTotal}
                  cashOutTotal={cashOutTotal}
                  netCashMovements={netCashMovements}
                  expectedCashInDrawer={expected}
                />
                <form onSubmit={submitClose} className="space-y-4 pb-1">
                  <div>
                    <label htmlFor="counted-cash" className="block text-sm text-slate-300 mb-1">
                      Physical cash counted
                    </label>
                    <input
                      id="counted-cash"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={countInput}
                      onChange={(e) => {
                        setCountInput(e.target.value);
                        setCloseNoteError('');
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-lg font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="variance-notes" className="block text-sm text-slate-300 mb-1">
                      Notes (shortage, overage, explanation)
                    </label>
                    <textarea
                      id="variance-notes"
                      rows={3}
                      value={notesInput}
                      onChange={(e) => {
                        setNotesInput(e.target.value);
                        setCloseNoteError('');
                      }}
                      placeholder="Required if counted cash ≠ expected"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-sm resize-none"
                    />
                  </div>
                  {closeNoteError && (
                    <p className="text-amber-400 text-sm">{closeNoteError}</p>
                  )}
                  {closeMutation.isError && (
                    <p className="text-red-400 text-sm">{closeMutation.error?.response?.data?.message || 'Close failed'}</p>
                  )}
                  <button
                    type="submit"
                    disabled={closeMutation.isPending}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                  >
                    {closeMutation.isPending ? 'Closing…' : 'Confirm close'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <div
          className={`flex-1 flex flex-col min-h-0 ${needsSession ? 'pointer-events-none select-none opacity-50' : ''}`}
        >
          {children}
        </div>
      </div>
    </CashierSessionContext.Provider>
  );
}
