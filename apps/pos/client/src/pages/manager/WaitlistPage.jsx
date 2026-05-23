import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Clock, Phone, Bell, ChevronUp, ChevronDown,
  Plus, X, AlertCircle, UserPlus, Check,
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

const STATUS_STYLES = {
  waiting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Waiting' },
  notified: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Notified' },
  ready: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Ready' },
  seated: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Seated' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
  left: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Left' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.waiting;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function WaitlistCard({ entry, onAction, onMoveUp, onMoveDown, tables, isFirst, isLast }) {
  const waitMinutes = Math.round((Date.now() - new Date(entry.addedAt).getTime()) / 60000);
  
  return (
    <div className="bg-[var(--pos-surface-inset)] border border-slate-700/40 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Position & Move */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            {entry.position}
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-0.5 rounded hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp size={14} className="text-slate-400" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-0.5 rounded hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-[var(--pos-text-primary)] truncate">
              {entry.guestName}
            </h4>
            <StatusBadge status={entry.status} />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-amber-400" />
              {entry.partySize} guests
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400" />
              {waitMinutes}m waiting
            </div>
            {entry.guestPhone && (
              <div className="flex items-center gap-1.5">
                <Phone size={14} />
                {entry.guestPhone}
              </div>
            )}
            {entry.estimatedWaitMinutes && (
              <div className="flex items-center gap-1.5 text-xs">
                Est: ~{entry.estimatedWaitMinutes}m
              </div>
            )}
          </div>

          {entry.notes && (
            <p className="mt-2 text-xs text-slate-500 italic line-clamp-1">
              "{entry.notes}"
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          {entry.status === 'waiting' && (
            <button
              onClick={() => onAction(entry._id, 'notify')}
              className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              title="Notify guest"
            >
              <Bell size={14} />
            </button>
          )}
          {entry.status === 'notified' && (
            <button
              onClick={() => onAction(entry._id, 'ready')}
              className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
              title="Mark ready"
            >
              <Check size={14} />
            </button>
          )}
          {(entry.status === 'waiting' || entry.status === 'notified' || entry.status === 'ready') && (
            <button
              onClick={() => onAction(entry._id, 'seat')}
              className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
              title="Seat guest"
            >
              <UserPlus size={14} />
            </button>
          )}
          {entry.status !== 'seated' && entry.status !== 'cancelled' && entry.status !== 'left' && (
            <button
              onClick={() => onAction(entry._id, 'cancel')}
              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
              title="Remove"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddToWaitlistModal({ isOpen, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    partySize: 2,
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      partySize: form.partySize,
      notes: form.notes,
    });
    setForm({ guestName: '', guestPhone: '', partySize: 2, notes: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl w-full max-w-md">
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-[var(--pos-text-primary)]">Add to Waitlist</h3>
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
          </div>

          <div>
            <label className="text-sm text-slate-400">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] resize-none"
              placeholder="Any special requests..."
            />
          </div>

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
              {isPending ? 'Adding...' : 'Add to Waitlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterActive, setFilterActive] = useState(true);

  // Fetch waitlist
  const { data: waitlist = [], isLoading } = useQuery({
    queryKey: ['waitlist', selectedStoreId],
    queryFn: () => api.get('/waitlist').then((r) => r.data),
    enabled: isStoreReady,
    refetchInterval: 15000,
  });

  // Fetch tables
  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Add to waitlist
  const addMutation = useMutation({
    mutationFn: (data) => api.post('/waitlist', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist'] });
      setShowAddModal(false);
    },
  });

  // Status actions
  const statusMutation = useMutation({
    mutationFn: ({ id, action }) => api.patch(`/waitlist/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  // Reorder
  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }) =>
      api.patch(`/waitlist/${id}/reorder`, { direction }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
  });

  const handleAction = (id, action) => {
    if (action === 'cancel') {
      statusMutation.mutate({ id, action: 'cancel' });
    } else {
      statusMutation.mutate({ id, action });
    }
  };

  const filteredWaitlist = useMemo(() => {
    if (filterActive) {
      return waitlist.filter((e) => ['waiting', 'notified', 'ready'].includes(e.status));
    }
    return waitlist;
  }, [waitlist, filterActive]);

  // Stats
  const stats = useMemo(() => {
    const active = waitlist.filter((e) => ['waiting', 'notified', 'ready'].includes(e.status));
    const avgWait =
      active.length > 0
        ? Math.round(
            active.reduce(
              (sum, e) => sum + (Date.now() - new Date(e.addedAt).getTime()) / 60000,
              0
            ) / active.length
          )
        : 0;
    return {
      total: active.length,
      avgWait,
      waiting: active.filter((e) => e.status === 'waiting').length,
      notified: active.filter((e) => e.status === 'notified').length,
    };
  }, [waitlist]);

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
            <Users size={24} className="text-amber-400" />
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Waitlist</h1>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold flex items-center gap-2 hover:bg-amber-600"
          >
            <Plus size={18} />
            Add Guest
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <Users size={20} className="text-amber-400" />
            <div>
              <p className="text-xs text-slate-400">In Queue</p>
              <p className="text-xl font-bold text-[var(--pos-text-primary)]">{stats.total}</p>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <Clock size={20} className="text-teal-400" />
            <div>
              <p className="text-xs text-slate-400">Avg Wait</p>
              <p className="text-xl font-bold text-teal-400">{stats.avgWait}m</p>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div>
              <p className="text-xs text-slate-400">Waiting</p>
              <p className="text-xl font-bold text-yellow-400">{stats.waiting}</p>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <Bell size={20} className="text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Notified</p>
              <p className="text-xl font-bold text-blue-400">{stats.notified}</p>
            </div>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterActive(!filterActive)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterActive
                ? 'bg-amber-500 text-white'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            Active Only
          </button>
          <span className="text-xs text-slate-500">
            Showing {filteredWaitlist.length} {filterActive ? 'active' : 'total'} entries
          </span>
        </div>

        {/* Waitlist */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Loading waitlist...
            </div>
          ) : filteredWaitlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <AlertCircle size={32} className="text-slate-500" />
              <p>No guests on the waitlist.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {filteredWaitlist.map((entry, idx) => (
                <WaitlistCard
                  key={entry._id}
                  entry={entry}
                  tables={tables}
                  onAction={handleAction}
                  onMoveUp={() => reorderMutation.mutate({ id: entry._id, direction: 'up' })}
                  onMoveDown={() => reorderMutation.mutate({ id: entry._id, direction: 'down' })}
                  isFirst={idx === 0}
                  isLast={idx === filteredWaitlist.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddToWaitlistModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addMutation.mutate}
        isPending={addMutation.isPending}
      />
    </div>
  );
}
