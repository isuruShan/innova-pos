import { X } from 'lucide-react';
import useSwipeDismiss from '../hooks/useSwipeDismiss';

/**
 * Bottom-sheet modal — slides up from the bottom, swipe-down to dismiss.
 */
export default function CenteredModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  ariaLabel,
}) {
  const { bind } = useSwipeDismiss({ onClose, open });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={`bg-[var(--pos-panel)] rounded-t-2xl sm:rounded-2xl border border-slate-700/60 shadow-2xl w-full ${maxWidth} max-h-[85vh] sm:max-h-[90vh] flex flex-col sm:touch-auto touch-none`}
        onClick={(e) => e.stopPropagation()}
        {...bind}
      >
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mt-3 mb-1 shrink-0 cursor-grab active:cursor-grabbing" />
        {(title || onClose) && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-700/60 shrink-0">
            {title ? (
              <h2 className="text-lg font-bold text-[var(--pos-text-primary)]">{title}</h2>
            ) : (
              <span />
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-800 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-700/60 shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
