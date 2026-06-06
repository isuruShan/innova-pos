import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, Mail, Calendar, RefreshCw, FileText, CheckCircle, MessageSquare, Clock, User, X } from 'lucide-react';
import api from '../../api/axios';
import SortableTh from '../../components/common/SortableTh';
import ListPagination from '../../components/common/ListPagination';
import { useListSort } from '../../hooks/useListSort';
import { useToast } from '../../context/ToastContext';

const STATUS_COLORS = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-gray-50 text-gray-750 border-gray-200',
};

const STATUS_LABELS = {
  new: 'New Lead',
  contacted: 'Contacted',
  closed: 'Closed / Handled',
};

export default function ProspectsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [selectedProspect, setSelectedProspect] = useState(null);
  
  const { sort, order, toggleSort, sortParams } = useListSort('createdAt', 'desc');

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearch(q);
    setPage(1);
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [sort, order]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['prospects', statusFilter, search, page, sortParams],
    queryFn: async () => {
      const params = { page, limit: 20, sort, order };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await api.get('/prospects', { params });
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.put(`/prospects/${id}`, { status });
      return data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success(`Prospect status updated to ${STATUS_LABELS[updated.status]}`);
      if (selectedProspect && selectedProspect._id === updated._id) {
        setSelectedProspect(updated);
      }
    },
    onError: () => {
      toast.error('Failed to update prospect status');
    },
  });

  const prospects = data?.items || [];
  const totalPages = data?.pages || 1;
  const totalCount = data?.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Prospect Leads</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage and trace inquiries submitted through the public website contact form</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, subject..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
          Error loading prospects: {error.message || 'An error occurred'}
        </div>
      ) : prospects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-450">
          <MessageSquare size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-700">No leads found</p>
          <p className="text-sm mt-1 text-gray-500">There are no contact inquiries matching your active filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Email" field="email" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 text-gray-500 font-semibold select-none">Subject</th>
                  <SortableTh label="Status" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <SortableTh label="Submitted At" field="createdAt" currentSort={sort} currentOrder={order} onSort={toggleSort} />
                  <th className="px-4 py-3 text-gray-500 font-semibold select-none text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prospects.map((prospect) => (
                  <tr key={prospect._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{prospect.name}</td>
                    <td className="px-4 py-3.5">
                      <a href={`mailto:${prospect.email}`} className="text-brand-orange hover:underline flex items-center gap-1.5">
                        <Mail size={14} className="shrink-0" />
                        <span>{prospect.email}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs truncate" title={prospect.subject}>
                      {prospect.subject || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[prospect.status] || ''}`}>
                        {STATUS_LABELS[prospect.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-550">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{new Date(prospect.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs text-gray-400">{new Date(prospect.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedProspect(prospect)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        <FileText size={14} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3">
              <ListPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalCount}
                itemsPerPage={20}
              />
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-550 bg-opacity-75 transition-opacity" onClick={() => setSelectedProspect(null)} />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4 border-b border-gray-150 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare size={18} className="text-brand-orange" />
                  <span>Lead Details</span>
                </h3>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">Prospect Name</label>
                    <p className="text-sm font-semibold text-gray-900 mt-1 flex items-center gap-1.5">
                      <User size={14} className="text-gray-400" />
                      {selectedProspect.name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">Email Address</label>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      <a href={`mailto:${selectedProspect.email}`} className="text-brand-orange hover:underline flex items-center gap-1.5">
                        <Mail size={14} className="shrink-0" />
                        {selectedProspect.email}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">Submission Date</label>
                    <p className="text-sm text-gray-700 mt-1">
                      {new Date(selectedProspect.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">Lead Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[selectedProspect.status] || ''}`}>
                        {STATUS_LABELS[selectedProspect.status]}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">Subject</label>
                  <p className="text-sm font-semibold text-gray-800 mt-1">{selectedProspect.subject || '(No Subject)'}</p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">Message Inquiry</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-1.5 text-sm text-gray-750 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedProspect.message}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t border-gray-150 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Update Status:</span>
                  <div className="flex items-center gap-1">
                    {['new', 'contacted', 'closed'].map((status) => (
                      <button
                        key={status}
                        disabled={selectedProspect.status === status || updateStatusMutation.isLoading}
                        onClick={() => updateStatusMutation.mutate({ id: selectedProspect._id, status })}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                          selectedProspect.status === status
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        {status === 'new' ? 'New' : status === 'contacted' ? 'Contacted' : 'Close'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setSelectedProspect(null)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
