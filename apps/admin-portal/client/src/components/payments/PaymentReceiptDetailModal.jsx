import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Loader, XCircle } from 'lucide-react';
import api from '../../api/axios';
import BillingBreakdownPanel from '../billing/BillingBreakdownPanel';
import { formatMoney } from '../billing/ProrationBreakdown';
import ConfirmDialog from '../common/ConfirmDialog';

function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right sm:max-w-[65%]">{children}</span>
    </div>
  );
}

export default function PaymentReceiptDetailModal({ receiptId, onClose, onVerify, onReject }) {
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-receipt-detail', receiptId],
    queryFn: () => api.get(`/subscriptions/receipts/${receiptId}`).then((r) => r.data),
    enabled: Boolean(receiptId),
  });

  const receipt = data?.receipt;
  const kind = data?.receiptKindLabel || 'Payment';

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
                <DetailRow label="Merchant">{receipt.tenantId?.businessName || '—'}</DetailRow>
                <DetailRow label="Status">
                  <span className="capitalize font-medium">{receipt.status}</span>
                </DetailRow>
                <DetailRow label="Amount">
                  <strong>{formatMoney(receipt.currency, receipt.amount)}</strong>
                </DetailRow>
                <DetailRow label="Expected">
                  {formatMoney(receipt.currency, receipt.expectedAmount)}
                  {receipt.amountMatchesExpected ? (
                    <span className="ml-2 text-green-700 text-xs">(matches)</span>
                  ) : (
                    <span className="ml-2 text-red-600 text-xs">(mismatch)</span>
                  )}
                </DetailRow>
                <DetailRow label="Payment method">{receipt.paymentMethod || '—'}</DetailRow>
                <DetailRow label="Bank reference">{receipt.bankReference || '—'}</DetailRow>
                <DetailRow label="Submitted">{new Date(receipt.paymentDate || receipt.createdAt).toLocaleString()}</DetailRow>
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
                    {formatMoney(receipt.requestedPlanId.currency, receipt.requestedPlanId.amount)}
                    {' · '}
                    {receipt.requestedPlanId.durationDays} days
                    {receipt.requestedPlanId.billingCycle ? ` · ${receipt.requestedPlanId.billingCycle}` : ''}
                  </p>
                  {receipt.extensionDays ? (
                    <p className="text-xs text-green-700 mt-2">Extended {receipt.extensionDays} days on verify</p>
                  ) : null}
                </div>
              )}

              {data?.billingBreakdown?.plan && (
                <BillingBreakdownPanel breakdown={data.billingBreakdown} />
              )}

              {receipt.receiptFileUrl && (
                <a
                  href={receipt.receiptFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-orange hover:underline"
                >
                  <ExternalLink size={14} /> View uploaded receipt file
                </a>
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
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setRejectOpen(false); setRejectionReason(''); }}
                          className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleRejectSubmit}
                          disabled={!rejectionReason.trim()}
                          className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm rejection
                        </button>
                      </div>
                    </div>
                  )}

                  {!rejectOpen && (onVerify || onReject) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {onVerify && (
                        <button
                          type="button"
                          onClick={() => setConfirmVerify(true)}
                          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                        >
                          Verify payment
                        </button>
                      )}
                      {onReject && (
                        <button
                          type="button"
                          onClick={() => setRejectOpen(true)}
                          className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50"
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-receipt-detail', receiptId],
    queryFn: () => api.get(`/subscriptions/receipts/${receiptId}`).then((r) => r.data),
    enabled: Boolean(receiptId),
  });

  const receipt = data?.receipt;
  const kind = data?.receiptKindLabel || 'Payment';

  return (
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
                <DetailRow label="Merchant">{receipt.tenantId?.businessName || '—'}</DetailRow>
                <DetailRow label="Status">
                  <span className="capitalize font-medium">{receipt.status}</span>
                </DetailRow>
                <DetailRow label="Amount">
                  <strong>{formatMoney(receipt.currency, receipt.amount)}</strong>
                </DetailRow>
                <DetailRow label="Expected">
                  {formatMoney(receipt.currency, receipt.expectedAmount)}
                  {receipt.amountMatchesExpected ? (
                    <span className="ml-2 text-green-700 text-xs">(matches)</span>
                  ) : (
                    <span className="ml-2 text-red-600 text-xs">(mismatch)</span>
                  )}
                </DetailRow>
                <DetailRow label="Payment method">{receipt.paymentMethod || '—'}</DetailRow>
                <DetailRow label="Bank reference">{receipt.bankReference || '—'}</DetailRow>
                <DetailRow label="Submitted">{new Date(receipt.paymentDate || receipt.createdAt).toLocaleString()}</DetailRow>
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
                    {formatMoney(receipt.requestedPlanId.currency, receipt.requestedPlanId.amount)}
                    {' · '}
                    {receipt.requestedPlanId.durationDays} days
                    {receipt.requestedPlanId.billingCycle ? ` · ${receipt.requestedPlanId.billingCycle}` : ''}
                  </p>
                  {receipt.extensionDays ? (
                    <p className="text-xs text-green-700 mt-2">Extended {receipt.extensionDays} days on verify</p>
                  ) : null}
                </div>
              )}

              {data?.billingBreakdown?.plan && (
                <BillingBreakdownPanel breakdown={data.billingBreakdown} />
              )}

              {receipt.receiptFileUrl && (
                <a
                  href={receipt.receiptFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-orange hover:underline"
                >
                  <ExternalLink size={14} /> View uploaded receipt file
                </a>
              )}

              {receipt.status === 'pending' && (onVerify || onReject) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {onVerify && (
                    <button
                      type="button"
                      onClick={() => onVerify(receipt)}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                    >
                      Verify payment
                    </button>
                  )}
                  {onReject && (
                    <button
                      type="button"
                      onClick={() => onReject(receipt)}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
