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
      <div className="text-center text-gray-500 py-16 bg-white rounded-xl border border-gray-200">
        No items match your filters
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 sm:overflow-visible shadow-sm">
      <div className="overflow-x-auto sm:overflow-visible">
        <table className="w-full">
          <thead className="sticky top-[132px] bg-gray-50 z-10 border-b border-gray-200">
            <tr className="border-b border-gray-200">
              {canDrag && (
                <th className="w-10 px-2 py-3 bg-gray-50" aria-label="Reorder" />
              )}
              <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left bg-gray-50">Category</th>
              <SortableTh label="Price" field="price" currentSort={sort} currentOrder={order} onSort={toggleSort} align="right" />
              <SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
              <SortableTh label="Active" field="available" currentSort={sort} currentOrder={order} onSort={toggleSort} align="center" />
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right bg-gray-50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {items.map((item) => {
              const handleDrag = canDrag ? menuDragHandle(item._id) : {};
              const dropTarget = canDrag ? menuDropTarget(item._id) : {};
              const dragOver = canDrag && menuDragOver(item._id);

              return (
                <tr
                  key={item._id}
                  {...dropTarget}
                  className={`hover:bg-gray-50 transition ${dragOver ? 'ring-2 ring-inset ring-amber-500/40' : ''}`}
                >
                  {canDrag && (
                    <td className="px-2 py-3">
                      <div
                        {...handleDrag}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-650"
                      >
                        <GripVertical size={14} />
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate" title={item.name}>
                        {item.name}
                      </span>
                      {item.isCombo && (
                        <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                          <Link2 size={9} /> Combo
                        </span>
                      )}
                      {item.hasVariants && (
                        <span className="shrink-0 text-[10px] font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-100">
                          {item.variants?.length || 0} var.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-650">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-brand-orange font-semibold text-right whitespace-nowrap">
                    {(() => {
                      const { price, prefix } = getItemDisplayPrice(item);
                      return (
                        <>
                          {prefix && <span className="text-gray-400 font-normal text-[10px]">{prefix}</span>}
                          {formatCurrency(price)}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleAvailable(item)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${item.available ? 'text-green-600' : 'text-gray-450'}`}
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
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition"
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
