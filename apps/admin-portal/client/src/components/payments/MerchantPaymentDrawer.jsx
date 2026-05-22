import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { formatMoney } from '../billing/ProrationBreakdown';
import { unwrapPagedList } from '../../utils/unwrapPagedList';

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const KIND_BADGE = {
  subscription: 'bg-slate-100 text-slate-700',
  addon:        'bg-violet-100 text-violet-800',
  store:        'bg-blue-100 text-blue-800',
  user_license: 'bg-amber-100 text-amber-800',
};

export default function MerchantPaymentDrawer({ tenantId, tenantName, onClose, onViewReceipt }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-payment-history', tenantId, page],
    queryFn: () =>
      api.get(`/subscriptions/receipts/by-tenant/${tenantId}`, { params: { page, limit: 10 } }).then((r) => r.data),
    enabled: Boolean(tenantId),
    keepPreviousData: true,
  });

  const receipts = data?.items || [];
  const tenant = data?.tenant;
  const pages = data?.pages || 1;
  const total = data?.total || 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Payment history for ${tenantName}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{tenantName}</h3>
            {tenant && (
              <p className="text-sm text-gray-500 mt-0.5 capitalize">
                {tenant.subscriptionStatus || 'Active'} · {total} payment{total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 gap-2">
              <Loader size={16} className="animate-spin" /> Loading…
            </div>
          ) : !receipts.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Receipt size={28} className="mb-2" />
              <p className="text-sm">No payments found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {receipts.map((r) => (
                <div key={r._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${KIND_BADGE[r.receiptKind] || 'bg-gray-100 text-gray-700'}`}>
                          {r.receiptKind?.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{r.purchasedItemLabel || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.paymentDate || r.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        {r.bankReference ? ` · Ref: ${r.bankReference}` : ''}
                        {r.paymentMethod ? ` · ${r.paymentMethod.replace('_', ' ')}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        {formatMoney(r.currency, r.amount)}
                      </p>
                      {onViewReceipt && (
                        <button
                          type="button"
                          onClick={() => onViewReceipt(r._id)}
                          className="text-xs text-brand-orange hover:underline mt-1 font-medium"
                        >
                          View detail
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
