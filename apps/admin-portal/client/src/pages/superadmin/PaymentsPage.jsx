import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink, RefreshCw, Loader, Receipt,
  Search, Eye, BarChart2, Filter, X, CalendarDays,
} from 'lucide-react';
import api from '../../api/axios';
import ListPagination from '../../components/common/ListPagination';
import SortableTh from '../../components/common/SortableTh';
import PaymentReceiptDetailModal from '../../components/payments/PaymentReceiptDetailModal';
import MerchantPaymentDrawer from '../../components/payments/MerchantPaymentDrawer';
import PaymentAnalyticsDashboard from '../../components/payments/PaymentAnalyticsDashboard';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useListSort } from '../../hooks/useListSort';
import { formatMoney } from '../../components/billing/ProrationBreakdown';

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

const KIND_LABELS = {
  '':             'All types',
  subscription:   'Subscription',
  addon:          'Add-on',
  store:          'Store',
  user_license:   'User seat',
};

const METHOD_LABELS = {
  '':              'All methods',
  bank_transfer:   'Bank transfer',
  stripe:          'Stripe',
  paypal:          'PayPal',
};

function receiptKindKey(r) {
  if (r.receiptKind) return r.receiptKind;
  if (r.addonCode) return 'addon';
  return 'subscription';
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
        active
          ? 'bg-brand-orange text-white shadow-sm'
          : 'border border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab
  const [activeTab, setActiveTab] = useState('receipts');

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [kindFilter, setKindFilter]     = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [showFilters, setShowFilters]   = useState(false);
  const { sort, order, toggleSort, sortParams } = useListSort('createdAt', 'desc');

  // Detail modal / actions
  const [detailReceiptId, setDetailReceiptId] = useState(null);

  // Merchant drawer
  const [merchantDrawer, setMerchantDrawer] = useState(null); // { tenantId, name }

  const handleViewReceipt = async (receiptId, fallbackUrl) => {
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const { data: res } = await api.get(`/subscriptions/receipts/${receiptId}/url`);
      if (res?.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Could not retrieve receipt URL');
      }
    } catch {
      toast.error('Failed to load receipt URL');
    }
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, kindFilter, methodFilter, dateFrom, dateTo, search, sort, order]);

  // Handle deep-link highlight
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight) {
      setDetailReceiptId(highlight);
      setStatusFilter('pending');
    }
  }, [searchParams]);

  const openDetail = (id) => {
    setDetailReceiptId(id);
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('highlight', id); return n; }, { replace: true });
  };

  const closeDetail = () => {
    setDetailReceiptId(null);
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('highlight'); return n; }, { replace: true });
  };

  // Build query params
  const queryParams = { page, limit: 25, sort, order };
  if (statusFilter)  queryParams.status  = statusFilter;
  if (kindFilter)    queryParams.kind    = kindFilter;
  if (methodFilter)  queryParams.method  = methodFilter;
  if (dateFrom)      queryParams.dateFrom = dateFrom;
  if (dateTo)        queryParams.dateTo  = dateTo;
  if (search.trim()) queryParams.search  = search.trim();

  const { data: receiptList = { items: [], page: 1, pages: 1, total: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['receipts', queryParams, sortParams],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/receipts', { params: queryParams });
      return unwrapPagedList(data);
    },
    enabled: activeTab === 'receipts',
  });
  const receipts = receiptList.items || [];

  const mutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/subscriptions/receipts/${id}/verify`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['payment-receipt-detail'] });
      queryClient.invalidateQueries({ queryKey: ['payment-analytics'] });
      closeDetail();
    },
  });

  const handleVerify = (id) => mutation.mutate({ id, payload: { action: 'verify' } });
  const handleReject = (id, rejectionReason) => {
    if (!rejectionReason?.trim()) return;
    mutation.mutate({ id, payload: { action: 'reject', rejectionReason } });
  };

  const hasActiveFilters = kindFilter || methodFilter || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payments</h2>
          <p className="text-sm text-gray-500 mt-0.5">Verify receipts, drill into merchant history, and view revenue analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
        {[
          { id: 'receipts',  label: 'Receipts',  icon: Receipt },
          { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === id
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── RECEIPTS TAB ─────────────────────────── */}
      {activeTab === 'receipts' && (
        <>
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            {/* Row 1: search + status chips + actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search merchant…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <Chip active={!statusFilter} onClick={() => setStatusFilter('')}>All</Chip>
                {['pending', 'verified', 'rejected'].map((s) => (
                  <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                    {s}
                  </Chip>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((f) => !f)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'border-brand-orange text-brand-orange bg-brand-orange/5'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Filter size={14} />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-brand-orange text-white text-[10px] flex items-center justify-center">
                      {[kindFilter, methodFilter, dateFrom || dateTo].filter(Boolean).length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Row 2: advanced filters (collapsible) */}
            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                {/* Kind */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Item type</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(KIND_LABELS).map(([k, label]) => (
                      <Chip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/* Method */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment method</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(METHOD_LABELS).map(([m, label]) => (
                      <Chip key={m} active={methodFilter === m} onClick={() => setMethodFilter(m)}>
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/* Date range */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <CalendarDays size={12} /> Date range
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                    />
                    <span className="text-gray-400 text-sm">→</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                    />
                    {(dateFrom || dateTo) && (
                      <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    )}
                  </div>
                </div>

                {/* Clear all */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => { setKindFilter(''); setMethodFilter(''); setDateFrom(''); setDateTo(''); }}
                    className="self-end text-xs text-red-500 hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results count */}
          {!isLoading && (
            <p className="text-xs text-gray-400 px-0.5">
              {receiptList.total} receipt{receiptList.total !== 1 ? 's' : ''} found
              {statusFilter && ` · ${statusFilter}`}
              {kindFilter && ` · ${KIND_LABELS[kindFilter]}`}
              {methodFilter && ` · ${METHOD_LABELS[methodFilter]}`}
            </p>
          )}

          {/* List */}
          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader size={16} className="animate-spin" /> Loading receipts…
            </div>
          ) : !receipts.length ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Receipt size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No receipts found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Merchant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Item purchased</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Type</th>
                    <SortableTh label="Amount" field="amount" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Method</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Reference</th>
                    <SortableTh label="Created" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                    <SortableTh label="Payment date" field="paymentDate" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                    <SortableTh label="Status" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipts.map((r) => {
                    const kind = receiptKindKey(r);
                    return (
                      <tr key={r._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetail(r._id)}>
                        {/* Merchant — clickable drill-down */}
                        <td className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => setMerchantDrawer({ tenantId: r.tenantId?._id, name: r.tenantId?.businessName || 'Unknown' })}
                            className="text-brand-orange hover:underline font-semibold text-left"
                            title="View merchant payment history"
                          >
                            {r.tenantId?.businessName || 'Unknown'}
                          </button>
                        </td>
                        {/* Item purchased */}
                        <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                          <span className="truncate block" title={r.purchasedItemLabel}>{r.purchasedItemLabel || '—'}</span>
                        </td>
                        {/* Type badge */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${KIND_BADGE[kind] || 'bg-gray-100 text-gray-700'}`}>
                            {kind.replace('_', ' ')}
                          </span>
                        </td>
                        {/* Amount */}
                        <td className="px-4 py-3 font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                          {formatMoney(r.currency, r.amount)}
                        </td>
                        {/* Method */}
                        <td className="px-4 py-3 text-gray-600 capitalize whitespace-nowrap">
                          {METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—'}
                        </td>
                        {/* Reference */}
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.bankReference || '—'}</td>
                        {/* Created */}
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        {/* Payment date */}
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {r.paymentDate
                            ? new Date(r.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                            {r.status}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {r.receiptFileKey && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleViewReceipt(r._id, r.receiptFileUrl); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                                title="View receipt file"
                              >
                                <ExternalLink size={12} />
                              </button>
                            )}
                            {r.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openDetail(r._id); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600"
                              >
                                <Eye size={12} /> Verify
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openDetail(r._id); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <Eye size={12} /> View
                              </button>
                            )}
                            {r.status === 'verified' && r.extensionDays > 0 && (
                              <span className="text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-lg" onClick={(e) => e.stopPropagation()}>
                                +{r.extensionDays}d
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && receipts.length > 0 && (
            <ListPagination
              page={receiptList.page}
              pages={receiptList.pages}
              total={receiptList.total}
              onPageChange={setPage}
              isFetching={isFetching}
            />
          )}
        </>
      )}

      {/* ── ANALYTICS TAB ─────────────────────── */}
      {activeTab === 'analytics' && (
        <PaymentAnalyticsDashboard
          onPendingClick={() => { setActiveTab('receipts'); setStatusFilter('pending'); }}
        />
      )}

      {/* Detail modal */}
      {detailReceiptId && (
        <PaymentReceiptDetailModal
          receiptId={detailReceiptId}
          onClose={closeDetail}
          onVerify={(receipt) => handleVerify(receipt._id)}
          onReject={(receipt, reason) => handleReject(receipt._id, reason)}
          isMutating={mutation.isPending}
          mutationError={mutation.isError ? (mutation.error?.response?.data?.message || 'Action failed') : null}
        />
      )}  

      {/* Merchant history drawer */}
      {merchantDrawer && (
        <MerchantPaymentDrawer
          tenantId={merchantDrawer.tenantId}
          tenantName={merchantDrawer.name}
          onClose={() => setMerchantDrawer(null)}
          onViewReceipt={(id) => { openDetail(id); }}
        />
      )}
    </div>
  );
}
