import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** Dark-theme sortable table header for POS manager lists. */
export default function SortableTh({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
  className = '',
  align = 'left',
}) {
  const active = currentSort === field;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${alignClass} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-gray-200 transition-colors ${active ? 'text-brand-orange' : ''}`}
      >
        <span>{label}</span>
        {active ? (
          currentOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );
}
