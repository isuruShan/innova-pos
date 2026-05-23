/**
 * Billing quote UI — recurring subscription price (priority) + prorated amount due today.
 */

const PRORATION_DAYS_PER_MONTH = 30;

const CURRENCY_DISPLAY = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function currencySymbol(code) {
  const str = String(code ?? '').trim();
  if (!str || str === '0' || str === 'undefined' || str === 'null') return 'LKR';
  return str.toUpperCase();
}

export function displayCurrencySymbol(currencyCode, merchantSymbol) {
  const code = currencySymbol(currencyCode);
  if (merchantSymbol && String(merchantSymbol).trim()) return String(merchantSymbol).trim();
  return CURRENCY_DISPLAY[code] || code;
}

export function formatMoney(currencyCode, amount, merchantSymbol) {
  const sym = displayCurrencySymbol(currencyCode, merchantSymbol);
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${sym} —`;
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Primary pricing block — monthly list price first, then cycle rate if yearly.
 */
export function RecurringPriceHero({ recurringRates, merchantSymbol }) {
  if (!recurringRates) return null;
  const cur = recurringRates.currency || 'LKR';
  const monthly = Number(recurringRates.monthly) || 0;
  const yearly = Number(recurringRates.yearly) || 0;
  const isYearly = recurringRates.billingCycle === 'yearly';

  return (
    <div className="rounded-xl border-2 border-brand-orange/30 bg-gradient-to-br from-orange-50 to-white p-4 space-y-2">
      <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">
        Subscription price
      </p>
      {monthly > 0 ? (
        <p className="text-2xl font-bold text-gray-900 tabular-nums">
          {formatMoney(cur, monthly, merchantSymbol)}
          <span className="text-base font-semibold text-gray-600"> / month</span>
        </p>
      ) : null}
      {isYearly && yearly > 0 ? (
        <p className="text-sm text-gray-600 tabular-nums">
          {formatMoney(cur, yearly, merchantSymbol)} / year on your current plan
        </p>
      ) : !isYearly && monthly > 0 ? (
        <p className="text-xs text-gray-500">Billed each month with your subscription</p>
      ) : null}
    </div>
  );
}

/**
 * Amount due today: (monthly ÷ 30) × remaining days in current subscription.
 */
function ProrationDetail({ proration, amountDue, currency, merchantSymbol }) {
  if (!proration) return null;
  const cur = proration.currency || currency || 'LKR';
  const due = amountDue != null ? Number(amountDue) : Number(proration.amount);
  const monthly =
    Number(proration.monthlyListPrice) > 0
      ? Number(proration.monthlyListPrice)
      : Number(proration.fullAmount) || 0;
  const remainingDays = proration.remainingDays;
  const daysPerMonth = proration.daysPerMonth ?? PRORATION_DAYS_PER_MONTH;
  const isProrated = proration.isProrated && monthly > 0 && remainingDays > 0;

  const endDate = proration.periodEndsAt ? new Date(proration.periodEndsAt) : null;
  const endLabel = endDate
    ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm space-y-2">
      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
        Today&apos;s charge (prorated)
      </p>

      <div className="flex justify-between items-baseline">
        <span className="font-medium text-blue-950">Amount due now</span>
        <span className="text-lg font-bold text-brand-orange tabular-nums">
          {formatMoney(cur, due, merchantSymbol)}
        </span>
      </div>

      {isProrated ? (
        <>
          <p className="text-blue-900/90 leading-snug text-xs">
            Your subscription has{' '}
            <strong>{remainingDays} day{remainingDays === 1 ? '' : 's'}</strong> remaining
            {endLabel ? (
              <> until <strong>{endLabel}</strong></>
            ) : null}
            . Today&apos;s charge is the monthly price spread over 30 days, times those remaining days.
          </p>
          {monthly > 0 ? (
            <p className="text-xs text-blue-700/90 font-mono bg-white/60 rounded px-2 py-1.5">
              ({formatMoney(cur, monthly, merchantSymbol)} ÷ {daysPerMonth} days) × {remainingDays} days
              remaining = {formatMoney(cur, due, merchantSymbol)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-blue-800/80">
          Full monthly charge.{endLabel ? <> Billing period ends <strong>{endLabel}</strong>.</> : null}
        </p>
      )}
    </div>
  );
}

/**
 * Full quote panel for add-ons, stores, and single user-license charges.
 */
export function BillingQuotePanel({
  recurringRates,
  proration,
  amountDue,
  currency,
  merchantSymbol,
  fullCycle,
}) {
  const cur = currency || recurringRates?.currency || proration?.currency || 'LKR';
  const rates =
    recurringRates ||
    (fullCycle
      ? {
          monthly: fullCycle.monthlyAmount,
          yearly: fullCycle.yearlyAmount,
          currency: fullCycle.currency || cur,
          billingCycle: fullCycle.billingCycle,
        }
      : null);

  return (
    <div className="space-y-3">
      <RecurringPriceHero recurringRates={rates} merchantSymbol={merchantSymbol} />
      <ProrationDetail
        proration={proration}
        amountDue={amountDue}
        currency={cur}
        merchantSymbol={merchantSymbol}
      />
    </div>
  );
}

/** @deprecated Use BillingQuotePanel — kept for imports that expect default export */
export default function ProrationBreakdown(props) {
  return (
    <BillingQuotePanel
      recurringRates={props.recurringRates}
      proration={props.proration}
      amountDue={props.amountDue ?? props.proration?.amount}
      currency={props.currency}
      merchantSymbol={props.merchantSymbol}
      fullCycle={props.fullCycle}
    />
  );
}

/**
 * Combined user-license quote (seat + extra stores).
 */
export function LicenseQuoteBreakdown({
  lineItems = [],
  totalAmount,
  currency,
  billingLabel,
  merchantSymbol,
  recurringRates,
}) {
  if (!lineItems.length) return null;
  const cur = currency || lineItems[0]?.currency || 'LKR';
  const total = Number(totalAmount) || lineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const first = lineItems[0]?.proration;
  const endDate = first?.periodEndsAt ? new Date(first.periodEndsAt) : null;
  const endLabel = endDate
    ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const remainingDays = first?.remainingDays;
  const daysPerMonth = first?.daysPerMonth ?? PRORATION_DAYS_PER_MONTH;

  return (
    <div className="space-y-3">
      {lineItems.length === 1 && lineItems[0].recurringRates ? (
        <RecurringPriceHero recurringRates={lineItems[0].recurringRates} merchantSymbol={merchantSymbol} />
      ) : recurringRates ? (
        <RecurringPriceHero recurringRates={recurringRates} merchantSymbol={merchantSymbol} />
      ) : null}

      <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
        {lineItems.map((item, idx) => {
          const monthly =
            Number(item.proration?.monthlyListPrice) > 0
              ? Number(item.proration.monthlyListPrice)
              : Number(item.proration?.fullAmount) || Number(item.recurringRates?.monthly) || 0;
          return (
            <li key={idx} className="px-4 py-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-700">{item.label}</span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(item.currency || cur, item.amount, merchantSymbol)}
                </span>
              </div>
              {item.recurringRates?.monthly > 0 ? (
                <p className="text-xs text-gray-500">
                  List price: {formatMoney(item.recurringRates.currency || cur, item.recurringRates.monthly, merchantSymbol)} / month
                </p>
              ) : null}
              {item.proration?.isProrated && monthly > 0 && (
                <p className="text-xs text-gray-500 font-mono">
                  ({formatMoney(item.currency || cur, monthly, merchantSymbol)} ÷ {daysPerMonth}) ×{' '}
                  {item.proration.remainingDays} days
                </p>
              )}
            </li>
          );
        })}
        <li className="flex justify-between px-4 py-3 bg-gray-50 font-bold">
          <span>Total due now</span>
          <span className="text-brand-orange tabular-nums">{formatMoney(cur, total, merchantSymbol)}</span>
        </li>
      </ul>

      {remainingDays ? (
        <p className="text-xs text-blue-900/80 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
          Each line: (monthly price ÷ {daysPerMonth}) × <strong>{remainingDays} days</strong> left in your
          current subscription{endLabel ? <> (ends {endLabel})</> : null}.
          {billingLabel ? ` ${billingLabel}` : ''}
        </p>
      ) : null}
    </div>
  );
}
