/**
 * Shows first-payment proration for add-ons / additional stores.
 */
export default function ProrationBreakdown({ proration, fullCycle, currency }) {
  if (!proration) return null;
  const cur = proration.currency || currency || 'LKR';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm space-y-2">
      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">First payment (prorated)</p>
      {proration.isProrated && fullCycle?.amount != null ? (
        <div className="flex justify-between text-blue-900/80">
          <span>Full {fullCycle.label || 'cycle'} price</span>
          <span className="tabular-nums">
            {cur} {Number(fullCycle.amount).toLocaleString()}
          </span>
        </div>
      ) : null}
      {proration.isProrated ? (
        <div className="flex justify-between text-blue-900/80">
          <span>
            {proration.remainingDays} of {proration.cycleDays} days remaining
          </span>
          <span className="tabular-nums text-xs">
            {proration.periodEndsAt
              ? `Period ends ${new Date(proration.periodEndsAt).toLocaleDateString()}`
              : null}
          </span>
        </div>
      ) : null}
      <div className="flex justify-between font-semibold text-blue-950">
        <span>Amount due now</span>
        <span className="tabular-nums">
          {cur} {Number(proration.amount).toLocaleString()}
        </span>
      </div>
      {proration.note ? <p className="text-xs text-blue-800/90 leading-relaxed">{proration.note}</p> : null}
    </div>
  );
}
