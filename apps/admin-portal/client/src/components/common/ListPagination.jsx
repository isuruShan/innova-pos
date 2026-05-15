export default function ListPagination({
  page,
  pages,
  total,
  onPageChange,
  isFetching,
  className = '',
}) {
  if (pages <= 1) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-gray-600 border-t border-gray-100 ${className}`}
    >
      <span>
        Page {page} of {pages}
        {typeof total === 'number' ? ` (${total} total)` : ''}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages || isFetching}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
