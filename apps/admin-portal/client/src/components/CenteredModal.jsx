import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import useSwipeDismiss from '../hooks/useSwipeDismiss';

/**
 * Responsive modal component — slides up as a bottom sheet on mobile views,
 * and displays as a standard centered modal dialog on desktop views.
 */
export default function CenteredModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  ariaLabel,
  disableBottomSheet = false,
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 639px)');
    const listener = (e) => setIsMobile(e.matches);
    setIsMobile(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const { bind } = useSwipeDismiss({ onClose, open });
  const treatAsBottomSheet = !disableBottomSheet && isMobile;
  const activeBind = treatAsBottomSheet ? bind : {};

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/60 ${
        treatAsBottomSheet ? 'items-end' : 'items-center p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      onClick={(e) => { if (!isMobile && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={`bg-white border border-gray-200 shadow-2xl w-full ${maxWidth} flex flex-col ${
          treatAsBottomSheet
            ? 'rounded-t-2xl max-h-[85vh] touch-none'
            : 'rounded-2xl max-h-[90vh] touch-auto'
        }`}
        style={treatAsBottomSheet ? activeBind.style : undefined}
        onClick={(e) => e.stopPropagation()}
        {...(treatAsBottomSheet ? activeBind : {})}
      >
        {/* Drag handle */}
        {treatAsBottomSheet && (
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1 shrink-0 cursor-grab active:cursor-grabbing" />
        )}
        {(title || onClose) && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-150 shrink-0">
            {title ? (
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            ) : (
              <span />
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-150 shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}


