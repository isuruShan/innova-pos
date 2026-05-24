import { Plus, X } from 'lucide-react';
import { draftItemCount, draftLabel } from '../../utils/cashierDraftOrders';

export default function CashierDraftTabs({
  drafts,
  activeDraftId,
  onSelect,
  onAdd,
  onRemove,
  tableLabelByDraftId = {},
}) {
  return (
    <div className="shrink-0 border-b border-slate-700/50 bg-[var(--pos-panel)]/80 px-2 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-thin">
        {drafts.map((draft) => {
          const active = draft.id === activeDraftId;
          const count = draftItemCount(draft);
          const label = draftLabel(draft, { tableLabel: tableLabelByDraftId[draft.id] });
          return (
            <div
              key={draft.id}
              className={`group flex items-center shrink-0 max-w-[11rem] rounded-lg border transition ${
                active
                  ? 'border-amber-500/60 bg-amber-500/15'
                  : 'border-slate-700 bg-[var(--pos-surface-inset)] hover:border-slate-600'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(draft.id)}
                className={`min-w-0 flex-1 px-2.5 py-2 text-left text-xs font-medium truncate ${
                  active ? 'text-amber-200' : 'text-slate-300'
                }`}
                title={label}
              >
                <span className="truncate block">{label}</span>
                {count > 0 && (
                  <span className={`text-[10px] ${active ? 'text-amber-300/80' : 'text-slate-500'}`}>
                    {count} item{count !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
              {(drafts.length > 1 || count > 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(draft.id);
                  }}
                  className={`shrink-0 p-1.5 mr-0.5 rounded-md transition ${
                    active
                      ? 'text-amber-300/70 hover:text-amber-100 hover:bg-amber-500/20'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                  aria-label={`Close ${label}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-amber-300 hover:border-amber-500/50 text-xs font-semibold transition"
          title="Start another order"
        >
          <Plus size={14} />
          New
        </button>
      </div>
    </div>
  );
}
