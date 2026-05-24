import { X } from 'lucide-react';

/**
 * Centered modal — solid overlay (no blur), matches merchant admin dialog pattern.
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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={`bg-[var(--pos-panel)] rounded-xl border border-slate-700 shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-700 shrink-0">
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
          <div className="px-6 py-4 border-t border-slate-700 shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
