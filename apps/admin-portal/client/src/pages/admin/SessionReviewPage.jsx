import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Calendar, User, Clock, CheckCircle, AlertCircle,
  TrendingUp, TrendingDown, FileText, Eye,
} from 'lucide-react';
import api from '../../api/axios';

export default function SessionReviewPage() {
  const [selectedSession, setSelectedSession] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const qc = useQueryClient();

  const { data: sessions = [], isPending: sessionsPending } = useQuery({
    queryKey: ['inventory-sessions'],
    queryFn: () => api.get('/inventory-sessions').then((r) => r.data),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.get('/stores').then((r) => r.data),
  });

  const { data: sessionDetail, isPending: detailPending } = useQuery({
    queryKey: ['inventory-session', selectedSession?._id],
    queryFn: () => api.get(`/inventory-sessions/${selectedSession._id}`).then((r) => r.data),
    enabled: !!selectedSession,
  });

  const reviewMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/inventory-sessions/${sessionId}/review`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-sessions'] });
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      setSelectedSession(null);
    },
  });

  const filtered = useMemo(() => {
    let result = sessions;
    
    if (statusFilter === 'reviewed') {
      result = result.filter((s) => s.reviewedBy);
    } else if (statusFilter === 'pending') {
      result = result.filter((s) => !s.reviewedBy);
    }

    if (storeFilter !== 'all') {
      result = result.filter((s) => String(s.storeId?._id) === storeFilter);
    }

    return result;
  }, [sessions, statusFilter, storeFilter]);

  const stats = useMemo(() => {
    return {
      total: sessions.length,
      pending: sessions.filter((s) => !s.reviewedBy).length,
      reviewed: sessions.filter((s) => s.reviewedBy).length,
      totalAdjustments: sessions.reduce((sum, s) => sum + (s.adjustmentCount || 0), 0),
    };
  }, [sessions]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return '-';
    const diff = new Date(end) - new Date(start);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (selectedSession && sessionDetail) {
    const { session, movements = [] } = sessionDetail;
    
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedSession(null)}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          ← Back to sessions
        </button>

        {/* Session Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Inventory Adjustment Session
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <User size={14} />
                  {session.userId?.name || 'Unknown User'}
                </span>
                <span className="flex items-center gap-1">
                  <Package size={14} />
                  {session.storeId?.name || 'Unknown Store'}
                </span>
              </div>
            </div>
            {!session.reviewedBy && (
              <button
                onClick={() => reviewMutation.mutate(session._id)}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Mark as Reviewed
              </button>
            )}
          </div>

          {/* Session Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">Started</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(session.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Ended</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(session.endedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDuration(session.startedAt, session.endedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Adjustments</p>
              <p className="text-sm font-medium text-gray-900">{session.adjustmentCount || 0}</p>
            </div>
          </div>

          {/* Total Quantity Changed */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Total Quantity Changed</p>
            <p className={`text-2xl font-bold ${session.totalQuantityChanged < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {session.totalQuantityChanged > 0 ? '+' : ''}{session.totalQuantityChanged || 0}
            </p>
          </div>

          {/* Notes */}
          {session.notes && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 font-medium mb-1">Session Notes</p>
              <p className="text-sm text-gray-700">{session.notes}</p>
            </div>
          )}

          {/* Review Info */}
          {session.reviewedBy && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={16} />
                <p className="text-sm font-medium">
                  Reviewed by {session.reviewedBy.name} on {formatDate(session.reviewedAt)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Movements List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Stock Movements ({movements.length})
            </h3>
          </div>
          
          {detailPending ? (
            <div className="p-8 text-center text-gray-500">Loading movements...</div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No movements recorded</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Before</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">After</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movements.map((movement) => (
                    <tr key={movement._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(movement.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {movement.inventoryItemId?.name || 'Unknown Item'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`flex items-center gap-1 text-sm font-medium ${
                            movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {movement.quantity > 0 ? (
                            <TrendingUp size={14} />
                          ) : (
                            <TrendingDown size={14} />
                          )}
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {movement.previousQty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {movement.newQty}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">{movement.reason}</span>
                          {movement.notes && (
                            <p className="text-xs text-gray-500 mt-1">{movement.notes}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Adjustment Sessions</h1>
        <p className="text-gray-600">Review stock adjustments made by store managers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="text-gray-400" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Pending Review</p>
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
            </div>
            <AlertCircle className="text-orange-400" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Reviewed</p>
              <p className="text-2xl font-bold text-green-600">{stats.reviewed}</p>
            </div>
            <CheckCircle className="text-green-400" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Adjustments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAdjustments}</p>
            </div>
            <Package className="text-gray-400" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All Sessions</option>
              <option value="pending">Pending Review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Store</label>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All Stores</option>
              {stores.map((store) => (
                <option key={store._id} value={store._id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow">
        {sessionsPending ? (
          <div className="p-8 text-center text-gray-500">Loading sessions...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No sessions found matching your filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Changed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((session) => (
                  <tr key={session._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {session.userId?.name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {session.storeId?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(session.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDuration(session.startedAt, session.endedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {session.adjustmentCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-medium ${
                          session.totalQuantityChanged < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {session.totalQuantityChanged > 0 ? '+' : ''}
                        {session.totalQuantityChanged || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {session.reviewedBy ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          <CheckCircle size={12} />
                          Reviewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                          <Clock size={12} />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800 font-medium"
                      >
                        <Eye size={14} />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
