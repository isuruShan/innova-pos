import { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';

/**
 * Collapsible filter wrapper for reporting pages.
 *
 * On mobile (< md): renders a compact toggle pill. Tapping it expands the
 * filter content below. When `badge > 0` the pill highlights in amber to
 * signal active non-default filters.
 *
 * On desktop (md+): children are always visible — the toggle is hidden.
 *
 * Props:
 *   summary  – string shown in the toggle pill (current filter state)
 *   badge    – number of active non-default filters (shows a dot when > 0)
 *   children – the full filter panel content
 */
export default function FilterPanel({ summary, badge = 0, children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile toggle — hidden on md+ ────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`md:hidden flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition mb-2 ${
          open || badge > 0
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
            : 'bg-[var(--pos-panel)] border-slate-700/50 text-slate-400 hover:text-[var(--pos-text-primary)]'
        }`}
      >
        <SlidersHorizontal size={14} className="shrink-0" />
        <span className="flex-1 text-left truncate text-sm">{summary}</span>
        {badge > 0 && (
          <span className="bg-amber-500 text-[var(--pos-selection-text)] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none shrink-0">
            {badge}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Content: always visible md+, toggles on mobile ── */}
      <div className={open ? 'block' : 'hidden md:block'}>
        {children}
      </div>
    </>
  );
}
