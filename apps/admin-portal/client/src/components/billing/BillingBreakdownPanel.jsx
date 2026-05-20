/**
 * Line-item breakdown for subscription renewal totals.
 * @param {{ plan?: { name: string, amount: number }, addons?: Array<{ label: string, amount: number, quantity?: number }>, total: number, currency: string }} breakdown
 */
export default function BillingBreakdownPanel({ breakdown }) {
  if (!breakdown?.plan) return null;
  const { plan, addons = [], total, currency } = breakdown;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Billing breakdown</p>
      {plan.isScheduledChange ? (
        <p className="text-xs text-blue-800">Upcoming plan change — totals use your next billing cycle.</p>
      ) : null}
      <div className="flex justify-between gap-4 text-gray-800">
        <span>{plan.name}</span>
        <span className="tabular-nums shrink-0">
          {currency} {Number(plan.amount).toLocaleString()}
        </span>
      </div>
      {addons.map((line) => (
        <div key={line.code || line.label} className="flex justify-between gap-4 text-gray-700">
          <span>
            {line.label}
            {line.quantity > 1 ? ` (×${line.quantity})` : ''}
          </span>
          <span className="tabular-nums shrink-0">
            {currency} {Number(line.amount).toLocaleString()}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-4 pt-2 border-t border-gray-200 font-semibold text-gray-900">
        <span>Total due</span>
        <span className="tabular-nums">
          {currency} {Number(total).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
