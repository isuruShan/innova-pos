import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * Reusable page header with responsive action buttons.
 *
 * On mobile (< sm):
 *   - Primary action (last item) stays visible as a standalone button.
 *   - All other actions collapse into a kebab (⋮) menu.
 *
 * On sm+:
 *   - All actions render inline.
 *
 * Props:
 *   title       - string | ReactNode
 *   subtitle    - string | ReactNode (optional)
 *   actions     - Array<{ label, icon: LucideComponent, onClick, primary?, className? }>
 *                 Mark the most important action with `primary: true` — it always shows on mobile.
 */
export default function PageHeader({ title, subtitle, actions = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const primaryAction = actions.find((a) => a.primary) ?? actions[actions.length - 1];
  const secondaryActions = actions.filter((a) => a !== primaryAction);

  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      {/* Left: title + subtitle */}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* On sm+: show ALL actions inline */}
        <div className="hidden sm:flex items-center gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={
                action.primary
                  ? 'flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/10 text-sm'
                  : action.className ||
                    'flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:text-gray-900 font-medium px-4 py-2.5 rounded-xl transition text-sm'
              }
            >
              {action.icon && <action.icon size={15} />}
              {action.label}
            </button>
          ))}
        </div>

        {/* On mobile: primary action + kebab for secondary */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* Primary action always visible */}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-xl transition shadow-lg shadow-amber-500/10 text-sm"
            >
              {primaryAction.icon && <primaryAction.icon size={15} />}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {/* Kebab menu for secondary actions */}
          {secondaryActions.length > 0 && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More actions"
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-300 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-400 transition"
              >
                <MoreVertical size={17} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  {secondaryActions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { action.onClick(); setMenuOpen(false); }}
                      disabled={action.disabled}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      {action.icon && <action.icon size={15} className="shrink-0 text-gray-400" />}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
