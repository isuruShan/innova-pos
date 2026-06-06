import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Loader, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import BillingBreakdownPanel from '../billing/BillingBreakdownPanel';
import { formatMoney, BillingQuotePanel, LicenseQuoteBreakdown } from '../billing/ProrationBreakdown';
import ConfirmDialog from '../common/ConfirmDialog';

const SUB_STATUS_STYLES = {
  trial:     { bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    dot: 'bg-sky-500',    label: 'Trial' },
  active:    { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Active' },
  expired:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Expired' },
  cancelled: { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Cancelled' },
};

function SubStatusBadge({ status }) {
  const s = SUB_STATUS_STYLES[status] || SUB_STATUS_STYLES.cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right sm:max-w-[65%]">{children}</span>
    </div>
  );
}

function TenantContextPanel({ ctx }) {
  if (!ctx) return null;
  const statusStyle = SUB_STATUS_STYLES[ctx.subscriptionStatus] || SUB_STATUS_STYLES.cancelled;
  const periodDate = ctx.periodEnd ? new Date(ctx.periodEnd) : null;
  const isExpired = ctx.subscriptionStatus === 'expired' || (periodDate && periodDate < new Date());
  const daysLeft = periodDate ? Math.ceil((periodDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className={`rounded-lg border ${statusStyle.border} ${statusStyle.bg} p-4`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Merchant subscription</p>
        <SubStatusBadge status={ctx.subscriptionStatus} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Current plan</p>
          <p className={`font-semibold ${statusStyle.text}`}>
            {ctx.planName || 'No plan assigned'}
            {ctx.planBillingCycle && <span className="text-xs font-normal text-gray-500 ml-1">({ctx.planBillingCycle})</span>}
          </p>
        </div>

        {periodDate && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">
              {ctx.subscriptionStatus === 'trial' ? 'Trial ends' : isExpired ? 'Expired on' : 'Period ends'}
            </p>
            <p className={`font-semibold ${isExpired ? 'text-red-600' : statusStyle.text}`}>
              {periodDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {daysLeft !== null && !isExpired && (
                <span className="text-xs font-normal text-gray-500 ml-1">({daysLeft}d left)</span>
              )}
              {isExpired && daysLeft !== null && (
                <span className="text-xs font-normal text-red-500 ml-1">({Math.abs(daysLeft)}d ago)</span>
              )}
            </p>
          </div>
        )}
      </div>

      {ctx.activeAddons?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200/60">
          <p className="text-xs text-gray-400 mb-1.5">Active add-ons</p>
          <div className="flex flex-wrap gap-1.5">
            {ctx.activeAddons.map((a) => (
              <span key={a} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-700 font-medium">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentReceiptDetailModal({ receiptId, onClose, onVerify, onReject, isMutating = false, mutationError = null, showTenantContext = true }) {
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [slipUrl, setSlipUrl] = useState(null);
  const [slipLoading, setSlipLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-receipt-detail', receiptId],
    queryFn: () => api.get(`/subscriptions/receipts/${receiptId}`).then((r) => r.data),
    enabled: Boolean(receiptId),
  });

  const receipt = data?.receipt;
  const kind = data?.receiptKindLabel || 'Payment';

  const actualBillingCycle = useMemo(() => {
    if (!receipt) return 'monthly';
    if (receipt.paymentBreakdown?.plan?.billingCycle) {
      return receipt.paymentBreakdown.plan.billingCycle;
    }
    if (receipt.paymentBreakdown?.plan?.durationDays === 365) {
      return 'yearly';
    }
    if (receipt.extensionDays === 365 || receipt.extensionDays === 366) {
      return 'yearly';
    }
    if (receipt.billingPeriodStart && receipt.billingPeriodEnd) {
      const diffDays = Math.ceil(
        (new Date(receipt.billingPeriodEnd) - new Date(receipt.billingPeriodStart)) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 360) return 'yearly';
      if (diffDays >= 28 && diffDays <= 32) return 'monthly';
    }
    if (receipt.requestedPlanId?.billingCycle) {
      return receipt.requestedPlanId.billingCycle;
    }
    return 'monthly';
  }, [receipt]);

  useEffect(() => {
    setSlipUrl(null);
    if (!receipt) return undefined;
    if (receipt.receiptFileUrl) {
      setSlipUrl(receipt.receiptFileUrl);
      return undefined;
    }
    if (!receipt.receiptFileKey) return undefined;
    let cancelled = false;
    setSlipLoading(true);
    api.get(`/subscriptions/receipts/${receiptId}/url`)
      .then(({ data: res }) => { if (!cancelled) setSlipUrl(res?.url || null); })
      .catch(() => { if (!cancelled) setSlipUrl(null); })
      .finally(() => { if (!cancelled) setSlipLoading(false); });
    return () => { cancelled = true; };
  }, [receipt, receiptId]);

  const handleVerifyConfirm = () => {
    setConfirmVerify(false);
    onVerify?.(receipt);
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) return;
    onReject?.(receipt, rejectionReason.trim());
    setRejectOpen(false);
    setRejectionReason('');
  };

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-start gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Payment details</h3>
            <p className="text-sm text-gray-500 mt-0.5">{kind}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div className="px-6 py-4">
          {isLoading && (
            <p className="text-sm text-gray-500 flex items-center gap-2 py-8 justify-center">
              <Loader size={16} className="animate-spin" /> Loading…
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 py-4">
              {error.response?.data?.message || 'Could not load payment details'}
            </p>
          )}
          {receipt && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 p-4">
                {showTenantContext && <DetailRow label="Merchant">{receipt.tenantId?.businessName || '—'}</DetailRow>}
                <DetailRow label="Status">
                  <span className="capitalize font-medium">{receipt.status}</span>
                </DetailRow>
                <DetailRow label="Amount">
                  <strong>{formatMoney(receipt.currency, receipt.amount)}</strong>
                </DetailRow>

                <DetailRow label="Payment method">{receipt.paymentMethod || '—'}</DetailRow>
                <DetailRow label="Bank reference">{receipt.bankReference || '—'}</DetailRow>
                <DetailRow label="Submitted">{new Date(receipt.paymentDate || receipt.createdAt).toLocaleString()}</DetailRow>
                {receipt.billingPeriodStart && receipt.billingPeriodEnd ? (
                  <DetailRow label="Billing Period">
                    {new Date(receipt.billingPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} to {new Date(receipt.billingPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </DetailRow>
                ) : null}
                {receipt.notes ? <DetailRow label="Notes">{receipt.notes}</DetailRow> : null}
                {receipt.verifiedAt ? (
                  <DetailRow label="Verified">
                    {new Date(receipt.verifiedAt).toLocaleString()}
                    {receipt.verifiedBy?.name ? ` by ${receipt.verifiedBy.name}` : ''}
                  </DetailRow>
                ) : null}
                {receipt.rejectionReason ? (
                  <DetailRow label="Rejection reason">
                    <span className="text-red-700">{receipt.rejectionReason}</span>
                  </DetailRow>
                ) : null}
              </div>

              {/* Merchant subscription context — shown for all receipt types (unless disabled) */}
              {showTenantContext && <TenantContextPanel ctx={data?.tenantContext} />}

              {data?.addonMeta && (
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-4 text-sm">
                  <p className="font-semibold text-violet-900">Add-on: {data.addonMeta.name}</p>
                  {data.addonMeta.shortDescription ? (
                    <p className="text-violet-800 mt-1">{data.addonMeta.shortDescription}</p>
                  ) : null}
                  <p className="text-xs text-violet-700 mt-1 font-mono">{data.addonMeta.code}</p>
                </div>
              )}

              {data?.storeMeta && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
                  <p className="font-semibold">{data.storeMeta.label}</p>
                  <p className="mt-1 text-blue-800">{data.storeMeta.description}</p>
                </div>
              )}

              {receipt.requestedPlanId && typeof receipt.requestedPlanId === 'object' && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requested plan</p>
                  <p className="font-semibold text-gray-900">{receipt.requestedPlanId.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatMoney(
                      receipt.requestedPlanId.currency,
                      receipt.requestedPlanId.amount ?? 
                      (actualBillingCycle === 'yearly'
                        ? receipt.requestedPlanId.yearlyPrice
                        : receipt.requestedPlanId.monthlyPrice) ??
                      0
                    )}
                    {' · '}
                    {actualBillingCycle === 'yearly' ? 365 : 30} days
                    {` · ${actualBillingCycle}`}
                  </p>
                  {receipt.extensionDays ? (
                    <p className="text-xs text-green-700 mt-2">Extended {receipt.extensionDays} days on verify</p>
                  ) : null}
                </div>
              )}

              {receipt.receiptKind === 'user_license' && receipt.userLicensePayload && (
                <div className="rounded-lg bg-violet-50/50 border border-violet-100 p-4 text-sm space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-violet-100 pb-2">
                    <p className="font-semibold text-violet-900 text-xs sm:text-sm">
                      Action: {receipt.userLicenseAction === 'create_user' ? 'Add New User Seat' : 'Adjust Store Assignments'}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 uppercase tracking-wide border border-violet-200">
                      User Add-on
                    </span>
                  </div>

                  {receipt.userLicenseAction === 'create_user' && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">New User Details</p>
                      <p className="text-sm font-semibold text-gray-900">{receipt.userLicensePayload?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {receipt.userLicensePayload?.email} · <span className="capitalize font-medium text-violet-700">{receipt.userLicensePayload?.role}</span>
                      </p>
                    </div>
                  )}

                  {receipt.userLicenseAction === 'assign_stores' && data?.userMeta && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target User Details</p>
                      <p className="text-sm font-semibold text-gray-900">{data.userMeta.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {data.userMeta.email} · <span className="capitalize font-medium text-violet-700">{data.userMeta.role}</span>
                      </p>
                    </div>
                  )}

                  {data?.storesMeta && data.storesMeta.length > 0 && (
                    <div className="space-y-1.5 pt-2.5 border-t border-violet-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Assigned Store Locations ({data.storesMeta.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.storesMeta.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-700 font-medium">
                            {s.name} ({s.code})
                          </span>
                        ))}
                      </div>
                      {receipt.userLicensePayload?.slotsToAdd > 0 && (
                        <p className="text-[11px] text-brand-orange font-bold mt-2">
                          * Adding {receipt.userLicensePayload.slotsToAdd} extra store {receipt.userLicensePayload.slotsToAdd === 1 ? 'slot' : 'slots'} for this user.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Show breakdown if present on the receipt itself, or fallback to data.billingBreakdown */}
              {receipt.paymentBreakdown ? (
                receipt.paymentBreakdown.plan ? (
                  <BillingBreakdownPanel breakdown={receipt.paymentBreakdown} hideOverview={true} />
                ) : receipt.paymentBreakdown.lineItems ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">License Breakdown</p>
                    <LicenseQuoteBreakdown
                      lineItems={receipt.paymentBreakdown.lineItems}
                      totalAmount={receipt.paymentBreakdown.priced?.amount || receipt.amount}
                      currency={receipt.paymentBreakdown.priced?.currency || receipt.currency}
                      recurringRates={receipt.paymentBreakdown.recurringRates}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Proration Breakdown</p>
                    <BillingQuotePanel
                      recurringRates={receipt.paymentBreakdown.recurringRates}
                      proration={receipt.paymentBreakdown.proration}
                      amountDue={receipt.paymentBreakdown.priced?.amount || receipt.amount}
                      currency={receipt.paymentBreakdown.priced?.currency || receipt.currency}
                      fullCycle={receipt.paymentBreakdown.fullCycle}
                    />
                  </div>
                )
              ) : data?.billingBreakdown?.plan ? (
                <BillingBreakdownPanel breakdown={data.billingBreakdown} hideOverview={true} />
              ) : (
                /* Fallback simple summary */
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">Amount paid</span>
                      <span className="font-bold text-gray-900">{formatMoney(receipt.currency, receipt.amount)}</span>
                    </div>

                    {data?.addonMeta && (
                      <div className="flex justify-between gap-2 pt-1 border-t border-gray-200">
                        <span className="text-gray-600">Add-on</span>
                        <span className="font-medium text-violet-700">{data.addonMeta.name}</span>
                      </div>
                    )}
                    {receipt.requestedPlanId && typeof receipt.requestedPlanId === 'object' && (
                      <div className="flex justify-between gap-2 pt-1 border-t border-gray-200">
                        <span className="text-gray-600">Plan</span>
                        <span className="font-medium text-gray-900">{receipt.requestedPlanId.name}</span>
                      </div>
                    )}
                    {receipt.extensionDays > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600">Extension</span>
                        <span className="font-medium text-green-700">+{receipt.extensionDays} days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {receipt.receiptFileKey && (
                slipUrl ? (
                  <a
                    href={slipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-orange hover:underline"
                  >
                    <ExternalLink size={14} /> View uploaded receipt file
                  </a>
                ) : slipLoading ? (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader size={14} className="animate-spin" /> Loading receipt file…
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Receipt file unavailable</p>
                )
              )}

              {receipt.status === 'pending' && (
                <>
                  {/* Rejection reason form */}
                  {rejectOpen && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                      <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                        <XCircle size={15} /> Reject this payment
                      </p>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        placeholder="Reason for rejection (required)…"
                        className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                        autoFocus
                        disabled={isMutating}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setRejectOpen(false); setRejectionReason(''); }}
                          disabled={isMutating}
                          className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleRejectSubmit}
                          disabled={!rejectionReason.trim() || isMutating}
                          className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isMutating ? <><Loader size={14} className="animate-spin" /> Rejecting…</> : 'Confirm rejection'}
                        </button>
                      </div>
                    </div>
                  )}

                  {mutationError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {mutationError}
                    </p>
                  )}

                  {!rejectOpen && (onVerify || onReject) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {onVerify && (
                        <button
                          type="button"
                          onClick={() => setConfirmVerify(true)}
                          disabled={isMutating}
                          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isMutating ? <Loader size={14} className="animate-spin" /> : null}
                          {isMutating ? 'Processing…' : 'Verify payment'}
                        </button>
                      )}
                      {onReject && (
                        <button
                          type="button"
                          onClick={() => setRejectOpen(true)}
                          disabled={isMutating}
                          className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Confirm verify dialog */}
    <ConfirmDialog
      open={confirmVerify}
      variant="success"
      title="Verify this payment?"
      message={`This will mark the payment as verified${receipt?.extensionDays > 0 ? ` and extend the subscription by ${receipt.extensionDays} day(s)` : ''}. This action cannot be undone.`}
      confirmLabel="Yes, verify"
      onConfirm={handleVerifyConfirm}
      onCancel={() => setConfirmVerify(false)}
    />
    </>
  );
}
