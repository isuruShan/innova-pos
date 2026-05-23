import { Loader, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';

const VARIANT_STYLES = {
  danger:   { bg: 'bg-red-600 hover:bg-red-700',   icon: AlertTriangle, iconClass: 'text-red-500', ring: 'ring-red-100' },
  warning:  { bg: 'bg-amber-500 hover:bg-amber-600', icon: AlertTriangle, iconClass: 'text-amber-500', ring: 'ring-amber-100' },
  success:  { bg: 'bg-green-600 hover:bg-green-700', icon: CheckCircle, iconClass: 'text-green-500', ring: 'ring-green-100' },
  delete:   { bg: 'bg-red-600 hover:bg-red-700',   icon: Trash2, iconClass: 'text-red-500', ring: 'ring-red-100' },
};

/**
 * Reusable confirmation dialog for all confirmations and rejections in the admin portal.
 *
 * Props:
 *  open           {boolean}    Whether the dialog is shown.
 *  title          {string}     Short dialog heading.
 *  message        {string}     Body message / question.
 *  confirmLabel   {string}     Text for the confirm button (default: 'Confirm').
 *  cancelLabel    {string}     Text for the cancel button (default: 'Cancel').
 *  variant        {string}     'danger' | 'warning' | 'success' | 'delete' (default: 'danger').
 *  isLoading      {boolean}    Shows spinner on confirm button.
 *  children       {ReactNode}  Optional extra content (e.g. a rejection reason textarea).
 *  onConfirm      {()=>void}   Called when the user confirms.
 *  onCancel       {()=>void}   Called when the user cancels or clicks outside.
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
  if (!open) return null;

  const { bg, icon: Icon, iconClass, ring } = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 overflow-hidden">
        {/* Icon + header */}
        <div className="px-6 pt-6 pb-4">
          <div className={`w-11 h-11 rounded-xl ${ring} ring-4 bg-white flex items-center justify-center mb-4`}>
            <Icon size={22} className={iconClass} />
          </div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {message && <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{message}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
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
