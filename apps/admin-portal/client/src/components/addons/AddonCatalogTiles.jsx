import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Sparkles,
  Search,
} from 'lucide-react';

function formatPeriodEnd(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * @param {object} props
 * @param {Array} props.catalog
 * @param {boolean} [props.isLoading]
 * @param {(row: object) => void} [props.onReview]
 * @param {(row: object) => void} [props.onView]
 * @param {(row: object) => void} [props.onUnsubscribe]
 * @param {boolean} [props.unsubscribePending]
 * @param {string} [props.unsubscribingCode]
 * @param {'tiles'|'list'} [props.variant]
 */
export function AddonActionButton({
  row,
  onReview,
  onView,
  onUnsubscribe,
  unsubscribePending,
  unsubscribingCode,
}) {
  const busy = unsubscribePending && unsubscribingCode === row.code;

  if (row.alreadyActive) {
    if (row.cancelScheduled) {
      return (
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          <p className="text-xs text-gray-600 text-right max-w-[200px]">
            Active until <strong>{formatPeriodEnd(row.periodEndsAt)}</strong>
          </p>
          <button
            type="button"
            onClick={() => onView?.(row)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 text-sm font-semibold"
          >
            View
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => onView?.(row)}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 text-sm font-semibold"
        >
          View
        </button>
        <button
          type="button"
          onClick={() => onUnsubscribe?.(row)}
          disabled={busy || !row.canUnsubscribe}
          className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Scheduling…' : 'Unsubscribe'}
        </button>
      </div>
    );
  }

  if (row.pendingVerification) {
    return (
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => onView?.(row)}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 text-sm font-semibold"
        >
          View
        </button>
        <button
          type="button"
          disabled
          className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Clock size={15} /> Pending approval
        </button>
      </div>
    );
  }

  if (!row.priced?.amount) {
    return <p className="text-xs text-amber-700 text-right">Pricing not set — contact support.</p>;
  }

  return (
    <button
      type="button"
      onClick={() => onReview?.(row)}
      className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover"
    >
      Review & subscribe
    </button>
  );
}

export default function AddonCatalogTiles({
  catalog = [],
  isLoading = false,
  onReview,
  onView,
  onUnsubscribe,
  unsubscribePending = false,
  unsubscribingCode = '',
  variant = 'tiles',
  linkToAddonsPage = false,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (row) =>
        row.name?.toLowerCase().includes(q) ||
        row.code?.toLowerCase().includes(q) ||
        row.shortDescription?.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search add-ons…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading add-ons…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {catalog.length === 0 ? 'No add-ons are available right now.' : 'No add-ons match your search.'}
        </p>
      ) : variant === 'list' ? (
        <div className="space-y-4">
          {filtered.map((row) => (
            <div
              key={row.code}
              className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex gap-3 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                  <Sparkles size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{row.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{row.shortDescription}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {row.plan?.name ? `Priced with plan: ${row.plan.name} · ` : null}
                    {row.billingLabel}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                {row.alreadyActive && !row.pendingVerification && !row.cancelScheduled ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
                    <CheckCircle size={16} /> Active
                  </span>
                ) : null}
                {row.priced?.amount && !row.alreadyActive && !row.pendingVerification ? (
                  <p className="text-lg font-bold text-gray-900 tabular-nums">
                    {row.priced.currency} {Number(row.priced.amount).toLocaleString()}
                  </p>
                ) : null}
                {linkToAddonsPage && onReview ? (
                  <Link
                    to={`/addons?code=${encodeURIComponent(row.code)}`}
                    className="px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover text-center"
                  >
                    Manage
                  </Link>
                ) : (
                  <AddonActionButton
                    row={row}
                    onReview={onReview}
                    onView={onView}
                    onUnsubscribe={onUnsubscribe}
                    unsubscribePending={unsubscribePending}
                    unsubscribingCode={unsubscribingCode}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((row) => (
            <div
              key={row.code}
              className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 shadow-sm hover:border-gray-300 transition"
            >
              <div className="flex gap-3 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                  <Sparkles size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">{row.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-3">{row.shortDescription}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">{row.billingLabel}</p>
              {row.priced?.amount && !row.alreadyActive && !row.pendingVerification ? (
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  {row.priced.currency} {Number(row.priced.amount).toLocaleString()}
                </p>
              ) : null}
              <div className="mt-auto">
                {linkToAddonsPage && onReview ? (
                  <Link
                    to={`/addons?code=${encodeURIComponent(row.code)}`}
                    className="block w-full text-center px-4 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-hover"
                  >
                    {row.alreadyActive || row.pendingVerification ? 'View' : 'Subscribe'}
                  </Link>
                ) : (
                  <AddonActionButton
                    row={row}
                    onReview={onReview}
                    onView={onView}
                    onUnsubscribe={onUnsubscribe}
                    unsubscribePending={unsubscribePending}
                    unsubscribingCode={unsubscribingCode}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
