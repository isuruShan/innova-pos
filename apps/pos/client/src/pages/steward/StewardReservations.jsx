import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Clock, Phone, Search, ChevronLeft, Calendar as CalendarIcon, Check, X } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useNavigate } from 'react-router-dom';

const STATUS_STYLES = {
  pending: { bg: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
  confirmed: { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Confirmed' },
  seated: { bg: 'bg-green-100 text-green-700 border-green-200', label: 'Seated' },
  completed: { bg: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Completed' },
  cancelled: { bg: 'bg-red-100 text-red-700 border-red-200', label: 'Cancelled' },
  no_show: { bg: 'bg-orange-100 text-orange-700 border-orange-200', label: 'No Show' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style.bg}`}>
      {style.label}
    </span>
  );
}

export default function StewardReservations() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', selectedStoreId, dateFilter],
    queryFn: () => api.get(`/reservations?storeId=${selectedStoreId}&date=${dateFilter}`).then((r) => r.data),
    enabled: isStoreReady,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['cafe-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }) => api.put(`/reservations/${id}/status`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });

  const handleAction = (id, action) => {
    if (confirm(`Are you sure you want to ${action} this reservation?`)) {
      statusMutation.mutate({ id, action });
    }
  };

  const filtered = useMemo(() => {
    if (!search) return reservations;
    const q = search.toLowerCase();
    return reservations.filter((r) =>
      (r.guestName || '').toLowerCase().includes(q) ||
      (r.guestPhone || '').includes(q)
    );
  }, [reservations, search]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/steward/tables')} className="text-gray-500 p-1 bg-gray-100 rounded-full">
          <ChevronLeft size={20} />
        </button>
        <h1 className="font-bold text-gray-900 text-lg">Bookings</h1>
      </div>

      {/* Filters */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 space-y-3 shrink-0">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="relative w-36">
            <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8">Loading bookings...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No bookings found for this date.</p>
        ) : (
          filtered.map((res) => {
            const time = new Date(res.reservationTime);
            const tableLabel = tables.find(t => String(t._id) === String(res.tableId))?.label;

            return (
              <div key={res._id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{res.guestName}</h3>
                    {res.guestPhone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {res.guestPhone}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={res.status} />
                </div>

                <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5 mb-3">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Clock size={14} className="text-amber-500" />
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Users size={14} className="text-amber-500" />
                    {res.partySize} guests
                  </div>
                  {tableLabel && (
                    <div className="flex items-center gap-1.5 font-semibold text-teal-600">
                      <span className="w-4 h-4 rounded bg-teal-100 flex items-center justify-center text-[10px]">T</span>
                      {tableLabel}
                    </div>
                  )}
                </div>

                {res.specialRequests && (
                  <p className="text-xs text-gray-500 italic mb-3">"{res.specialRequests}"</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {res.status === 'pending' && (
                    <button
                      onClick={() => handleAction(res._id, 'confirm')}
                      className="flex-1 py-2 bg-blue-50 text-blue-600 font-semibold text-xs rounded-lg flex items-center justify-center gap-1 border border-blue-100"
                    >
                      <Check size={14} /> Confirm
                    </button>
                  )}
                  {(res.status === 'confirmed' || res.status === 'pending') && (
                    <button
                      onClick={() => handleAction(res._id, 'seat')}
                      className="flex-1 py-2 bg-green-50 text-green-600 font-semibold text-xs rounded-lg flex items-center justify-center gap-1 border border-green-100"
                    >
                      <Users size={14} /> Seat
                    </button>
                  )}
                  {['pending', 'confirmed'].includes(res.status) && (
                    <button
                      onClick={() => handleAction(res._id, 'cancel')}
                      className="flex-1 py-2 bg-red-50 text-red-600 font-semibold text-xs rounded-lg flex items-center justify-center gap-1 border border-red-100"
                    >
                      <X size={14} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
