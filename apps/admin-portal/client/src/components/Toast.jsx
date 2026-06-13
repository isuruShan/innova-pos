import { X } from 'lucide-react';

const VARIANTS = {
  error: 'bg-red-950/95 border-red-500/40 text-red-100',
  success: 'bg-green-950/95 border-green-500/40 text-green-100',
  info: 'bg-[var(--pos-panel)] border-slate-600 text-[var(--pos-text-primary)]',
};

export default function Toast({ toast, onDismiss }) {
  if (!toast?.message) return null;

  const styles = VARIANTS[toast.variant] || VARIANTS.error;

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-[300] max-w-sm w-[min(100vw-2rem,24rem)] px-4 py-3 rounded-lg border shadow-xl flex items-start gap-3 ${styles}`}
    >
      <p className="text-sm leading-relaxed flex-1">{toast.message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 transition"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
