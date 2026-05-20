import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ExternalLink, RefreshCw, Loader, Receipt, Search, Eye } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import ListPagination from '../../components/common/ListPagination';
import PaymentReceiptDetailModal from '../../components/payments/PaymentReceiptDetailModal';
import { unwrapPagedList } from '../../utils/unwrapPagedList';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const KIND_BADGE = {
  subscription: 'bg-slate-100 text-slate-700',
  addon: 'bg-violet-100 text-violet-800',
  store: 'bg-blue-100 text-blue-800',
};

function receiptKindKey(r) {
  if (r.receiptKind === 'store') return 'store';
  if (r.receiptKind === 'addon' || r.addonCode) return 'addon';
  return 'subscription';
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [verifyingId, setVerifyingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [detailReceiptId, setDetailReceiptId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_payments') || 'grid');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight) {
      setDetailReceiptId(highlight);
      setStatusFilter('pending');
    }
  }, [searchParams]);

  const openDetail = (id) => {
    setDetailReceiptId(id);
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('highlight', id);
      return n;
    }, { replace: true });
  };

  const closeDetail = () => {
    setDetailReceiptId(null);
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('highlight');
      return n;
    }, { replace: true });
  };

  const { data: receiptList = { items: [], page: 1, pages: 1, total: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['receipts', statusFilter, page, search],
    queryFn: async () => {
      const params = { page, limit: 25 };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get('/subscriptions/receipts', { params });
      return unwrapPagedList(data);
    },
  });
  const receipts = receiptList.items || [];

  const mutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/subscriptions/receipts/${id}/verify`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['payment-receipt-detail'] });
      setVerifyingId(null);
      setRejectingId(null);
      setRejectionReason('');
      closeDetail();
    },
  });

  const handleVerify = (id) => {
    mutation.mutate({ id, payload: { action: 'verify' } });
  };

  const handleReject = (id) => {
    if (!rejectionReason.trim()) return;
    mutation.mutate({ id, payload: { action: 'reject', rejectionReason } });
  };

  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_payments', mode);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Payment Receipts</h2>
        <p className="text-sm text-gray-500 mt-0.5">Verify merchant payment receipts and extend subscriptions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by merchant name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        {['pending', 'verified', 'rejected'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-brand-brown-deep text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !statusFilter ? 'bg-brand-brown-deep text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} />
        </button>
        <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading receipts...</div>
      ) : !receipts?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Receipt size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No {statusFilter} receipts found</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Merchant', 'Type', 'Amount', 'Reference', 'Status', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((r) => {
                const kind = receiptKindKey(r);
                return (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.tenantId?.businessName || 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${KIND_BADGE[kind]}`}>{kind}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.currency || 'LKR'} {r.amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.bankReference}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(r.paymentDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(r._id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Eye size={12} /> View
                        </button>
                        {r.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVerify(r._id)}
                              disabled={mutation.isPending}
                              className="text-xs text-green-700 font-medium hover:underline"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openDetail(r._id);
                                setRejectingId(r._id);
                              }}
                              className="text-xs text-red-700 font-medium hover:underline"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {receipts.map((r) => {
            const kind = receiptKindKey(r);
            return (
              <div key={r._id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <p className="font-semibold text-gray-900">{r.tenantId?.businessName || 'Unknown merchant'}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${KIND_BADGE[kind]}`}>{kind}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400">Amount</p>
                        <p className="font-semibold text-gray-800">
                          {r.currency || 'LKR'} {r.amount?.toLocaleString()}
                        </p>
                        {r.expectedAmount > 0 && (
                          <p className="text-gray-500">Expected {Number(r.expectedAmount).toLocaleString()}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-400">Bank reference</p>
                        <p className="font-medium text-gray-700">{r.bankReference}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Method</p>
                        <p className="font-medium text-gray-700">{r.paymentMethod || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Submitted</p>
                        <p className="font-medium text-gray-700">{new Date(r.paymentDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {r.notes && <p className="text-xs text-gray-500 mt-2 italic">{r.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openDetail(r._id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-brand-orange text-brand-orange rounded-lg text-xs font-semibold hover:bg-brand-orange/5"
                    >
                      <Eye size={12} /> View payment
                    </button>
                    {r.receiptFileUrl && (
                      <a
                        href={r.receiptFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink size={12} /> Receipt file
                      </a>
                    )}
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyingId(verifyingId === r._id ? null : r._id);
                            setRejectingId(null);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                        >
                          <CheckCircle size={12} /> Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(rejectingId === r._id ? null : r._id);
                            setVerifyingId(null);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                    {r.status === 'verified' && r.extensionDays > 0 && (
                      <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                        +{r.extensionDays} days extended
                      </div>
                    )}
                  </div>
                </div>

                {verifyingId === r._id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 mb-3">
                      Open <strong>View payment</strong> for the full billing breakdown, then confirm verification.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleVerify(r._id)}
                      disabled={mutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                    >
                      {mutation.isPending ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Confirm verify
                    </button>
                  </div>
                )}

                {rejectingId === r._id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rejection reason *</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                      placeholder="Explain why this receipt is being rejected..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none mb-3"
                    />
                    <button
                      type="button"
                      onClick={() => handleReject(r._id)}
                      disabled={mutation.isPending || !rejectionReason.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      {mutation.isPending ? <Loader size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Confirm rejection
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && receipts?.length > 0 && (
        <ListPagination
          page={receiptList.page}
          pages={receiptList.pages}
          total={receiptList.total}
          onPageChange={setPage}
          isFetching={isFetching}
        />
      )}

      {detailReceiptId && (
        <PaymentReceiptDetailModal
          receiptId={detailReceiptId}
          onClose={closeDetail}
          onVerify={(receipt) => handleVerify(receipt._id)}
          onReject={() => {
            setRejectingId(detailReceiptId);
            closeDetail();
          }}
        />
      )}
    </div>
  );
}
