import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, Square, AlertTriangle, Plus, Minus, Loader2, Package, Clock, Trash2, Edit2, X, Check
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import Badge from '../Badge';
import Toast from '../Toast';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import ViewModeToggle from '../ViewModeToggle';

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
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_inventory_adjustments');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_inventory_adjustments', mode);
  };
  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();

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

  // Fetch movements (draft or final) for active session
  const { data: sessionMovements = [] } = useQuery({
    queryKey: ['stock-movements', 'session', activeSession?._id],
    queryFn: () => api.get(`/stock-movements/by-session/${activeSession._id}`).then(r => r.data),
    enabled: !!activeSession?._id,
  });

  const startSessionMutation = useMutation({
    mutationFn: () => api.post('/inventory-sessions/start'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      showToast('Adjustment session started (Draft mode)', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to start session'), 'error');
    }
  });

  const completeSessionMutation = useMutation({
    mutationFn: ({ id, notes }) => api.post(`/inventory-sessions/${id}/close`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      setShowCompleteDialog(false);
      setClosingNotes('');
      showToast('Session completed and inventory updated', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to complete session'), 'error');
    },
  });

  const discardSessionMutation = useMutation({
    mutationFn: (id) => api.post(`/inventory-sessions/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      setShowDiscardDialog(false);
      showToast('Session ignored and draft changes discarded', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to discard session'), 'error');
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ sessionId, inventoryId, quantity, reason, notes }) =>
      api.post(`/inventory-sessions/${sessionId}/adjust/${inventoryId}`, { quantity, reason, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      showToast('Draft adjustment updated', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to record adjustment'), 'error');
    }
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: ({ sessionId, inventoryId }) =>
      api.delete(`/inventory-sessions/${sessionId}/adjust/${inventoryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-session'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      showToast('Draft adjustment removed', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to remove adjustment'), 'error');
    }
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

  const handleRemoveAdjustment = (inventoryId) => {
    if (!activeSession) return;
    deleteAdjustmentMutation.mutate({
      sessionId: activeSession._id,
      inventoryId,
    });
  };

  const handleCompleteSession = () => {
    if (!activeSession) return;
    completeSessionMutation.mutate({ id: activeSession._id, notes: closingNotes });
  };

  const handleDiscardSession = () => {
    if (!activeSession) return;
    discardSessionMutation.mutate(activeSession._id);
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock size={20} className="text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-amber-400">Active Session (Draft Mode)</p>
                  <span className="bg-amber-500/15 text-amber-400 text-[10px] px-2 py-0.5 rounded font-medium border border-amber-500/20">Draft</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Started {new Date(activeSession.startedAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-slate-350">
                    <span className="font-semibold text-slate-200">{activeSession.adjustmentCount}</span> adjustments
                  </span>
                  <span className="text-slate-355">
                    <span className="font-semibold text-slate-200">{Math.round(activeSession.totalQuantityChanged * 100) / 100}</span> units changed
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setShowDiscardDialog(true)}
                disabled={discardSessionMutation.isPending}
                className="flex items-center gap-1.5 bg-red-650/15 hover:bg-red-600/35 border border-red-500/30 hover:border-red-500/50 text-red-400 font-semibold px-3 py-2 rounded-lg transition text-sm"
              >
                {discardSessionMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
                Discard Session
              </button>
              <button
                onClick={() => setShowCompleteDialog(true)}
                disabled={completeSessionMutation.isPending}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold px-3 py-2 rounded-lg transition text-sm shadow-lg shadow-amber-500/10"
              >
                {completeSessionMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Square size={14} />
                )}
                Complete Session
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl p-6 text-center">
          <Package size={32} className="mx-auto mb-3 text-slate-500" />
          <p className="text-sm font-medium text-slate-300 mb-1">No Active Session</p>
          <p className="text-xs text-slate-500 mb-4">
            Start a session to adjust stock levels in draft mode before committing them.
          </p>
          <button
            onClick={() => startSessionMutation.mutate()}
            disabled={startSessionMutation.isPending}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition text-sm mx-auto shadow-lg shadow-amber-500/10"
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
          <div className="px-4 py-3 border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-300">Adjust Stock Levels</h3>
            <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />
          </div>
          {viewMode === 'table' ? (
            <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
              {items.map((item) => (
                <InventoryAdjustRow
                  key={item._id}
                  item={item}
                  existingAdjustment={sessionMovements.find(m => m.inventoryItemId?._id === item._id || m.inventoryItemId === item._id)}
                  onAdjust={handleAdjust}
                  onRemove={handleRemoveAdjustment}
                  isPending={adjustMutation.isPending}
                  viewMode="table"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 max-h-[600px] overflow-y-auto bg-[var(--pos-surface-inset)]/25">
              {items.map((item) => (
                <InventoryAdjustRow
                  key={item._id}
                  item={item}
                  existingAdjustment={sessionMovements.find(m => m.inventoryItemId?._id === item._id || m.inventoryItemId === item._id)}
                  onAdjust={handleAdjust}
                  onRemove={handleRemoveAdjustment}
                  isPending={adjustMutation.isPending}
                  viewMode="grid"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Movements */}
      {activeSession && sessionMovements.length > 0 && (
        <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Draft Adjustments in Session</h3>
            <span className="text-[10px] text-slate-500 font-medium">Click trash can to delete draft</span>
          </div>
          <div className="divide-y divide-slate-800/80 max-h-[300px] overflow-y-auto">
            {sessionMovements.map((movement) => (
              <div key={movement._id || (movement.inventoryItemId?._id || movement.inventoryItemId)} className="px-4 py-2 flex items-center justify-between text-xs hover:bg-slate-800/25 transition">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Package size={12} className="text-slate-500 shrink-0" />
                  <span className="text-slate-300 truncate font-medium">{movement.inventoryItemId?.itemName || 'Item'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-slate-500 text-[10px] bg-slate-855 px-1.5 py-0.5 rounded border border-slate-800">{movement.reason.replace(/_/g, ' ')}</span>
                  <span className={`font-bold font-sans ${movement.quantity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {movement.quantity >= 0 ? '+' : ''}{movement.quantity}
                  </span>
                  <span className="text-slate-550">→ {movement.newQty} {movement.inventoryItemId?.unit}</span>
                  <button
                    onClick={() => handleRemoveAdjustment(movement.inventoryItemId?._id || movement.inventoryItemId)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Remove adjustment"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discard Session Dialog */}
      {showDiscardDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (window.innerWidth >= 640 && e.target === e.currentTarget) setShowDiscardDialog(false);
          }}
        >
          <div
            className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700 max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--pos-text-primary)] mb-2 flex items-center gap-2 text-red-400">
              <AlertTriangle size={20} /> Discard Session?
            </h3>
            <p className="text-sm text-slate-405 mb-6 leading-relaxed">
              Are you sure you want to discard this adjustment session? All draft adjustments made in this session will be ignored, and no actual inventory levels will be modified. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[var(--pos-text-primary)] font-medium px-4 py-2.5 rounded-lg transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardSession}
                disabled={discardSessionMutation.isPending}
                className="flex-1 bg-red-650 hover:bg-red-500 disabled:opacity-60 text-white font-bold px-4 py-2.5 rounded-lg transition text-sm shadow-lg shadow-red-655/15"
              >
                {discardSessionMutation.isPending ? 'Discarding...' : 'Discard Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Session Dialog */}
      {showCompleteDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (window.innerWidth >= 640 && e.target === e.currentTarget) setShowCompleteDialog(false);
          }}
        >
          <div
            className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700 max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--pos-text-primary)] mb-2">Complete Session</h3>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              You are completing the adjustment session with <span className="font-semibold text-amber-400">{activeSession.adjustmentCount}</span> adjustments. The stock levels will be updated, and a permanent history log will be saved.
            </p>
            <div className="mb-5">
              <label className="block text-xs text-slate-455 mb-1.5 font-semibold">Session Notes (optional)</label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="E.g., Monthly physical stock reconciliation..."
                rows={3}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCompleteDialog(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[var(--pos-text-primary)] font-medium px-4 py-2.5 rounded-lg transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteSession}
                disabled={completeSessionMutation.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-bold px-4 py-2.5 rounded-lg transition text-sm shadow-lg shadow-amber-550/15"
              >
                {completeSessionMutation.isPending ? 'Completing...' : 'Complete Session'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={clearToast} />}
    </div>
  );
}

function InventoryAdjustRow({ item, existingAdjustment, onAdjust, onRemove, isPending, viewMode }) {
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [reason, setReason] = useState('count_correction');
  const [notes, setNotes] = useState('');

  // Sync state if existing draft adjustment is updated/loaded
  useEffect(() => {
    if (existingAdjustment) {
      setAdjustQty(String(existingAdjustment.quantity));
      setReason(existingAdjustment.reason);
      setNotes(existingAdjustment.notes || '');
    } else {
      setAdjustQty('');
      setReason('count_correction');
      setNotes('');
    }
  }, [existingAdjustment, showAdjustForm]);

  const handleSubmit = () => {
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty === 0) return;
    onAdjust(item._id, qty, reason, notes);
    setShowAdjustForm(false);
  };

  const handleCancel = () => {
    setShowAdjustForm(false);
    if (existingAdjustment) {
      setAdjustQty(String(existingAdjustment.quantity));
      setReason(existingAdjustment.reason);
      setNotes(existingAdjustment.notes || '');
    } else {
      setAdjustQty('');
      setReason('count_correction');
      setNotes('');
    }
  };

  const stockStatus = item.quantity < item.minThreshold ? 'low' : 'ok';
  const hasAdj = !!existingAdjustment;

  if (viewMode === 'grid') {
    return (
      <div className={`bg-[var(--pos-panel)] border rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-650 transition h-full shadow-md ${hasAdj ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'border-slate-700/50'}`}>
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-200 truncate" title={item.itemName}>{item.itemName}</span>
            <div className="flex items-center gap-1 shrink-0">
              {stockStatus === 'low' && (
                <span className="flex items-center gap-1 text-[10px] text-yellow-455 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                  <AlertTriangle size={10} /> Low
                </span>
              )}
              {hasAdj && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${existingAdjustment.quantity >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  Draft: {existingAdjustment.quantity >= 0 ? '+' : ''}{existingAdjustment.quantity}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 bg-slate-900/60 rounded-lg p-2 text-xs border border-slate-800/60">
            <div>
              <p className="text-[10px] text-slate-500">Current Stock</p>
              <p className="font-semibold text-slate-300">{item.quantity} {item.unit}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Min</p>
              <p className="font-semibold text-slate-300">{item.minThreshold} {item.unit}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/60">
          {!showAdjustForm ? (
            <div className="flex gap-1.5">
              {hasAdj && (
                <button
                  type="button"
                  onClick={() => onRemove(item._id)}
                  className="bg-red-650/15 hover:bg-red-655 text-red-400 hover:text-white p-1.5 rounded-lg border border-red-500/20 transition shrink-0 flex items-center justify-center"
                  title="Remove adjustment"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setShowAdjustForm(true)}
                className={`flex-1 font-semibold py-1.5 rounded-lg text-xs transition border ${hasAdj ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}
              >
                {hasAdj ? 'Edit Draft' : 'Adjust Qty'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="±Qty"
                  className="w-20 bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right font-semibold"
                  autoFocus
                />
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                className="w-full bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-1 rounded text-[10px] transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending || !adjustQty || adjustQty === '0'}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-1 rounded text-[10px] transition"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`px-4 py-3 transition ${hasAdj ? 'bg-amber-500/[0.015]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-200 truncate">{item.itemName}</span>
            {stockStatus === 'low' && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-450 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 shrink-0">
                <AlertTriangle size={10} /> Low
              </span>
            )}
            {hasAdj && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${existingAdjustment.quantity >= 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                Draft: {existingAdjustment.quantity >= 0 ? '+' : ''}{existingAdjustment.quantity} {item.unit}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">
              Stock: <span className="text-slate-355 font-medium">{item.quantity}</span> {item.unit}
            </span>
            <span className="text-xs text-slate-600 font-medium">
              Min: {item.minThreshold} {item.unit}
            </span>
          </div>
        </div>
        {!showAdjustForm ? (
          <div className="flex items-center gap-2 shrink-0">
            {hasAdj && (
              <button
                type="button"
                onClick={() => onRemove(item._id)}
                className="p-1.5 rounded-lg bg-red-650/15 hover:bg-red-600 hover:text-white text-red-400 border border-red-500/20 transition"
                title="Remove adjustment"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              onClick={() => setShowAdjustForm(true)}
              className={`flex items-center gap-1 font-semibold px-3 py-1.5 rounded-lg transition text-xs border ${hasAdj ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700' : 'bg-slate-705 hover:bg-slate-600 text-slate-300 border-slate-700'}`}
            >
              {hasAdj ? 'Edit' : 'Adjust'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCancel}
            className="text-slate-500 hover:text-slate-300 text-xs shrink-0"
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
              className="w-24 bg-slate-900 border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 text-right font-semibold"
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
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-bold px-3 py-2 rounded-lg transition text-xs shadow-lg shadow-amber-500/10"
          >
            {isPending ? 'Adjusting...' : hasAdj ? 'Save Draft Adjustment' : 'Apply Draft Adjustment'}
          </button>
        </div>
      )}
    </div>
  );
}
