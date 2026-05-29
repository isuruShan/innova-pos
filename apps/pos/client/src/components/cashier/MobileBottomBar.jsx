import { ShoppingCart } from 'lucide-react';
import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useCashierSession } from './cashierSessionContext';

/**
 * Fixed bottom bar shown only on mobile (md:hidden) in the New Order view.
 * Left 3/4: inline session summary (not a button).
 * Right 1/4: cart button.
 */
export default function MobileBottomBar({ onOpenCart, cartCount = 0 }) {
  const ctx = useCashierSession();

  const summary = useMemo(() => {
    if (!ctx?.session) return null;
    const net = ctx.netCashMovements ?? 0;
    return {
      cash: formatCurrency(ctx.cashSalesSoFar ?? 0),
      expected: formatCurrency(ctx.expected ?? 0),
      net: Math.abs(net) >= 0.005 ? net : null,
    };
  }, [ctx?.session, ctx?.cashSalesSoFar, ctx?.expected, ctx?.netCashMovements]);

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 md:hidden flex items-center gap-2 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-[var(--pos-panel)] border-t border-slate-700/50 shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">

      {/* Session summary — takes 3/4 of the bar, non-interactive */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${ctx?.session ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/40 text-slate-400'}`}>
          <Wallet size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          {!ctx || ctx.showSessionLoading ? (
            <p className="text-[11px] text-slate-500">Loading session…</p>
          ) : ctx.isError ? (
            <p className="text-[11px] text-red-400">Session error</p>
          ) : !ctx.session ? (
            <p className="text-[11px] text-slate-500">No drawer session</p>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 leading-none mb-0.5">Session</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-bold text-amber-400 tabular-nums leading-tight">{summary?.cash} cash</span>
                <span className="text-[11px] text-slate-400 tabular-nums leading-tight">· {summary?.expected} expected</span>
                {summary?.net != null && (
                  <span className={`text-[10px] font-semibold tabular-nums leading-tight ${summary.net >= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net)} adj.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cart button — right side */}
      <button
        type="button"
        onClick={onOpenCart}
        aria-label="Open cart"
        className="relative flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-semibold rounded-xl px-3 py-2 shadow-lg shadow-amber-500/30 transition shrink-0"
      >
        <ShoppingCart size={17} />
        <span className="text-sm font-semibold">Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </div>
  );
}
