import { Loader, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import useSwipeDismiss from '../hooks/useSwipeDismiss';


const VARIANT_STYLES = {
  danger: { bg: 'bg-red-600 hover:bg-red-700', icon: AlertTriangle, iconClass: 'text-red-400', ring: 'ring-red-500/20' },
  warning: { bg: 'bg-amber-500 hover:bg-amber-400', icon: AlertTriangle, iconClass: 'text-amber-400', ring: 'ring-amber-500/20' },
  success: { bg: 'bg-green-600 hover:bg-green-700', icon: CheckCircle, iconClass: 'text-green-400', ring: 'ring-green-500/20' },
  delete: { bg: 'bg-red-600 hover:bg-red-700', icon: Trash2, iconClass: 'text-red-400', ring: 'ring-red-500/20' },
};

/**
 * Confirmation dialog aligned with merchant admin ConfirmDialog layout (solid overlay, no blur).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  children,
  onConfirm,
  onCancel,
}) {
  const { style, bind } = useSwipeDismiss({ onClose: onCancel, open });

  if (!open) return null;


  const { bg, icon: Icon, iconClass, ring } = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div
        className="bg-[var(--pos-panel)] rounded-xl max-w-sm w-full shadow-xl border border-slate-700 overflow-hidden"
        {...bind}
        style={style}
      >
        <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mt-3 md:hidden shrink-0" />
        <div className="px-6 pt-6 pb-4">
          <div className={`w-11 h-11 rounded-xl ${ring} ring-4 bg-[var(--pos-surface)] flex items-center justify-center mb-4`}>
            <Icon size={22} className={iconClass} />
          </div>
          <h3 className="text-base font-bold text-[var(--pos-text-primary)]">{title}</h3>
          {message && (
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line">{message}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-slate-600 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold ${bg} disabled:opacity-60 transition flex items-center justify-center gap-2`}
          >
            {isLoading && <Loader size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
