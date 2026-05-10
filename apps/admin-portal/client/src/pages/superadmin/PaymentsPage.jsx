import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ExternalLink, RefreshCw, Loader, Receipt } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [verifyingId, setVerifyingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_payments') || 'grid');

  const { data: receipts, isLoading, refetch } = useQuery({
    queryKey: ['receipts', statusFilter],
    queryFn: async () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/subscriptions/receipts', { params });
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/subscriptions/receipts/${id}/verify`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      setVerifyingId(null);
      setRejectingId(null);
      setRejectionReason('');
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

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 flex-wrap">
        {['pending', 'verified', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-brand-brown-deep text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            {s}
          </button>
        ))}
        <button onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !statusFilter ? 'bg-brand-brown-deep text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}>
          All
        </button>
        <button onClick={() => refetch()} className="ml-auto flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
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
                {['Merchant', 'Amount', 'Reference', 'Status', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.tenantId?.businessName || 'Unknown merchant'}</td>
                  <td className="px-4 py-3 text-gray-700">Rs. {r.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{r.bankReference}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.paymentDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {r.receiptFileUrl && (
                      <a href={r.receiptFileUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                        <ExternalLink size={12} />
                        Receipt
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {receipts.map(r => (
            <div key={r._id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <p className="font-semibold text-gray-900">{r.tenantId?.businessName || 'Unknown merchant'}</p>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400">Amount</p>
                      <p className="font-semibold text-gray-800">Rs. {r.amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Bank reference</p>
                      <p className="font-medium text-gray-700">{r.bankReference}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Bank</p>
                      <p className="font-medium text-gray-700">{r.bankName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Payment date</p>
                      <p className="font-medium text-gray-700">{new Date(r.paymentDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {r.notes && <p className="text-xs text-gray-500 mt-2 italic">{r.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.receiptFileUrl && (
                    <a href={r.receiptFileUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                      <ExternalLink size={12} />
                      Receipt
                    </a>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => { setVerifyingId(verifyingId === r._id ? null : r._id); setRejectingId(null); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        <CheckCircle size={12} /> Verify
                      </button>
                      <button onClick={() => { setRejectingId(rejectingId === r._id ? null : r._id); setVerifyingId(null); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                        <XCircle size={12} /> Reject
                      </button>
                    </>
                  )}
                  {r.status === 'verified' && (
                    <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                      +{r.extensionDays} days extended
                    </div>
                  )}
                </div>
              </div>

              {/* Verify panel */}
              {verifyingId === r._id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500">Requested plan</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {r.requestedPlanId?.name || 'Not set'}
                    </p>
                    {r.requestedPlanId && (
                      <p className="text-xs text-gray-600 mt-1">
                        {r.requestedPlanId.currency || 'LKR'} {Number(r.requestedPlanId.amount).toLocaleString()} · {r.requestedPlanId.durationDays} days
                      </p>
                    )}
                  </div>
                  <button onClick={() => handleVerify(r._id)} disabled={mutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                    {mutation.isPending ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Confirm Plan & Extend
                  </button>
                </div>
              )}

              {/* Reject panel */}
              {rejectingId === r._id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rejection reason *</label>
                  <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2}
                    placeholder="Explain why this receipt is being rejected..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-3" />
                  <button onClick={() => handleReject(r._id)} disabled={mutation.isPending || !rejectionReason.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                    {mutation.isPending ? <Loader size={14} className="animate-spin" /> : <XCircle size={14} />}
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
