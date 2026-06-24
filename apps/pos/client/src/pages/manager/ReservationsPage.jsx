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

const COUNTRY_CODES = [
  { code: '+94', name: 'LK', flag: '🇱🇰' },
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+61', name: 'AU', flag: '🇦🇺' },
  { code: '+971', name: 'AE', flag: '🇦🇪' },
  { code: '+65', name: 'SG', flag: '🇸🇬' },
];

const parsePhone = (phoneStr) => {
  if (!phoneStr) return { code: '+94', number: '' };
  const matched = COUNTRY_CODES.find((c) => phoneStr.startsWith(c.code));
  if (matched) {
    return { code: matched.code, number: phoneStr.slice(matched.code.length) };
  }
  return { code: '+94', number: phoneStr };
};

const formatPhoneNumber = (value, countryCode) => {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  
  if (countryCode === '+1') {
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `(${clean.slice(0, 3)}) ${clean.slice(3)}`;
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
  } else if (countryCode === '+94') {
    if (clean.length <= 2) return clean;
    if (clean.length <= 5) return `${clean.slice(0, 2)} ${clean.slice(2)}`;
    return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 9)}`;
  } else if (countryCode === '+61') {
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`;
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
  } else if (countryCode === '+44') {
    if (clean.length <= 4) return clean;
    return `${clean.slice(0, 4)} ${clean.slice(4, 10)}`;
  }
  
  const parts = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join(' ');
};

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
  const [step, setStep] = useState(1);
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
  const [countryCode, setCountryCode] = useState('+94');
  const [phoneNo, setPhoneNo] = useState('');
  const [eligibleTables, setEligibleTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState(null);

  // Reset form when modal is opened
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
      setCountryCode('+94');
      setPhoneNo('');
      setStep(1);
      setEligibleTables([]);
      setTablesError(null);
    }
  }, [isOpen]);

  const fetchEligibleTables = async () => {
    setIsLoadingTables(true);
    setTablesError(null);
    try {
      const dateTime = new Date(`${form.reservationDate}T${form.reservationTime}`);
      const res = await api.get('/reservations/eligible-tables', {
        params: {
          reservationTime: dateTime.toISOString(),
          partySize: form.partySize,
          duration: form.duration,
        }
      });
      setEligibleTables(res.data || []);
    } catch (err) {
      setTablesError(err.response?.data?.message || 'Failed to load eligible tables');
    } finally {
      setIsLoadingTables(false);
    }
  };

  useEffect(() => {
    if (step === 3 && form.reservationDate && form.reservationTime && form.partySize) {
      fetchEligibleTables();
    }
  }, [step, form.reservationDate, form.reservationTime, form.partySize, form.duration]);

  const handlePhoneChange = (val) => {
    const clean = val.replace(/\D/g, '');
    setPhoneNo(formatPhoneNumber(clean, countryCode));
  };

  const handleCountryCodeChange = (e) => {
    const code = e.target.value;
    setCountryCode(code);
    const clean = phoneNo.replace(/\D/g, '');
    setPhoneNo(formatPhoneNumber(clean, code));
  };

  const nextStep = () => {
    if (step === 1) {
      if (!form.guestName.trim()) return;
      if (!form.partySize || form.partySize < 1) return;
    }
    if (step === 2) {
      if (!form.reservationDate || !form.reservationTime) return;
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateTime = new Date(`${form.reservationDate}T${form.reservationTime}`);
    onSubmit({
      guestName: form.guestName,
      guestPhone: phoneNo ? `${countryCode}${phoneNo.trim().replace(/\D/g, '')}` : '',
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

  const isStep1Valid = form.guestName.trim() !== '' && form.partySize >= 1;
  const isStep2Valid = form.reservationDate !== '' && form.reservationTime !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-lg text-[var(--pos-text-primary)]">New Reservation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/50">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-800/40 border-b border-slate-700/40 text-xs shrink-0">
          {[
            { num: 1, label: 'Guest Info' },
            { num: 2, label: 'Schedule' },
            { num: 3, label: 'Table & Details' },
          ].map((s, idx, arr) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold border transition ${
                    step === s.num
                      ? 'bg-amber-500 border-amber-500 text-white font-bold shadow-md shadow-amber-500/25'
                      : step > s.num
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {step > s.num ? <Check size={12} className="stroke-[3]" /> : s.num}
                </div>
                <span
                  className={`font-semibold tracking-wide ${
                    step === s.num ? 'text-[var(--pos-text-primary)] font-bold' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${
                    step > s.num ? 'bg-emerald-500/30' : 'bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Wizard content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Guest Name *</label>
                <input
                  type="text"
                  required
                  value={form.guestName}
                  onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Phone</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={handleCountryCodeChange}
                    className="border border-slate-600 rounded-lg px-2 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] text-sm focus:outline-none focus:border-amber-500"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="e.g. 77 123 4567"
                    value={phoneNo}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="flex-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] text-sm focus:outline-none focus:border-amber-500 font-mono tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. john@example.com"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Party Size *</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={form.reservationDate}
                  onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Time *</label>
                <input
                  type="time"
                  required
                  value={form.reservationTime}
                  onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Duration</label>
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                >
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                  <option value={90}>90 mins</option>
                  <option value={120}>120 mins</option>
                  <option value={150}>150 mins</option>
                  <option value={180}>180 mins</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Assigned Table</label>
                {isLoadingTables ? (
                  <div className="text-slate-400 text-sm py-2">Loading eligible tables...</div>
                ) : tablesError ? (
                  <div className="text-red-400 text-sm py-2">Error: {tablesError}</div>
                ) : (
                  <select
                    value={form.tableId}
                    onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                    className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Auto-assign (closest fit)</option>
                    {eligibleTables.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.label} (Cap: {t.capacity})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Only tables with enough capacity that have no active session or booking conflict are listed.
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Special Requests / Notes</label>
                <textarea
                  rows={3}
                  value={form.specialRequests}
                  onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] resize-none focus:border-amber-500 focus:outline-none"
                  placeholder="Allergies, seating preferences, occasion..."
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Footer buttons inside the form to align spacing */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/60 shrink-0">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-650 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isStep1Valid}
                  onClick={nextStep}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-50"
                >
                  Next
                </button>
              </>
            ) : step === 2 ? (
              <>
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-650 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!isStep2Valid}
                  onClick={nextStep}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-50"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-650 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isPending || isLoadingTables}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-50"
                >
                  {isPending ? 'Creating...' : 'Create Reservation'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function EditReservationModal({ isOpen, onClose, tables, onSubmit, onDelete, isPending, isDeleting, error, reservation }) {
  const [step, setStep] = useState(1);
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
  const [countryCode, setCountryCode] = useState('+94');
  const [phoneNo, setPhoneNo] = useState('');
  const [eligibleTables, setEligibleTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState(null);

  // Initialize form with reservation data when opened
  useEffect(() => {
    if (isOpen && reservation) {
      const time = new Date(reservation.reservationTime);
      const parsed = parsePhone(reservation.guestPhone);
      setCountryCode(parsed.code);
      setPhoneNo(parsed.number);
      setForm({
        guestName: reservation.guestName || '',
        guestEmail: reservation.guestEmail || '',
        partySize: reservation.partySize || 2,
        reservationDate: time.toISOString().split('T')[0],
        reservationTime: time.toTimeString().slice(0, 5),
        tableId: reservation.tableId || '',
        duration: reservation.duration || 90,
        specialRequests: reservation.specialRequests || '',
      });
      setStep(1);
      setEligibleTables([]);
      setTablesError(null);
    }
  }, [isOpen, reservation]);

  const fetchEligibleTables = async () => {
    if (!reservation) return;
    setIsLoadingTables(true);
    setTablesError(null);
    try {
      const dateTime = new Date(`${form.reservationDate}T${form.reservationTime}`);
      const res = await api.get('/reservations/eligible-tables', {
        params: {
          reservationTime: dateTime.toISOString(),
          partySize: form.partySize,
          duration: form.duration,
          excludeReservationId: reservation._id,
        }
      });
      setEligibleTables(res.data || []);
    } catch (err) {
      setTablesError(err.response?.data?.message || 'Failed to load eligible tables');
    } finally {
      setIsLoadingTables(false);
    }
  };

  useEffect(() => {
    if (step === 3 && form.reservationDate && form.reservationTime && form.partySize) {
      fetchEligibleTables();
    }
  }, [step, form.reservationDate, form.reservationTime, form.partySize, form.duration]);

  const handlePhoneChange = (val) => {
    const clean = val.replace(/\D/g, '');
    setPhoneNo(formatPhoneNumber(clean, countryCode));
  };

  const handleCountryCodeChange = (e) => {
    const code = e.target.value;
    setCountryCode(code);
    const clean = phoneNo.replace(/\D/g, '');
    setPhoneNo(formatPhoneNumber(clean, code));
  };

  const nextStep = () => {
    if (step === 1) {
      if (!form.guestName.trim()) return;
      if (!form.partySize || form.partySize < 1) return;
    }
    if (step === 2) {
      if (!form.reservationDate || !form.reservationTime) return;
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateTime = new Date(`${form.reservationDate}T${form.reservationTime}`);
    onSubmit({
      guestName: form.guestName,
      guestPhone: phoneNo ? `${countryCode}${phoneNo.trim().replace(/\D/g, '')}` : '',
      guestEmail: form.guestEmail,
      partySize: form.partySize,
      reservationTime: dateTime.toISOString(),
      tableId: form.tableId || undefined,
      duration: form.duration,
      specialRequests: form.specialRequests,
    });
  };

  if (!isOpen || !reservation) return null;

  const isStep1Valid = form.guestName.trim() !== '' && form.partySize >= 1;
  const isStep2Valid = form.reservationDate !== '' && form.reservationTime !== '';

  // Append currently assigned table if not in eligibleTables
  const combinedTables = [...eligibleTables];
  if (reservation.tableId && !combinedTables.some(t => String(t._id) === String(reservation.tableId))) {
    const currentTableObj = tables.find(t => String(t._id) === String(reservation.tableId));
    if (currentTableObj) {
      combinedTables.push(currentTableObj);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-lg text-[var(--pos-text-primary)]">Edit Reservation</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/50">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-800/40 border-b border-slate-700/40 text-xs shrink-0">
          {[
            { num: 1, label: 'Guest Info' },
            { num: 2, label: 'Schedule' },
            { num: 3, label: 'Table & Details' },
          ].map((s, idx, arr) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold border transition ${
                    step === s.num
                      ? 'bg-amber-555 border-amber-500 text-white font-bold bg-amber-500 shadow-md shadow-amber-500/25'
                      : step > s.num
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {step > s.num ? <Check size={12} className="stroke-[3]" /> : s.num}
                </div>
                <span
                  className={`font-semibold tracking-wide ${
                    step === s.num ? 'text-[var(--pos-text-primary)] font-bold' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${
                    step > s.num ? 'bg-emerald-500/30' : 'bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Wizard content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Guest Name *</label>
                <input
                  type="text"
                  required
                  value={form.guestName}
                  onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Phone</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={handleCountryCodeChange}
                    className="border border-slate-600 rounded-lg px-2 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] text-sm focus:outline-none focus:border-amber-500"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="e.g. 77 123 4567"
                    value={phoneNo}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="flex-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] text-sm focus:outline-none focus:border-amber-500 font-mono tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. john@example.com"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Party Size *</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={form.reservationDate}
                  onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Time *</label>
                <input
                  type="time"
                  required
                  value={form.reservationTime}
                  onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Duration</label>
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                >
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                  <option value={90}>90 mins</option>
                  <option value={120}>120 mins</option>
                  <option value={150}>150 mins</option>
                  <option value={180}>180 mins</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Assigned Table</label>
                {isLoadingTables ? (
                  <div className="text-slate-400 text-sm py-2">Loading eligible tables...</div>
                ) : tablesError ? (
                  <div className="text-red-400 text-sm py-2">Error: {tablesError}</div>
                ) : (
                  <select
                    value={form.tableId}
                    onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                    className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Auto-assign (closest fit)</option>
                    {combinedTables.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.label} (Cap: {t.capacity}) {String(t._id) === String(reservation.tableId) ? '(Currently Assigned)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Only tables with enough capacity that have no active session or booking conflict are listed.
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Special Requests / Notes</label>
                <textarea
                  rows={3}
                  value={form.specialRequests}
                  onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] resize-none focus:border-amber-500 focus:outline-none"
                  placeholder="Allergies, seating preferences, occasion..."
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Footer buttons inside the form to align spacing */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/60 shrink-0">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-655 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isStep1Valid}
                  onClick={nextStep}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-50"
                >
                  Next
                </button>
              </>
            ) : step === 2 ? (
              <>
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-655 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!isStep2Valid}
                  onClick={nextStep}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-50"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-655 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isPending || isLoadingTables}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-50"
                >
                  {isPending ? 'Updating...' : 'Update Reservation'}
                </button>
              </>
            )}
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


      {/* Status Error Toast */}
      {statusError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {statusError}
        </div>
      )}
    </div>
  );
}
