import { useState, useRef, useEffect, useMemo } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
import { formatCurrency, formatTime } from '../../utils/format';
import { useCashierSession } from './cashierSessionContext';
import useSwipeDismiss from '../../hooks/useSwipeDismiss';

export default function CashierSessionNavButton() {
  const ctx = useCashierSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { style, bind } = useSwipeDismiss({ onClose: () => setOpen(false), open });


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
        className="flex items-center gap-1 sm:gap-2 pl-2 pr-1.5 py-1.5 sm:pl-3 sm:pr-2.5 sm:py-2 min-h-[34px] sm:min-h-[42px] rounded-lg sm:rounded-xl border border-slate-700/40 bg-slate-800/25 text-left max-w-[100px] xs:max-w-[140px] sm:max-w-[200px]"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="flex h-6 w-6 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded bg-amber-500/15 text-amber-400 border-none sm:border sm:border-amber-500/25 sm:rounded-lg">
          <Wallet size={14} className="sm:hidden" strokeWidth={2} />
          <Wallet size={18} className="hidden sm:block" strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="hidden sm:block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Session</span>
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
        className="flex items-center justify-center gap-1.5 px-2 py-1.5 min-h-[34px] sm:min-h-[42px] rounded-lg sm:rounded-xl border border-red-500/30 bg-red-500/10 text-left max-w-[110px] sm:max-w-[200px] text-red-200 text-xs font-medium"
      >
        <span className="truncate">Error - retry</span>
      </button>
    );
  }

  if (!ctx.session) {
    return (
      <div
        className="flex items-center gap-1 sm:gap-2 pl-2 pr-1.5 py-1.5 sm:pl-3 sm:pr-2.5 sm:py-2 min-h-[34px] sm:min-h-[42px] rounded-lg sm:rounded-xl border border-slate-700/40 bg-slate-800/25 text-left max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] opacity-80"
        style={{ color: 'var(--color-text)' }}
        title="Open or resume your drawer session from the prompt"
      >
        <span className="flex h-6 w-6 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded bg-slate-600/40 text-slate-300 border-none sm:border sm:border-slate-700/40 sm:rounded-lg">
          <Wallet size={14} className="sm:hidden" strokeWidth={2} />
          <Wallet size={18} className="hidden sm:block" strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="hidden sm:block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Drawer</span>
          <span className="block text-xs truncate text-slate-400">None</span>
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 sm:gap-2 pl-2 pr-1.5 py-1.5 sm:pl-3 sm:pr-2.5 sm:py-2 min-h-[34px] sm:min-h-[42px] rounded-lg sm:rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/55 hover:border-amber-500/35 text-left transition shadow-sm max-w-[110px] xs:max-w-[150px] sm:max-w-[260px]"
        style={{ color: 'var(--color-text)' }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="flex h-6 w-6 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-400 border-none sm:border sm:border-emerald-500/25 sm:rounded-lg">
          <Wallet size={14} className="sm:hidden" strokeWidth={2} />
          <Wallet size={18} className="hidden sm:block" strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="hidden sm:block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Session</span>
          <span className="block text-xs sm:text-sm font-semibold truncate leading-tight tabular-nums">
            {summary?.line2}
          </span>
        </span>
        <ChevronDown size={14} className={`shrink-0 opacity-60 transition-transform sm:hidden ${open ? 'rotate-180' : ''}`} />
        <ChevronDown size={18} className={`shrink-0 opacity-60 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop on mobile */}
          <div className="fixed inset-0 z-[119] md:hidden bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[120] w-full rounded-t-3xl border-t border-slate-700 bg-[var(--pos-panel)] shadow-2xl overflow-y-auto max-h-[80vh] py-4 px-4 animate-slide-up md:absolute md:inset-auto md:right-0 md:top-full md:mt-1.5 md:w-[19rem] md:rounded-xl md:border md:border-slate-600/80 md:py-2 md:px-3 md:shadow-2xl md:max-h-none md:overflow-visible md:animate-none"
            role="dialog"
            aria-label="Cashier session details"
            {...bind}
            style={style}
          >
            <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-3 md:hidden shrink-0" />
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
        </>
      )}
    </div>
  );
}
