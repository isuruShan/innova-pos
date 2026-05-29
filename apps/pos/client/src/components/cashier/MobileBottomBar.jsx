import { ShoppingCart } from 'lucide-react';
import CashierSessionNavButton from './CashierSessionNavButton';

/**
 * Fixed bottom bar shown on mobile (md:hidden) in the New Order view.
 * Left: session summary. Right: cart button.
 */
export default function MobileBottomBar({ onOpenCart, cartCount = 0, cartTotal = '' }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 md:hidden flex items-center justify-between gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[var(--pos-panel)] border-t border-slate-700/50 shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
      {/* Session summary */}
      <div className="flex-1 min-w-0">
        <CashierSessionNavButton />
      </div>

      {/* Cart button */}
      <button
        type="button"
        onClick={onOpenCart}
        aria-label="Open cart"
        className="relative flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white font-semibold rounded-xl px-4 py-2.5 shadow-lg shadow-amber-500/30 transition shrink-0"
      >
        <ShoppingCart size={18} />
        <span className="text-sm">Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </div>
  );
}
