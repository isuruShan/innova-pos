import React from 'react';

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
      className={`flex flex-wrap items-center justify-between gap-3 py-4 text-xs sm:text-sm text-slate-400 border-t border-slate-800/80 ${className}`}
    >
      <span>
        Page <span className="font-semibold text-slate-200">{page}</span> of{' '}
        <span className="font-semibold text-slate-200">{pages}</span>
        {typeof total === 'number' ? (
          <>
            {' '}
            (<span className="font-semibold text-slate-200">{total}</span> total)
          </>
        ) : (
          ''
        )}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition duration-150 font-medium"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages || isFetching}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition duration-150 font-medium"
        >
          Next
        </button>
      </div>
    </div>
  );
}
