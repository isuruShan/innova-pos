import { useState, useRef, useEffect, useMemo } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
import { formatCurrency, formatTime } from '../../utils/format';
import { useCashierSession } from './cashierSessionContext';

export default function CashierSessionNavButton() {
  const ctx = useCashierSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const summary = useMemo(() => {
    if (!ctx?.session) return null;
    const net = ctx.netCashMovements ?? 0;
    const netLabel =
      Math.abs(net) < 0.005 ? '' : ` · ${net >= 0 ? '+' : ''}${formatCurrency(net)} drawer adj.`;
    return {
      line2: `${formatCurrency(ctx.cashSalesSoFar ?? 0)} cash${netLabel}`,
      line3: `${formatCurrency(ctx.expected ?? 0)} expected`,
    };
  }, [ctx?.session, ctx?.cashSalesSoFar, ctx?.expected, ctx?.netCashMovements]);

  if (!ctx) return null;

  if (ctx.showSessionLoading) {
    return (
      <div
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 min-h-[42px] rounded-xl border border-white/10 bg-black/15 text-left max-w-[200px]"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
          <Wallet size={18} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Session</span>
          <span className="block text-xs text-slate-400 truncate">Checking…</span>
        </span>
      </div>
    );
  }

  if (ctx.isError) {
    return (
      <button
        type="button"
        onClick={() => ctx.refetch()}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 min-h-[42px] rounded-xl border border-red-500/30 bg-red-500/10 text-left max-w-[200px] text-red-200 text-xs font-medium"
      >
        Session error — tap to retry
      </button>
    );
  }

  if (!ctx.session) {
    return (
      <div
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 min-h-[42px] rounded-xl border border-white/10 bg-black/15 text-left max-w-[200px] opacity-80"
        style={{ color: 'var(--color-text)' }}
        title="Open or resume your drawer session from the prompt"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-600/40 text-slate-300 border border-white/10">
          <Wallet size={18} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Drawer</span>
          <span className="block text-xs truncate text-slate-400">No session</span>
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0 z-[60]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 min-h-[42px] rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 hover:border-amber-500/35 text-left transition shadow-sm max-w-[220px] sm:max-w-[260px]"
        style={{ color: 'var(--color-text)' }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
          <Wallet size={18} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Session</span>
          <span className="block text-sm font-semibold truncate leading-tight tabular-nums">
            {summary?.line2}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-[130] w-[min(calc(100vw-1.5rem),19rem)] rounded-xl border border-slate-600/80 bg-[var(--pos-panel)] shadow-2xl shadow-black/40 overflow-hidden py-2 px-3"
          role="dialog"
          aria-label="Cashier session details"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Drawer session</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex justify-between gap-2">
              <span className="text-slate-500">Started</span>
              <span className="text-[var(--pos-text-primary)] font-medium tabular-nums">{formatTime(ctx.session.openedAt)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-slate-500">Cash sales</span>
              <span className="text-amber-400 font-semibold tabular-nums">{formatCurrency(ctx.cashSalesSoFar ?? 0)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-slate-500">Expected in drawer</span>
              <span className="text-[var(--pos-text-primary)] font-bold tabular-nums">{formatCurrency(ctx.expected ?? 0)}</span>
            </li>
            {Math.abs(ctx.netCashMovements ?? 0) >= 0.005 && (
              <li className="flex justify-between gap-2 text-xs">
                <span className="text-slate-500">Net cash in / out</span>
                <span
                  className={`font-semibold tabular-nums ${
                    (ctx.netCashMovements ?? 0) >= 0 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {(ctx.netCashMovements ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(ctx.netCashMovements ?? 0)}
                </span>
              </li>
            )}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                ctx.openCashMovementModal('in');
              }}
              disabled={ctx.cashMovementMutationPending}
              className="py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold border border-emerald-500/40 disabled:opacity-50"
            >
              Cash in
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                ctx.openCashMovementModal('out');
              }}
              disabled={ctx.cashMovementMutationPending}
              className="py-2 rounded-xl bg-amber-700/70 hover:bg-amber-600 text-white text-xs font-semibold border border-amber-500/40 disabled:opacity-50"
            >
              Cash out
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              ctx.openCloseModal();
            }}
            disabled={ctx.closeMutationPending}
            className="mt-2 w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold border border-slate-500/50 disabled:opacity-50"
          >
            Close &amp; balance
          </button>
        </div>
      )}
    </div>
  );
}
