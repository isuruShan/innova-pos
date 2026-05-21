/**
 * Shared currency formatting utilities used across billing UI.
 *
 * Export `formatMoney` so other components (UsersPage, SubscriptionPage,
 * StoresPage, etc.) can format amounts consistently without duplicating logic.
 */

/** Currency code → symbol */
const CURRENCY_SYMBOLS = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  INR: '₹',
};

/**
 * Return the display symbol for a currency code.
 * Falls back to the code itself if unknown, or 'Rs.' if code is falsy.
 */
export function currencySymbol(code) {
  const str = String(code ?? '').toUpperCase().trim();
  if (!str) return 'Rs.'; // default: LKR
  return CURRENCY_SYMBOLS[str] ?? str;
}

/**
 * Format a monetary amount with the currency symbol.
 * Always uses 'en-US' locale to guarantee consistent decimal/thousands
 * separators regardless of the user's browser locale — avoids the
 * "0 986.30" artefact from locales that use space as thousands separator.
 *
 * Examples:
 *   formatMoney('LKR', 1479.45) → 'Rs. 1,479.45'
 *   formatMoney('USD', 5)       → '$ 5.00'
 */
export function formatMoney(currencyCode, amount) {
  const sym = currencySymbol(currencyCode);
  const n = Number(amount);
  if (isNaN(n)) return `${sym} —`;
  return `${sym}\u00a0${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Shows the first-payment proration detail for add-ons / additional stores / user seats.
 *
 * Clearly explains:
 * - How many days remain until the next billing cycle
 * - The billing rate (full-cycle price ÷ cycle days × remaining days)
 * - The actual amount charged today
 *
 * Props:
 *  proration  — the proration object from the backend
 *  fullCycle  — optional { amount, label } for the non-prorated full-cycle amount
 *  currency   — fallback currency code
 */
export default function ProrationBreakdown({ proration, fullCycle, currency }) {
  if (!proration) return null;
  const cur = proration.currency || currency || 'LKR';

  const endDate = proration.periodEndsAt ? new Date(proration.periodEndsAt) : null;
  const endLabel = endDate
    ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const daysLeft = proration.remainingDays;
  const cycleDays = proration.cycleDays;
  const isProrated = proration.isProrated;

  // Human-readable billing cycle name
  const cycleName = cycleDays >= 360 ? 'yearly' : 'monthly';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm space-y-2">
      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
        First payment breakdown
      </p>

      {/* What they're actually paying for, explained plainly */}
      {isProrated ? (
        <div className="space-y-1">
          <p className="text-blue-900/90 leading-snug">
            You&apos;re paying for{' '}
            <strong className="font-semibold">{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>
            {endLabel ? (
              <>
                {' '}— the remaining time until your next billing cycle starts on{' '}
                <strong className="font-semibold">{endLabel}</strong>.
                {' '}After that, you&apos;ll be billed the full {cycleName} rate.
              </>
            ) : (
              ' until your next billing cycle.'
            )}
          </p>
          {/* Show the math */}
          {proration.fullAmount != null && (
            <p className="text-xs text-blue-700/80 font-mono">
              {formatMoney(cur, proration.fullAmount)} ÷ {cycleDays} days × {daysLeft} days
            </p>
          )}
        </div>
      ) : (
        <p className="text-blue-900/80">
          Full {cycleName} charge — your billing cycle starts fresh from today.
        </p>
      )}

      {/* Full-cycle reference price */}
      {isProrated && fullCycle?.amount != null ? (
        <div className="flex justify-between text-blue-900/70 text-xs pt-1">
          <span>Full {cycleName} price (from next cycle)</span>
          <span className="tabular-nums">{formatMoney(cur, fullCycle.amount)}</span>
        </div>
      ) : null}

      {/* Amount due now */}
      <div className="flex justify-between font-semibold text-blue-950 pt-1 border-t border-blue-100">
        <span>Amount due now</span>
        <span className="tabular-nums">{formatMoney(cur, proration.amount)}</span>
      </div>
    </div>
  );
}
