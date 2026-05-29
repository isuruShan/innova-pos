/**
 * ResponsiveTable
 *
 * Renders a standard <table> on sm+ screens.
 * On mobile (< sm) it renders each row as a compact card in a grid.
 *
 * Props:
 *   columns  - Array of column definitions:
 *     {
 *       key       : string          — unique key (used as React key)
 *       header    : string          — column header text
 *       render    : (row) => ReactNode — cell renderer
 *       className : string?         — extra <td> class (e.g. "text-right")
 *       headerClassName: string?    — extra <th> class
 *       mobileLabel: string?        — label to show on mobile card (defaults to header)
 *       mobileHide : bool?          — if true, omit this field from the mobile card
 *       mobilePrimary: bool?        — if true, this value appears as the card title
 *       mobileSecondary: bool?      — appears as a sub-title (smaller, slate-400)
 *       mobileRight : bool?         — aligns this field value to the right on the card
 *     }
 *   rows      - Array of data objects
 *   rowKey    - (row) => string | number — extracts a unique key from each row
 *   emptyState - ReactNode — shown when rows is empty
 *   loading   - bool — if true, shows skeleton rows
 *   skeletonRows - number (default 5) — number of skeleton rows to show
 *   mobileGridCols - string (default "grid-cols-1") — tailwind grid class for mobile
 *   className  - string — additional className for the wrapper
 */
export default function ResponsiveTable({
  columns = [],
  rows = [],
  rowKey,
  emptyState,
  loading = false,
  skeletonRows = 5,
  mobileGridCols = 'grid-cols-1 sm-card:grid-cols-2',
  className = '',
}) {
  const primaryCol = columns.find((c) => c.mobilePrimary);
  const secondaryCol = columns.find((c) => c.mobileSecondary);
  const rightCol = columns.filter((c) => c.mobileRight && !c.mobilePrimary && !c.mobileSecondary && !c.mobileHide);
  const bodyFields = columns.filter(
    (c) => !c.mobilePrimary && !c.mobileSecondary && !c.mobileRight && !c.mobileHide,
  );

  return (
    <div className={className}>
      {/* ─── DESKTOP TABLE (sm+) ─── */}
      <div className="hidden sm:block bg-[var(--pos-panel)] rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {loading
                ? Array.from({ length: skeletonRows }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          <div className="h-4 bg-slate-700/40 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length} className="py-16 text-center text-slate-500 text-sm">
                        {emptyState || 'No data found'}
                      </td>
                    </tr>
                  )
                : rows.map((row) => (
                    <tr
                      key={rowKey ? rowKey(row) : row._id || row.id}
                      className="hover:bg-slate-700/20 transition"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${col.className || ''}`}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MOBILE CARD GRID (< sm) ─── */}
      <div className="sm:hidden">
        {loading ? (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div key={i} className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-4 animate-pulse space-y-2">
                <div className="h-4 bg-slate-700/40 rounded w-1/2" />
                <div className="h-3 bg-slate-700/30 rounded w-3/4" />
                <div className="h-3 bg-slate-700/30 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            {emptyState || 'No data found'}
          </div>
        ) : (
          <div className={`grid gap-3 ${mobileGridCols}`}>
            {rows.map((row) => {
              const key = rowKey ? rowKey(row) : row._id || row.id;
              return (
                <div
                  key={key}
                  className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-3.5 flex flex-col gap-2"
                >
                  {/* Card header row: primary + right values */}
                  {(primaryCol || rightCol.length > 0) && (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {primaryCol && (
                          <div className="font-semibold text-[var(--pos-text-primary)] text-sm leading-tight">
                            {primaryCol.render(row)}
                          </div>
                        )}
                        {secondaryCol && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {secondaryCol.render(row)}
                          </div>
                        )}
                      </div>
                      {rightCol.length > 0 && (
                        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                          {rightCol.map((col) => (
                            <div key={col.key} className="text-sm font-semibold">
                              {col.render(row)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body fields as label: value pairs */}
                  {bodyFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-700/40 pt-2">
                      {bodyFields.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider leading-none mb-0.5">
                            {col.mobileLabel ?? col.header}
                          </p>
                          <div className="text-xs text-slate-300">{col.render(row)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
