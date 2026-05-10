import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Filter, Eye, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const STATUS_STYLES = {
  pending:      'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved:     'bg-green-100 text-green-700',
  rejected:     'bg-red-100 text-red-700',
};

const STATUS_ICONS = {
  pending:      Clock,
  under_review: RefreshCw,
  approved:     CheckCircle,
  rejected:     XCircle,
};

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_applications') || 'table');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['applications', statusFilter, search, page],
    queryFn: async () => {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await api.get('/applications', { params });
      return data;
    },
  });

  const counts = {
    all: data?.total,
    pending: undefined,
    under_review: undefined,
    approved: undefined,
    rejected: undefined,
  };

  const onViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_applications', mode);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Merchant Applications</h2>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve merchant signup requests</p>
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
            placeholder="Search by name, email or business..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={() => refetch()} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} />
          Refresh
        </button>
        <div className="sm:ml-auto">
          <ViewModeToggle mode={viewMode} setMode={onViewModeChange} />
        </div>
      </div>

      {/* Table / Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading applications...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">
            <p className="font-medium">Failed to load applications</p>
            <p className="text-sm text-red-600/90 mt-2 max-w-md mx-auto">
              {error.response?.data?.message || error.message || 'Check that the admin API is running and you are signed in as superadmin.'}
            </p>
          </div>
        ) : !data?.applications?.length ? (
          <div className="p-12 text-center text-gray-400">No applications found</div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.applications.map((app) => {
              const st = app.status || 'pending';
              const Icon = STATUS_ICONS[st] || Clock;
              return (
                <div key={app._id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {app.personal?.firstName || '—'} {app.personal?.lastName || ''}
                      </p>
                      <p className="text-xs text-gray-500">{app.personal?.email || '—'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[st] || 'bg-gray-100 text-gray-700'}`}>
                      <Icon size={11} />
                      {String(st).replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-gray-600">
                    <p><span className="text-gray-500">Business:</span> {app.business?.name || '—'}</p>
                    <p><span className="text-gray-500">Submitted:</span> {new Date(app.createdAt).toLocaleDateString()}</p>
                    <p><span className="text-gray-500">Reviewed by:</span> {app.reviewedBy?.name || '—'}</p>
                  </div>
                  <div className="mt-4">
                    <Link to={`/applications/${app._id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                      <Eye size={13} />
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Applicant', 'Business', 'Status', 'Submitted', 'Reviewed by', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.applications.map(app => {
                  const st = app.status || 'pending';
                  const Icon = STATUS_ICONS[st] || Clock;
                  return (
                    <tr key={app._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {app.personal?.firstName || '—'} {app.personal?.lastName || ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.personal?.email || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{app.business?.name || '—'}</p>
                        <p className="text-xs text-gray-500">
                          {[app.business?.city, app.business?.country].filter(Boolean).join(', ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[st] || 'bg-gray-100 text-gray-700'}`}>
                          <Icon size={11} />
                          {String(st).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {app.reviewedBy?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/applications/${app._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                          <Eye size={13} />
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing page {data.page} of {data.pages} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Previous
              </button>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
