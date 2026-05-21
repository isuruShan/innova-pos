/**
 * Currency code → symbol map (extend as needed).
 */
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

function currencySymbol(code) {
  return CURRENCY_SYMBOLS[String(code || '').toUpperCase()] || String(code || '');
}

/**
 * Format a monetary amount with currency symbol, no leading zeros in the
 * integer part, and always 2 decimal places.
 * e.g. formatMoney('LKR', 1479.45) → 'Rs. 1,479.45'
 */
function formatMoney(currencyCode, amount) {
  const sym = currencySymbol(currencyCode);
  const n = Number(amount);
  if (isNaN(n)) return `${sym} —`;
  return `${sym} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Shows the first-payment proration detail for add-ons / additional stores / user seats.
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
    ? endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
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

      {/* Full-cycle reference price */}
      {isProrated && fullCycle?.amount != null ? (
        <div className="flex justify-between text-blue-900/80">
          <span>Full {cycleName} price</span>
          <span className="tabular-nums">{formatMoney(cur, fullCycle.amount)}</span>
        </div>
      ) : null}

      {/* Remaining days explanation */}
      {isProrated ? (
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between text-blue-900/80">
            <span>
              You&apos;re billed for{' '}
              <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>
              {endLabel ? (
                <> until your billing cycle resets on <strong>{endLabel}</strong></>
              ) : null}
            </span>
          </div>
          <p className="text-xs text-blue-700/80">
            Rate: {formatMoney(cur, proration.fullAmount)} ÷ {cycleDays} days × {daysLeft} days
          </p>
        </div>
      ) : (
        <p className="text-xs text-blue-700/80">
          Full {cycleName} charge — your billing cycle starts fresh from today.
        </p>
      )}

      {/* Amount due */}
      <div className="flex justify-between font-semibold text-blue-950 pt-1 border-t border-blue-100">
        <span>Amount due now</span>
        <span className="tabular-nums">{formatMoney(cur, proration.amount)}</span>
      </div>
    </div>
  );
}
