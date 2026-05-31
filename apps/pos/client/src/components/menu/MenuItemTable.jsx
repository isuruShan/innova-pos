import { Edit2, Trash2, ToggleLeft, ToggleRight, Link2, GripVertical } from 'lucide-react';
import SortableTh from '../SortableTh';
import { formatCurrency, getItemDisplayPrice } from '../../utils/format';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MenuItemTable({
  items,
  sort,
  order,
  toggleSort,
  canDrag,
  onEdit,
  onDelete,
  onToggleAvailable,
  menuDragHandle,
  menuDropTarget,
  menuDragOver,
}) {
  if (items.length === 0) {
    return (
      <div className="text-center text-slate-600 py-16 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
        No items match your filters
      </div>
    );
  }

  return (
    <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--pos-surface-inset)]/90 backdrop-blur z-10">
            <tr className="border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50">
              {canDrag && (
                <th className="w-10 px-2 py-3" aria-label="Reorder" />
              )}
              <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
              <SortableTh label="Category" field="category" currentSort={sort} currentOrder={order} onSort={toggleSort} />
              <SortableTh label="Price" field="price" currentSort={sort} currentOrder={order} onSort={toggleSort} align="right" />
              <SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
              <SortableTh label="Active" field="available" currentSort={sort} currentOrder={order} onSort={toggleSort} align="center" />
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {items.map((item) => {
              const handleDrag = canDrag ? menuDragHandle(item._id) : {};
              const dropTarget = canDrag ? menuDropTarget(item._id) : {};
              const dragOver = canDrag && menuDragOver(item._id);

              return (
                <tr
                  key={item._id}
                  {...dropTarget}
                  className={`hover:bg-slate-800/30 transition ${dragOver ? 'ring-2 ring-inset ring-amber-500/40' : ''}`}
                >
                  {canDrag && (
                    <td className="px-2 py-3">
                      <div
                        {...handleDrag}
                        className="w-7 h-7 flex items-center justify-center text-slate-500 cursor-grab active:cursor-grabbing hover:text-slate-300"
                      >
                        <GripVertical size={14} />
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[var(--pos-text-primary)] truncate" title={item.name}>
                        {item.name}
                      </span>
                      {item.isCombo && (
                        <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          <Link2 size={9} /> Combo
                        </span>
                      )}
                      {item.hasVariants && (
                        <span className="shrink-0 text-[10px] font-medium text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                          {item.variants?.length || 0} var.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-amber-400 font-semibold text-right whitespace-nowrap">
                    {(() => {
                      const { price, prefix } = getItemDisplayPrice(item);
                      return (
                        <>
                          {prefix && <span className="text-slate-500 font-normal text-[10px]">{prefix}</span>}
                          {formatCurrency(price)}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleAvailable(item)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${item.available ? 'text-green-400' : 'text-slate-500'}`}
                    >
                      {item.available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {item.available ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="p-2 rounded-lg text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-800 transition"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
