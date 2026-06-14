import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Clock, Users, Phone, Mail, Search, Plus,
  Check, X, AlertCircle, ChevronLeft, ChevronRight, Filter, Info, Trash2
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import PageHeader from '../../components/PageHeader';

const STATUS_STYLES = {
  pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200/60', label: 'Pending' },
  confirmed: { bg: 'bg-blue-50 text-blue-700 border-blue-200/60', label: 'Confirmed' },
  seated: { bg: 'bg-green-50 text-green-700 border-green-200/60', label: 'Seated' },
  completed: { bg: 'bg-gray-50 text-gray-700 border-gray-200/60', label: 'Completed' },
  cancelled: { bg: 'bg-red-50 text-red-700 border-red-200/60', label: 'Cancelled' },
  no_show: { bg: 'bg-orange-50 text-orange-700 border-orange-200/60', label: 'No Show' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${style.bg}`}>
      {style.label}
    </span>
  );
}

function ReservationCard({ reservation, onAction, onEdit, tables }) {
  const tableLabel = tables.find((t) => String(t._id) === String(reservation.tableId))?.label;
  const time = new Date(reservation.reservationTime);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-amber-500/40 transition-all shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="font-bold text-gray-900 truncate" title={reservation.guestName}>
            {reservation.guestName}
          </h4>
          <StatusBadge status={reservation.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" />
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-amber-500" />
            {reservation.partySize} guests
          </div>
          {reservation.guestPhone && (
            <div className="flex items-center gap-1.5 col-span-2">
              <Phone size={14} className="text-gray-400" />
              <span>{reservation.guestPhone}</span>
            </div>
          )}
          {reservation.guestEmail && (
            <div className="flex items-center gap-1.5 col-span-2 truncate" title={reservation.guestEmail}>
              <Mail size={14} className="text-gray-400" />
              <span>{reservation.guestEmail}</span>
            </div>
          )}
          {tableLabel && (
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="w-4 h-4 rounded bg-teal-50 border border-teal-200 flex items-center justify-center text-[10px] text-teal-700 font-bold">T</span>
              <span className="font-medium text-gray-700">{tableLabel}</span>
            </div>
          )}
        </div>

        {reservation.specialRequests && (
          <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl p-2.5 mb-4 border border-gray-100">
            "{reservation.specialRequests}"
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
          <button
            onClick={() => onEdit(reservation)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
          >
            Edit
          </button>
        )}
        {reservation.status === 'pending' && (
          <button
            onClick={() => onAction(reservation._id, 'confirm')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
          >
            Confirm
          </button>
        )}
        {(reservation.status === 'confirmed' || reservation.status === 'pending') && (
          <button
            onClick={() => onAction(reservation._id, 'seat')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 transition"
          >
            Seat
          </button>
        )}
        {reservation.status !== 'cancelled' && reservation.status !== 'completed' && reservation.status !== 'no_show' && (
          <button
            onClick={() => onAction(reservation._id, 'cancel')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function NewReservationModal({ isOpen, onClose, tables, onSubmit, isPending, error }) {
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    reservationDate: new Date().toISOString().split('T')[0],
    reservationTime: '19:00',
    tableId: '',
    duration: 90,
    specialRequests: '',
    source: 'phone',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        partySize: 2,
        reservationDate: new Date().toISOString().split('T')[0],
        reservationTime: '19:00',
        tableId: '',
        duration: 90,
        specialRequests: '',
        source: 'phone',
      });
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateTime = new Date(`${form.reservationDate}T${form.reservationTime}`);
    onSubmit({
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      guestEmail: form.guestEmail,
      partySize: form.partySize,
      reservationTime: dateTime.toISOString(),
      tableId: form.tableId || undefined,
      duration: form.duration,
      specialRequests: form.specialRequests,
      source: form.source,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl">
        <div className="p-5 border-b border-gray-150 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-900">New Reservation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Guest Name *</label>
            <input
              type="text"
              required
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Phone</label>
              <input
                type="tel"
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Party Size *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.reservationDate}
                onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Time *</label>
              <input
                type="time"
                required
                value={form.reservationTime}
                onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Table (optional)</label>
              <select
                value={form.tableId}
                onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Auto-assign</option>
                {tables.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.label} (Cap: {t.capacity || 4})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Duration (mins)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Special Requests</label>
            <textarea
              rows={2}
              value={form.specialRequests}
              onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Allergies, seating preferences, occasion..."
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold transition text-sm disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditReservationModal({ isOpen, onClose, tables, onSubmit, isPending, error, reservation }) {
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    reservationDate: new Date().toISOString().split('T')[0],
    reservationTime: '19:00',
    tableId: '',
    duration: 90,
    specialRequests: '',
  });

  useEffect(() => {
    if (isOpen && reservation) {
      const time = new Date(reservation.reservationTime);
      setForm({
        guestName: reservation.guestName || '',
        guestPhone: reservation.guestPhone || '',
        guestEmail: reservation.guestEmail || '',
        partySize: reservation.partySize || 2,
        reservationDate: time.toISOString().split('T')[0],
        reservationTime: time.toTimeString().slice(0, 5),
        tableId: reservation.tableId || '',
        duration: reservation.duration || 90,
        specialRequests: reservation.specialRequests || '',
      });
    }
  }, [isOpen, reservation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateTime = new Date(`${form.reservationDate}T${form.reservationTime}`);
    onSubmit({
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      guestEmail: form.guestEmail,
      partySize: form.partySize,
      reservationTime: dateTime.toISOString(),
      tableId: form.tableId || undefined,
      duration: form.duration,
      specialRequests: form.specialRequests,
    });
  };

  if (!isOpen || !reservation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 shadow-2xl">
        <div className="p-5 border-b border-gray-150 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-900">Edit Reservation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Guest Name *</label>
            <input
              type="text"
              required
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Phone</label>
              <input
                type="tel"
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Party Size *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.reservationDate}
                onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Time *</label>
              <input
                type="time"
                required
                value={form.reservationTime}
                onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Table (optional)</label>
              <select
                value={form.tableId}
                onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Auto-assign</option>
                {tables.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.label} (Cap: {t.capacity || 4})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Duration (mins)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Special Requests</label>
            <textarea
              rows={2}
              value={form.specialRequests}
              onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Allergies, seating preferences, occasion..."
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold transition text-sm disabled:opacity-50"
            >
              {isPending ? 'Updating...' : 'Update Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady } = useStoreContext();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);

  const dateStr = selectedDate.toISOString().split('T')[0];

  // Fetch reservations
  const { data: reservationsData, isLoading } = useQuery({
    queryKey: ['reservations', selectedStoreId, dateStr],
    queryFn: () => api.get(`/reservations?date=${dateStr}`).then((r) => r.data),
    enabled: isStoreReady,
  });
  const reservations = reservationsData?.items || [];

  // Fetch tables
  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Create reservation
  const [createError, setCreateError] = useState(null);
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/reservations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      setShowNewModal(false);
      setCreateError(null);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to create reservation';
      setCreateError(message);
    },
  });

  // Update reservation
  const [editError, setEditError] = useState(null);
  const editMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/reservations/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      setShowEditModal(false);
      setEditingReservation(null);
      setEditError(null);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to update reservation';
      setEditError(message);
    },
  });

  // Update status
  const [statusError, setStatusError] = useState(null);
  const statusMutation = useMutation({
    mutationFn: ({ id, action }) =>
      api.patch(`/reservations/${id}/status`, {
        status: action === 'confirm' ? 'confirmed' : action === 'seat' ? 'seated' : 'cancelled',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      setStatusError(null);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to update reservation';
      setStatusError(message);
      setTimeout(() => setStatusError(null), 4000);
    },
  });

  const handleAction = (id, action) => {
    statusMutation.mutate({ id, action });
  };

  const handleEdit = (reservation) => {
    setEditingReservation(reservation);
    setShowEditModal(true);
  };

  const handleEditSubmit = (data) => {
    if (editingReservation) {
      editMutation.mutate({ id: editingReservation._id, data });
    }
  };

  const filteredReservations = useMemo(() => {
    return reservations
      .filter((r) => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (
            !(r.guestName || '').toLowerCase().includes(term) &&
            !(r.guestPhone || '').includes(term) &&
            !(r.guestEmail || '').toLowerCase().includes(term)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(a.reservationTime) - new Date(b.reservationTime));
  }, [reservations, filterStatus, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = reservations.length;
    const pending = reservations.filter((r) => r.status === 'pending').length;
    const confirmed = reservations.filter((r) => r.status === 'confirmed').length;
    const seated = reservations.filter((r) => r.status === 'seated').length;
    return { total, pending, confirmed, seated };
  }, [reservations]);

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  if (!isStoreReady) {
    return (
      <div className="p-6">
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          Select a store in the header first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        subtitle="Manage tables booking schedules and guest check-ins"
        actions={[
          {
            label: 'New Reservation',
            icon: Plus,
            onClick: () => setShowNewModal(true),
            primary: true,
          },
        ]}
      />

      {/* Date Picker & Stats */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <button onClick={() => changeDate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
              <ChevronLeft size={16} className="text-gray-650" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[120px] sm:min-w-[140px] text-center">
              {selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button onClick={() => changeDate(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
              <ChevronRight size={16} className="text-gray-650" />
            </button>
          </div>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-150 hover:bg-gray-200 text-gray-700 transition"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs w-full md:w-auto justify-start md:justify-end">
          <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 font-semibold border border-gray-200">
            Total: <strong className="ml-0.5">{stats.total}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200/50">
            Pending: <strong className="ml-0.5">{stats.pending}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/50">
            Confirmed: <strong className="ml-0.5">{stats.confirmed}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200/50">
            Seated: <strong className="ml-0.5">{stats.seated}</strong>
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search reservations by name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
          {[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'seated', label: 'Seated' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex-1 text-center sm:flex-initial ${
                filterStatus === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reservations List */}
      <div className="min-h-[250px]">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">
            Loading reservations...
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-400 gap-2">
            <AlertCircle size={36} className="text-gray-300" />
            <p className="text-sm font-semibold">No reservations found for this date.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredReservations.map((res) => (
              <ReservationCard
                key={res._id}
                reservation={res}
                tables={tables}
                onAction={handleAction}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      <NewReservationModal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          setCreateError(null);
        }}
        tables={tables}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        error={createError}
      />

      <EditReservationModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingReservation(null);
          setEditError(null);
        }}
        tables={tables}
        reservation={editingReservation}
        onSubmit={handleEditSubmit}
        isPending={editMutation.isPending}
        error={editError}
      />

      {/* Status Error Toast */}
      {statusError && (
        <div className="fixed bottom-4 right-4 bg-red-650 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {statusError}
        </div>
      )}
    </div>
  );
}
