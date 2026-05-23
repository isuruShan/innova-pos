import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Clock, Users, Phone, Mail, Search, Plus,
  Check, X, AlertCircle, ChevronLeft, ChevronRight, Filter, MoreVertical,
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

const STATUS_STYLES = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
  confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Confirmed' },
  seated: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Seated' },
  completed: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Completed' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
  no_show: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'No Show' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function ReservationCard({ reservation, onAction, onEdit, tables }) {
  const tableLabel = tables.find((t) => String(t._id) === String(reservation.tableId))?.label;
  const time = new Date(reservation.reservationTime);

  return (
    <div className="bg-[var(--pos-surface-inset)] border border-slate-700/40 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-[var(--pos-text-primary)] truncate">
              {reservation.guestName}
            </h4>
            <StatusBadge status={reservation.status} />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400" />
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-amber-400" />
              {reservation.partySize} guests
            </div>
            {reservation.guestPhone && (
              <div className="flex items-center gap-1.5">
                <Phone size={14} />
                {reservation.guestPhone}
              </div>
            )}
            {tableLabel && (
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-teal-500/50 flex items-center justify-center text-[10px]">T</span>
                {tableLabel}
              </div>
            )}
          </div>

          {reservation.specialRequests && (
            <p className="mt-2 text-xs text-slate-500 italic line-clamp-2">
              "{reservation.specialRequests}"
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
            <button
              onClick={() => onEdit(reservation)}
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600"
              title="Edit"
            >
              <MoreVertical size={14} />
            </button>
          )}
          {reservation.status === 'pending' && (
            <button
              onClick={() => onAction(reservation._id, 'confirm')}
              className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              title="Confirm"
            >
              <Check size={14} />
            </button>
          )}
          {(reservation.status === 'confirmed' || reservation.status === 'pending') && (
            <button
              onClick={() => onAction(reservation._id, 'seat')}
              className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
              title="Seat"
            >
              <Users size={14} />
            </button>
          )}
          {reservation.status !== 'cancelled' && reservation.status !== 'completed' && reservation.status !== 'no_show' && (
            <button
              onClick={() => onAction(reservation._id, 'cancel')}
              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
              title="Cancel"
            >
              <X size={14} />
            </button>
          )}
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-[var(--pos-text-primary)]">New Reservation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/50">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-sm text-slate-400">Guest Name *</label>
            <input
              type="text"
              required
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400">Phone</label>
              <input
                type="tel"
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Email</label>
              <input
                type="email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-400">Party Size *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Date *</label>
              <input
                type="date"
                required
                value={form.reservationDate}
                onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Time *</label>
              <input
                type="time"
                required
                value={form.reservationTime}
                onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400">Table (optional)</label>
              <select
                value={form.tableId}
                onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
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
              <label className="text-sm text-slate-400">Duration (mins)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              >
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400">Special Requests</label>
            <textarea
              rows={2}
              value={form.specialRequests}
              onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
              className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] resize-none"
              placeholder="Allergies, seating preferences, occasion..."
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50"
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

  // Initialize form with reservation data when opened
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-[var(--pos-text-primary)]">Edit Reservation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/50">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-sm text-slate-400">Guest Name *</label>
            <input
              type="text"
              required
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400">Phone</label>
              <input
                type="tel"
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Email</label>
              <input
                type="email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-400">Party Size *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Date *</label>
              <input
                type="date"
                required
                value={form.reservationDate}
                onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Time *</label>
              <input
                type="time"
                required
                value={form.reservationTime}
                onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400">Table (optional)</label>
              <select
                value={form.tableId}
                onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
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
              <label className="text-sm text-slate-400">Duration (mins)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              >
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400">Special Requests</label>
            <textarea
              rows={2}
              value={form.specialRequests}
              onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
              className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] resize-none"
              placeholder="Allergies, seating preferences, occasion..."
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50"
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
    mutationFn: ({ id, action }) => api.patch(`/reservations/${id}/status`, { status: action === 'confirm' ? 'confirmed' : action === 'seat' ? 'seated' : 'cancelled' }),
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
    statusMutation.mutate({ id, action });
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
      <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
        <Navbar groups={MANAGER_NAV_GROUPS} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-amber-300">Select a store in the header first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={24} className="text-amber-400" />
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Reservations</h1>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold flex items-center gap-2 hover:bg-amber-600"
          >
            <Plus size={18} />
            New Reservation
          </button>
        </div>

        {/* Date Picker & Stats */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-3 py-2 flex items-center gap-2">
            <button onClick={() => changeDate(-1)} className="p-1 rounded hover:bg-slate-700/50">
              <ChevronLeft size={18} className="text-slate-400" />
            </button>
            <span className="text-sm font-medium text-[var(--pos-text-primary)] min-w-[120px] text-center">
              {selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => changeDate(1)} className="p-1 rounded hover:bg-slate-700/50">
              <ChevronRight size={18} className="text-slate-400" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="ml-1 px-2 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Today
            </button>
          </div>

          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1 rounded-full bg-slate-700/50 text-slate-300">
              Total: <strong>{stats.total}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
              Pending: <strong>{stats.pending}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
              Confirmed: <strong>{stats.confirmed}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400">
              Seated: <strong>{stats.seated}</strong>
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-600 rounded-lg bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] text-sm"
            />
          </div>

          <div className="flex items-center gap-1 bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'seated', label: 'Seated' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === opt.value
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reservations List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Loading reservations...
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <AlertCircle size={32} className="text-slate-500" />
              <p>No reservations found for this date.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          setCreateError(null);
        }}
        tables={tables}
        onSubmit={createMutation.mutate}
        isPending={createMutation.isPending}
        error={createError}
      />

      {/* Status Error Toast */}
      {statusError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {statusError}
        </div>
      )}
    </div>
  );
}
