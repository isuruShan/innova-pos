import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, X } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, formatTime } from '../../utils/format';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const CASHIER_SESSION_QUERY_KEY = 'cashier-session';

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

  const session = data?.session;
  const expected = data?.expectedCashInDrawer;
  const cashSalesSoFar = data?.cashSalesSoFar;

  useEffect(() => {
    if (closeOpen && expected != null && countInput === '') {
      setCountInput(String(expected));
    }
  }, [closeOpen, expected, countInput]);

  if (!isCashier || !isStoreReady) {
    return children;
  }

  if (!online) {
    return children;
  }

  const needsSession = !session && !isError;
  const showSessionLoading = needsSession && isPending;
  const showOpenForm = needsSession && !isPending;

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
    closeMutation.mutate({
      id: session._id,
      closingCountedCash: Math.round(c * 100) / 100,
      varianceNotes: notesInput.trim(),
    });
  };

  return (
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

      {session && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[120] border-t border-slate-600/80 bg-[var(--pos-panel)]/95 backdrop-blur-sm px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Wallet size={16} />
                Session open
              </span>
              <span className="text-slate-400">
                Started {formatTime(session.openedAt)}
              </span>
              <span className="text-slate-300">
                Cash sales <span className="text-amber-400 font-semibold tabular-nums">{formatCurrency(cashSalesSoFar ?? 0)}</span>
              </span>
              <span className="text-slate-300">
                Expected in drawer{' '}
                <span className="text-[var(--pos-text-primary)] font-bold tabular-nums">{formatCurrency(expected ?? 0)}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCloseOpen(true);
                setCountInput(expected != null ? String(expected) : '');
              }}
              className="shrink-0 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold border border-slate-500/50"
            >
              Close &amp; balance
            </button>
          </div>
        </div>
      )}

      {closeOpen && session && (
        <div className="fixed inset-0 z-[301] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[var(--pos-panel)] border border-slate-600 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                if (closeMutation.isPending) return;
                setCloseOpen(false);
                setCloseNoteError('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-[var(--pos-text-primary)] pr-8 mb-1">Close session</h3>
            <p className="text-sm text-slate-400 mb-4">
              Count the cash and enter the total. Add a note if it does not match the expected amount (
              {formatCurrency(expected ?? 0)}).
            </p>
            <form onSubmit={submitClose} className="space-y-4">
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
      )}

      <div
        className={`flex-1 flex flex-col min-h-0 ${needsSession ? 'pointer-events-none select-none opacity-50' : ''} ${session ? 'pb-[92px]' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
