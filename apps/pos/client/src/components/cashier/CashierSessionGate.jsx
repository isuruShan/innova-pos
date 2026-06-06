import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, X, BarChart2, CreditCard, DollarSign, ClipboardCheck, FileText } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { useBranding } from '../../context/BrandingContext';
import { formatCurrency, formatDateTime, formatPaymentTypeLabel } from '../../utils/format';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { CashierSessionContext, CASHIER_SESSION_QUERY_KEY } from './cashierSessionContext';
import { printDayEndReport, printSessionReport } from '../../utils/printDayEndReport';

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
    <div className="space-y-3 mb-5">
      {/* Sales breakdown */}
      <div className="rounded-xl border border-slate-700/70 bg-[var(--pos-surface-inset)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/40">
          <BarChart2 size={13} className="text-slate-400" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sales summary</p>
        </div>
        <div className="p-4 space-y-2 text-sm">
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
          {breakdown.otherSales > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Other sales</span>
              <span className="tabular-nums font-medium text-[var(--pos-text-primary)]">
                {formatCurrency(breakdown.otherSales ?? 0)}
              </span>
            </div>
          )}
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
          <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-700/50">
            <span className="text-slate-500">Discounts given</span>
            <span className="tabular-nums font-medium text-rose-300/90">
              − {formatCurrency(breakdown.totalDiscounts ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Cash movements */}
      {(cashInTotal > 0 || cashOutTotal > 0) && (
        <div className="rounded-xl border border-slate-700/70 bg-[var(--pos-surface-inset)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/40">
            <CreditCard size={13} className="text-slate-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cash movements</p>
          </div>
          <div className="p-3 space-y-2 max-h-36 overflow-y-auto">
            {movements.filter((m) => m.kind === 'cash_in').map((m, idx) => (
              <div key={`in-${idx}`} className="flex items-start justify-between gap-2 text-xs rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
                <div>
                  <span className="text-emerald-400 font-semibold">+{formatCurrency(m.amount)}</span>
                  {m.notes && <p className="text-slate-400 mt-0.5">{m.notes}</p>}
                </div>
                <span className="text-slate-500 shrink-0">{formatDateTime(m.createdAt)}</span>
              </div>
            ))}
            {movements.filter((m) => m.kind === 'cash_out').map((m, idx) => (
              <div key={`out-${idx}`} className="flex items-start justify-between gap-2 text-xs rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                <div>
                  <span className="text-amber-300 font-semibold">− {formatCurrency(m.amount)}</span>
                  {m.notes && <p className="text-slate-400 mt-0.5">{m.notes}</p>}
                </div>
                <span className="text-slate-500 shrink-0">{formatDateTime(m.createdAt)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-2 text-xs pt-1 border-t border-slate-700/50">
              <span className="text-slate-500">Net cash in / out</span>
              <span className={`tabular-nums font-semibold ${(netCashMovements ?? 0) >= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                {(netCashMovements ?? 0) >= 0 ? '+' : ''}{formatCurrency(netCashMovements ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Expected drawer total */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-slate-300">Expected in drawer</span>
        </div>
        <span className="tabular-nums font-bold text-amber-400 text-lg">{formatCurrency(expectedCashInDrawer ?? 0)}</span>
      </div>
    </div>
  );
}

export default function CashierSessionGate({ children, requireSession = false }) {
  const { user } = useAuth();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const branding = useBranding();
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const role = String(user?.role || '').toLowerCase();
  const isCashier = role === 'cashier';
  const sessionRequired = isCashier || Boolean(requireSession);

  const [closeOpen, setCloseOpen] = useState(false);
  const [countInput, setCountInput] = useState('');
  const [floatInput, setFloatInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [closeNoteError, setCloseNoteError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [cashMovementKind, setCashMovementKind] = useState(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [closedSession, setClosedSession] = useState(null); // holds session data after close

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [CASHIER_SESSION_QUERY_KEY, selectedStoreId],
    queryFn: () => api.get('/cashier-sessions/current').then((r) => r.data),
    enabled: Boolean(sessionRequired && isStoreReady && online),
    staleTime: 5_000,
    refetchInterval: 60_000,
  });

  const session = data?.session;
  const expected = data?.expectedCashInDrawer;
  const cashSalesSoFar = data?.cashSalesSoFar;
  const breakdown = data?.breakdown;
  const cashInTotal = data?.cashInTotal;
  const cashOutTotal = data?.cashOutTotal;
  const netCashMovements = data?.netCashMovements;

  const gateActive = sessionRequired && isStoreReady && online;
  const needsSession = gateActive && !session && !isError;
  const showSessionLoading = gateActive && needsSession && isPending;
  const showOpenForm = gateActive && needsSession && !isPending;

  const { data: suggestedOpeningData } = useQuery({
    queryKey: ['cashier-suggested-opening', selectedStoreId],
    queryFn: () => api.get('/cashier-sessions/suggested-opening').then((r) => r.data),
    enabled: Boolean(sessionRequired && isStoreReady && online && needsSession && !isPending),
    staleTime: 30_000,
  });

  const openMutation = useMutation({
    mutationFn: ({ openingCashBalance, openingNotes }) =>
      api.post('/cashier-sessions/open', { openingCashBalance, openingNotes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] }),
  });

  // Query active orders when close modal is open to block close if orders pending
  const { data: ongoingOrdersData } = useQuery({
    queryKey: ['cashier-ongoing-orders', session?._id],
    queryFn: () => api.get('/orders', { params: { status: 'pending,preparing,ready' } }).then((r) => r.data),
    enabled: Boolean(closeOpen && session?._id && !closedSession),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const ongoingCount = Array.isArray(ongoingOrdersData) ? ongoingOrdersData.length : 0;

  const closeMutation = useMutation({
    mutationFn: ({ id, closingCountedCash, floatAmount, varianceNotes }) =>
      api.post(`/cashier-sessions/${id}/close`, { closingCountedCash, floatAmount, varianceNotes }),
    onSuccess: (responseData) => {
      qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] });
      const sessionData = responseData?.data?.session || responseData?.session;
      setClosedSession(sessionData || { _closed: true });
      setCountInput('');
      setFloatInput('');
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

  const openCloseModal = useCallback(() => {
    setCloseOpen(true);
    setCountInput(expected != null ? String(expected) : '');
    setFloatInput(''); // Empty by default, user can set desired float
  }, [expected]);

  const openCashMovementModal = useCallback((kind) => {
    setCashMovementKind(kind);
    setMovementAmount('');
    setMovementNotes('');
  }, []);

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

  const [openingCashInput, setOpeningCashInput] = useState('');
  const [openingNotesInput, setOpeningNotesInput] = useState('');
  const [openingNoteError, setOpeningNoteError] = useState('');

  // Update inputs when suggested balance loaded
  useEffect(() => {
    if (suggestedOpeningData && suggestedOpeningData.suggestedOpening != null) {
      setOpeningCashInput(String(suggestedOpeningData.suggestedOpening));
    }
  }, [suggestedOpeningData]);

  const suggestedVal = suggestedOpeningData?.suggestedOpening ?? 0;
  const openingVal = parseFloat(openingCashInput) || 0;
  const isOpeningDiff = suggestedOpeningData?.hasLastSession && Math.abs(openingVal - suggestedVal) > VARIANCE_EPSILON;

  if (!sessionRequired || !isStoreReady) {
    return children;
  }

  if (!online) {
    return children;
  }

  const openSubmit = (e) => {
    e.preventDefault();
    const v = parseFloat(openingCashInput);
    if (!Number.isFinite(v) || v < 0) return;
    if (isOpeningDiff && !openingNotesInput.trim()) {
      setOpeningNoteError('Variance notes are required when opening cash differs from suggested float.');
      return;
    }
    setOpeningNoteError('');
    openMutation.mutate({
      openingCashBalance: Math.round(v * 100) / 100,
      openingNotes: isOpeningDiff ? openingNotesInput.trim() : '',
    });
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
      floatAmount: floatInput.trim() ? parseFloat(floatInput) : undefined,
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

  const handleGenerateReport = async (sessionForReport, forceDayEnd = false) => {
    setReportLoading(true);
    try {
      const src = forceDayEnd ? null : (sessionForReport || closedSession);
      if (src && !src._closed) {
        // Use session close data for richer report
        printSessionReport(
          src,
          branding?.businessName || '',
          branding?.currencySymbol || 'Rs.',
        );
      } else {
        // Fallback: day-end summary for today
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: reportData } = await api.get(`/reports/day-end?date=${todayStr}`);
        printDayEndReport(
          reportData,
          branding?.businessName || '',
          todayStr,
          branding?.currencySymbol || 'Rs.',
        );
      }
    } catch {
      // Silently ignore – print window will be empty or blocked
    } finally {
      setReportLoading(false);
    }
  };

  const handleDoneAfterClose = () => {
    setCloseOpen(false);
    setClosedSession(null);
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
                <h2 className="text-lg font-bold text-[var(--pos-text-primary)]">
                  {isCashier ? 'Start cashier session' : 'Start register session'}
                </h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                {isCashier
                  ? 'Enter the opening cash in the drawer before taking orders at this store.'
                  : 'Open your drawer session before using the register. Order board shows all active store orders; session totals track your drawer.'}
              </p>
              <label htmlFor="opening-cash" className="block text-sm text-slate-300 mb-2">
                Opening cash balance
              </label>
              {suggestedOpeningData?.hasLastSession && (
                <button
                  type="button"
                  className="w-full mb-2 flex items-center justify-between gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 hover:bg-emerald-500/15 transition text-left"
                  onClick={() => {
                    setOpeningCashInput(String(suggestedOpeningData.suggestedOpening || 0));
                    setOpeningNoteError('');
                  }}
                >
                  <span>
                    💡 Suggested from last session ({suggestedOpeningData.source === 'float' ? 'drawer float' : 'closing balance'})
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">{formatCurrency(suggestedOpeningData.suggestedOpening || 0)} ↵</span>
                </button>
              )}
              <input
                id="opening-cash"
                name="opening"
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                value={openingCashInput}
                onChange={(e) => {
                  setOpeningCashInput(e.target.value);
                  setOpeningNoteError('');
                }}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-lg font-semibold tabular-nums"
              />
              {isOpeningDiff && (
                <div className="mt-4">
                  <label htmlFor="opening-notes" className="block text-sm text-slate-300 mb-2">
                    Opening variance reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="opening-notes"
                    name="openingNotes"
                    required
                    value={openingNotesInput}
                    onChange={(e) => {
                      setOpeningNotesInput(e.target.value);
                      setOpeningNoteError('');
                    }}
                    placeholder="Provide a reason for starting with a different cash balance..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder-slate-600"
                  />
                </div>
              )}
              {openingNoteError && (
                <p className="text-red-400 text-sm mt-2">{openingNoteError}</p>
              )}
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

        {closeOpen && closedSession && (
          <div className="fixed inset-0 z-[301] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="bg-[var(--pos-panel)] border border-slate-600/80 rounded-2xl max-w-lg w-full shadow-2xl shadow-black/60 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60 bg-slate-800/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                  <ClipboardCheck size={18} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[var(--pos-text-primary)] leading-tight">Session closed</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Your cashier session has been closed successfully.</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {closedSession.sessionCloseBreakdown && (
                  <div className="rounded-xl border border-slate-700/60 bg-[var(--pos-surface-inset)] p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Cashier</span>
                      <span className="text-[var(--pos-text-primary)] font-medium">{closedSession.cashierId?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Opened</span>
                      <span className="text-[var(--pos-text-primary)] tabular-nums">{formatDateTime(closedSession.openedAt)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Closed</span>
                      <span className="text-[var(--pos-text-primary)] tabular-nums">{formatDateTime(closedSession.closedAt)}</span>
                    </div>
                    <div className="border-t border-slate-700/50 pt-2 mt-2 space-y-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Total orders</span>
                        <span className="font-semibold text-[var(--pos-text-primary)]">{closedSession.sessionCloseBreakdown.orderCount ?? 0}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Cash sales</span>
                        <span className="font-semibold text-amber-400">{formatCurrency(closedSession.sessionCloseBreakdown.cashSales ?? 0)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Card sales</span>
                        <span className="font-medium text-[var(--pos-text-primary)]">{formatCurrency(closedSession.sessionCloseBreakdown.cardSales ?? 0)}</span>
                      </div>
                      {closedSession.varianceAmount != null && closedSession.varianceAmount !== 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Variance</span>
                          <span className={`font-semibold ${closedSession.varianceAmount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {closedSession.varianceAmount > 0 ? '+' : ''}{formatCurrency(closedSession.varianceAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleGenerateReport(closedSession)}
                  disabled={reportLoading}
                  className="w-full py-2.5 rounded-xl border border-slate-600/70 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <FileText size={14} />
                  {reportLoading ? 'Preparing report…' : 'Print session report (PDF)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateReport(null, true)}
                  disabled={reportLoading}
                  className="w-full py-2.5 rounded-xl border border-slate-600/70 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <FileText size={14} />
                  {reportLoading ? 'Preparing report…' : 'Generate day-end report (PDF)'}
                </button>
                <button
                  type="button"
                  onClick={handleDoneAfterClose}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {closeOpen && session && !closedSession && (
          <div className="fixed inset-0 z-[301] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="bg-[var(--pos-panel)] border border-slate-600/80 rounded-2xl max-w-lg w-full shadow-2xl shadow-black/60 relative max-h-[min(94vh,44rem)] flex flex-col overflow-hidden">
              {/* Modal header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60 bg-slate-800/50 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                  <Wallet size={18} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[var(--pos-text-primary)] leading-tight">Close drawer session</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Expected: <span className="text-amber-400 font-semibold tabular-nums">{formatCurrency(expected ?? 0)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    if (closeMutation.isPending) return;
                    setCloseOpen(false);
                    setCloseNoteError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
                {/* Section 1: Session summary */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0">1</span>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session summary</h4>
                  </div>
                  <SessionBreakdownSummary
                    openingCashBalance={session.openingCashBalance}
                    breakdown={breakdown}
                    cashMovements={session.cashMovements}
                    cashInTotal={cashInTotal}
                    cashOutTotal={cashOutTotal}
                    netCashMovements={netCashMovements}
                    expectedCashInDrawer={expected}
                  />
                </section>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700/60" />
                  </div>
                </div>

                {/* Section 2: Cash count & float */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0">2</span>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash count</h4>
                  </div>
                  <form onSubmit={submitClose} className="space-y-4">
                    <div className="rounded-xl border border-slate-700/60 bg-[var(--pos-surface-inset)] p-4 space-y-4">
                      <div>
                        <label htmlFor="counted-cash" className="block text-sm font-medium text-slate-300 mb-1.5">
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
                          className="w-full px-4 py-3 rounded-xl bg-[var(--pos-panel)] border border-slate-600 text-[var(--pos-text-primary)] text-xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                      <div>
                        <label htmlFor="float-amount" className="block text-sm font-medium text-slate-300 mb-1.5">
                          Float for next session
                          <span className="text-xs text-slate-500 ml-2 font-normal">(optional)</span>
                        </label>
                        <input
                          id="float-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={floatInput}
                          onChange={(e) => {
                            setFloatInput(e.target.value);
                            setCloseNoteError('');
                          }}
                          placeholder="0.00"
                          className="w-full px-4 py-3 rounded-xl bg-[var(--pos-panel)] border border-slate-600 text-[var(--pos-text-primary)] text-lg font-semibold tabular-nums placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                        <p className="text-xs text-slate-500 mt-1.5">Stays in drawer as opening balance for next session</p>
                      </div>
                    </div>

                    {/* Section 3: Notes */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0">3</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</h4>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-[var(--pos-surface-inset)] p-4">
                        <label htmlFor="variance-notes" className="block text-sm font-medium text-slate-300 mb-1.5">
                          Variance / closure notes
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
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--pos-panel)] border border-slate-600 text-[var(--pos-text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder-slate-600"
                        />
                      </div>
                    </div>

                    {/* Ongoing orders warning */}
                    {ongoingCount > 0 && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-1">
                        <p className="text-amber-400 text-sm font-semibold">
                          ⚠️ {ongoingCount} ongoing order{ongoingCount > 1 ? 's' : ''} in queue
                        </p>
                        <p className="text-amber-300/70 text-xs mt-1">
                          All orders must be completed or cancelled before closing the session.
                        </p>
                      </div>
                    )}

                    {closeNoteError && (
                      <p className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                        {closeNoteError}
                      </p>
                    )}
                    {closeMutation.isError && (
                      <p className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                        {closeMutation.error?.response?.data?.message || 'Close failed'}
                      </p>
                    )}



                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={closeMutation.isPending || ongoingCount > 0}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ClipboardCheck size={16} />
                      {closeMutation.isPending ? 'Closing…' : ongoingCount > 0 ? `${ongoingCount} order${ongoingCount > 1 ? 's' : ''} pending` : 'Confirm & close session'}
                    </button>
                  </form>
                </section>
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
