/**
 * Shared currency formatting and proration UI for billing flows.
 */

const CURRENCY_DISPLAY = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Normalise currency code; never return a bare number.
 */
export function currencySymbol(code) {
  const str = String(code ?? '').trim();
  if (!str || str === '0' || str === 'undefined' || str === 'null') return 'LKR';
  return str.toUpperCase();
}

/**
 * Display symbol for a currency code (Rs., $, …).
 * @param {string} currencyCode
 * @param {string} [merchantSymbol] — optional override from tenant branding
 */
export function displayCurrencySymbol(currencyCode, merchantSymbol) {
  const code = currencySymbol(currencyCode);
  if (merchantSymbol && String(merchantSymbol).trim()) return String(merchantSymbol).trim();
  return CURRENCY_DISPLAY[code] || code;
}

/**
 * Format amount with merchant-appropriate symbol (always en-US number grouping).
 */
export function formatMoney(currencyCode, amount, merchantSymbol) {
  const sym = displayCurrencySymbol(currencyCode, merchantSymbol);
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${sym} —`;
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Single charge proration panel (add-ons, one store, one seat).
 */
export default function ProrationBreakdown({ proration, fullCycle, currency, amountDue, merchantSymbol }) {
  if (!proration) return null;
  const cur = proration.currency || currency || 'LKR';
  const due = amountDue != null ? Number(amountDue) : Number(proration.amount);

  const endDate = proration.periodEndsAt ? new Date(proration.periodEndsAt) : null;
  const endLabel = endDate
    ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const daysLeft = proration.remainingDays;
  const cycleDays = proration.cycleDays;
  const isProrated = proration.isProrated;
  const cycleName = cycleDays >= 360 ? 'yearly' : 'monthly';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm space-y-2">
      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
        First payment breakdown
      </p>

      {isProrated ? (
        <div className="space-y-1">
          <p className="text-blue-900/90 leading-snug">
            You&apos;re paying for{' '}
            <strong className="font-semibold">{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>
            {endLabel ? (
              <>
                {' '}remaining until your next billing cycle on{' '}
                <strong className="font-semibold">{endLabel}</strong>.
                {' '}After that, the full {cycleName} rate applies.
              </>
            ) : (
              ' until your next billing cycle.'
            )}
          </p>
          {proration.fullAmount != null && (
            <p className="text-xs text-blue-700/80 font-mono">
              {formatMoney(cur, proration.fullAmount, merchantSymbol)} ÷ {cycleDays} days × {daysLeft} days
            </p>
          )}
        </div>
      ) : (
        <p className="text-blue-900/80">
          Full {cycleName} charge — your billing cycle starts fresh from today.
        </p>
      )}

      {isProrated && fullCycle?.amount != null ? (
        <div className="flex justify-between text-blue-900/70 text-xs pt-1">
          <span>Full {cycleName} price (from next cycle)</span>
          <span className="tabular-nums">{formatMoney(cur, fullCycle.amount, merchantSymbol)}</span>
        </div>
      ) : null}

      <div className="flex justify-between font-semibold text-blue-950 pt-1 border-t border-blue-100">
        <span>Amount due now</span>
        <span className="tabular-nums">{formatMoney(cur, due, merchantSymbol)}</span>
      </div>
    </div>
  );
}

/**
 * Combined user-license quote (user seat + extra store slots).
 */
export function LicenseQuoteBreakdown({ lineItems = [], totalAmount, currency, billingLabel, merchantSymbol }) {
  if (!lineItems.length) return null;
  const cur = currency || lineItems[0]?.currency || 'LKR';
  const first = lineItems[0]?.proration;
  const endDate = first?.periodEndsAt ? new Date(first.periodEndsAt) : null;
  const endLabel = endDate
    ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const daysLeft = first?.remainingDays;
  const cycleDays = first?.cycleDays;
  const isProrated = first?.isProrated;
  const cycleName = cycleDays >= 360 ? 'yearly' : 'monthly';
  const total = Number(totalAmount) || lineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const chargeSummary =
    lineItems.length > 1
      ? 'your new user seat and additional store access'
      : lineItems[0]?.label || 'this license';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm space-y-3">
      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
        First payment breakdown
      </p>

      {isProrated && daysLeft ? (
        <p className="text-blue-900/90 leading-snug">
          This payment covers {chargeSummary} for the remaining{' '}
          <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>
          {endLabel ? (
            <>
              {' '}until your next billing cycle on <strong>{endLabel}</strong>.
            </>
          ) : (
            ' until your next billing cycle.'
          )}
          {' '}After that, the full {cycleName} rate applies for each item.
        </p>
      ) : (
        <p className="text-blue-900/80">Full {cycleName} charges for {chargeSummary}.</p>
      )}

      <ul className="space-y-2 border-t border-blue-100 pt-2">
        {lineItems.map((item, idx) => (
          <li key={idx} className="space-y-0.5">
            <div className="flex justify-between text-blue-950">
              <span className="text-blue-900/90">{item.label}</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(item.currency || cur, item.amount, merchantSymbol)}
              </span>
            </div>
            {item.proration?.isProrated && item.proration.fullAmount != null && (
              <p className="text-xs text-blue-700/80 font-mono">
                {formatMoney(item.currency || cur, item.proration.fullAmount, merchantSymbol)} ÷{' '}
                {item.proration.cycleDays} days × {item.proration.remainingDays} days
              </p>
            )}
          </li>
        ))}
      </ul>

      {billingLabel ? (
        <p className="text-xs text-blue-800/70">{billingLabel}</p>
      ) : null}

      <div className="flex justify-between font-semibold text-blue-950 pt-1 border-t border-blue-100">
        <span>Total amount due now</span>
        <span className="tabular-nums text-brand-orange">{formatMoney(cur, total, merchantSymbol)}</span>
      </div>
    </div>
  );
}
