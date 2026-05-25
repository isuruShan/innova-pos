import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tantml:parameter>
import {
  Play, Square, AlertTriangle, Plus, Minus, Loader2, Package, Clock,
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import Badge from '../Badge';

const REASON_OPTIONS = [
  { value: 'count_correction', label: 'Count Correction' },
  { value: 'damage', label: 'Damage' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'theft', label: 'Theft' },
  { value: 'spillage', label: 'Spillage' },
  { value: 'other', label: 'Other' },
];

export default function InventoryAdjustments() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const { user } = useAuth();
  const [closingNotes, setClosingNotes] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const qc = useQueryClient();

  // Fetch active session
  const { data: activeSession, isPending: sessionLoading } = useQuery({
    queryKey: ['inventory-session', 'active', selectedStoreId],
    queryFn: () => api.get('/inventory-sessions/active').then(r => r.data),
    enabled: isStoreReady,
  });

  // Fetch inventory items
  const { data: items = [], isPending: itemsLoading } = useQuery({
    queryKey: ['inventory', selectedStoreId],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: isStoreReady,
  });

  // Fetch movements for active session
  const { data: sessionMovements = [] } = useQuery({
    queryKey: ['stock-movements', 'session', activeSession?._id],
    queryFn: () => api.get(`/stock-movements/by-session/${activeSession._id}`).then(r => r.data),
    enabled: !!activeSession?._id,
  });

  const startSessionMutation = useMutation({
    mutationFn: () => api.post('/inventory-sessions/start'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, notes }) => api.post(`/inventory-sessions/${id}/close`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      setShowCloseDialog(false);
      setClosingNotes('');
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ sessionId, inventoryId, quantity, reason, notes }) =>
      api.post(`/inventory-sessions/${sessionId}/adjust/${inventoryId}`, { quantity, reason, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });

  const handleAdjust = (inventoryId, quantity, reason, notes) => {
    if (!activeSession) return;
    adjustMutation.mutate({
      sessionId: activeSession._id,
      inventoryId,
      quantity,
      reason,
      notes,
    });
  };

  const handleCloseSession = () => {
    if (!activeSession) return;
    closeSessionMutation.mutate({ id: activeSession._id, notes: closingNotes });
  };

  if (sessionLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session Status Banner */}
      {activeSession ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-400">Active Adjustment Session</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Started {new Date(activeSession.startedAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-slate-300">
                    <span className="font-semibold">{activeSession.adjustmentCount}</span> adjustments
                  </span>
                  <span className="text-slate-300">
                    <span className="font-semibold">{Math.round(activeSession.totalQuantityChanged)}</span> units changed
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCloseDialog(true)}
              disabled={closeSessionMutation.isPending}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-lg transition text-sm"
            >
              {closeSessionMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Square size={14} />
              )}
              Close Session
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl p-6 text-center">
          <Package size={32} className="mx-auto mb-3 text-slate-500" />
          <p className="text-sm font-medium text-slate-300 mb-1">No Active Adjustment Session</p>
          <p className="text-xs text-slate-500 mb-4">
            Start a session to make manual inventory adjustments
          </p>
          <button
            onClick={() => startSessionMutation.mutate()}
            disabled={startSessionMutation.isPending}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition text-sm mx-auto"
          >
            {startSessionMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Start Adjustment Session
          </button>
        </div>
      )}

      {/* Inventory Items List */}
      {activeSession && (
        <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50">
            <h3 className="text-sm font-semibold text-slate-300">Adjust Stock Levels</h3>
          </div>
          <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
            {items.map((item) => (
              <InventoryAdjustRow
                key={item._id}
                item={item}
                onAdjust={handleAdjust}
                isPending={adjustMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Session Movements */}
      {activeSession && sessionMovements.length > 0 && (
        <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50">
            <h3 className="text-sm font-semibold text-slate-300">Session Adjustments</h3>
          </div>
          <div className="divide-y divide-slate-800/80 max-h-[300px] overflow-y-auto">
            {sessionMovements.map((movement) => (
              <div key={movement._id} className="px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-1">
                  <Package size={12} className="text-slate-500" />
                  <span className="text-slate-300">{movement.inventoryItemId?.itemName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{movement.reason.replace(/_/g, ' ')}</span>
                  <span className={`font-semibold ${movement.quantity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {movement.quantity >= 0 ? '+' : ''}{movement.quantity}
                  </span>
                  <span className="text-slate-600">→ {movement.newQty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close Session Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[var(--pos-text-primary)] mb-2">Close Adjustment Session</h3>
            <p className="text-sm text-slate-400 mb-4">
              You made {activeSession.adjustmentCount} adjustments. Merchant admins will be notified.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">Session Notes (optional)</label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Add any notes about this session..."
                rows={3}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseDialog(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-medium px-4 py-2 rounded-lg transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseSession}
                disabled={closeSessionMutation.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
              >
                {closeSessionMutation.isPending ? 'Closing...' : 'Close Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryAdjustRow({ item, onAdjust, isPending }) {
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [reason, setReason] = useState('count_correction');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty === 0) return;
    onAdjust(item._id, qty, reason, notes);
    setShowAdjustForm(false);
    setAdjustQty('');
    setNotes('');
    setReason('count_correction');
  };

  const stockStatus = item.quantity < item.minThreshold ? 'low' : 'ok';

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{item.itemName}</span>
            {stockStatus === 'low' && (
              <span className="flex items-center gap-1 text-xs text-yellow-400">
                <AlertTriangle size={10} /> Low
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">
              Stock: <span className="text-slate-300 font-medium">{item.quantity}</span> {item.unit}
            </span>
            <span className="text-xs text-slate-600">
              Min: {item.minThreshold} {item.unit}
            </span>
          </div>
        </div>
        {!showAdjustForm ? (
          <button
            onClick={() => setShowAdjustForm(true)}
            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium px-3 py-1.5 rounded-lg transition text-xs"
          >
            Adjust
          </button>
        ) : (
          <button
            onClick={() => setShowAdjustForm(false)}
            className="text-slate-500 hover:text-slate-300 text-xs"
          >
            Cancel
          </button>
        )}
      </div>

      {showAdjustForm && (
        <div className="mt-3 bg-[var(--pos-surface-inset)] rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="±Quantity"
              className="w-24 bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              autoFocus
            />
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {REASON_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            onClick={handleSubmit}
            disabled={isPending || !adjustQty || adjustQty === '0'}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-medium px-3 py-1.5 rounded-lg transition text-xs"
          >
            {isPending ? 'Adjusting...' : 'Apply Adjustment'}
          </button>
        </div>
      )}
    </div>
  );
}
