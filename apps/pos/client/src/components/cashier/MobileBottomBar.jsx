import { ShoppingCart, Plus } from 'lucide-react';
import CashierSessionNavButton from '../cashier/CashierSessionNavButton';

export default function MobileBottomBar({ onOpenCart }) {
  return (
    <div className="fixed bottom-0 inset-x-0 md:hidden bg-[var(--pos-panel)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_36px_rgba(0,0,0,0.4)] flex justify-between items-center z-20">
      <CashierSessionNavButton />
      <button
        type="button"
        onClick={onOpenCart}
        className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
        aria-label="Open cart"
      >
        <ShoppingCart size={18} />
        <span>Cart</span>
      </button>
    </div>
  );
}
