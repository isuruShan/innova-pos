import { useEffect, useState } from 'react';
import { X, RefreshCw, Trash2, ShoppingCart, FileEdit, AlertCircle, CheckCircle, Wifi, Database } from 'lucide-react';
import { listQueue, removeQueueItem, removePendingOrder } from '../offline/idb.js';
import { processSyncQueue } from '../offline/sync.js';
import { formatCurrency } from '../utils/format.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

export default function OfflineQueueManagerModal({ open, onClose }) {
  const online = useOnlineStatus();
  const [queue, setQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load items from IndexedDB sync queue
  const loadQueue = async () => {
    try {
      const items = await listQueue();
      // Sort oldest first (FIFO order)
      const sorted = items.sort((a, b) => a.createdAt - b.createdAt);
      setQueue(sorted);
    } catch (err) {
      console.error('[OfflineQueueManager] Failed to load sync queue:', err);
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    loadQueue();

    // Event listeners to refresh queue in real-time
    const handleQueueChange = () => loadQueue();
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => {
      setIsSyncing(false);
      loadQueue();
    };

    window.addEventListener('pos-offline-queue', handleQueueChange);
    window.addEventListener('pos-offline-sync-start', handleSyncStart);
    window.addEventListener('pos-offline-sync-end', handleSyncEnd);
    window.addEventListener('pos-offline-sync-done', handleQueueChange);

    return () => {
      window.removeEventListener('pos-offline-queue', handleQueueChange);
      window.removeEventListener('pos-offline-sync-start', handleSyncStart);
      window.removeEventListener('pos-offline-sync-end', handleSyncEnd);
      window.removeEventListener('pos-offline-sync-done', handleQueueChange);
    };
  }, [open]);

  if (!open) return null;

  const handleSyncNow = async () => {
    if (!online || isSyncing) return;
    await processSyncQueue();
  };

  const handleRemoveItem = async (item) => {
    if (window.confirm('Are you sure you want to remove this pending change? If it is a new order, it will be deleted from this device.')) {
      try {
        if (item.clientRequestId) {
          await removePendingOrder(item.clientRequestId);
        }
        await removeQueueItem(item.id);
        window.dispatchEvent(new CustomEvent('pos-offline-queue'));
      } catch (err) {
        console.error('[OfflineQueueManager] Failed to remove item:', err);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('WARNING: Are you sure you want to clear the entire offline sync queue? All unsynced orders and updates will be permanently lost.')) {
      try {
        const items = await listQueue();
        for (const item of items) {
          if (item.clientRequestId) {
            await removePendingOrder(item.clientRequestId);
          }
          await removeQueueItem(item.id);
        }
        window.dispatchEvent(new CustomEvent('pos-offline-queue'));
      } catch (err) {
        console.error('[OfflineQueueManager] Failed to clear queue:', err);
      }
    }
  };

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between gap-4 shrink-0 bg-slate-900/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
              <Database size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[var(--pos-text-primary)] truncate">Offline Sync Queue</h3>
              <p className="text-xs text-[var(--pos-text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                {online ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <Wifi size={11} /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                    <Wifi size={11} className="opacity-70 animate-pulse" /> Working Offline
                  </span>
                )}
                · {queue.length} pending change{queue.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)] p-2 hover:bg-slate-800/40 rounded-xl transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {queue.length === 0 ? (
            <div className="text-center py-12 px-4 flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
                <CheckCircle size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--pos-text-primary)]">All Synced Up!</h4>
                <p className="text-xs text-[var(--pos-text-muted)] max-w-sm">
                  There are no pending changes in the offline queue. All transactions have been synchronized to the cloud.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item, idx) => {
                const isOrder = item.kind === 'POST_ORDERS';
                const hasError = !!item.lastError;
                
                return (
                  <div 
                    key={item.id}
                    className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
                      hasError 
                        ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10' 
                        : 'border-slate-700/50 bg-slate-900/15 hover:bg-slate-900/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Info Icon and Description */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                          hasError
                            ? 'bg-red-500/15 border-red-500/20 text-red-400'
                            : isOrder
                              ? 'bg-blue-500/15 border-blue-500/20 text-blue-400'
                              : 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400'
                        }`}>
                          {isOrder ? <ShoppingCart size={15} /> : <FileEdit size={15} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight font-mono">
                              #{idx + 1}
                            </span>
                            <h4 className="text-sm font-semibold text-[var(--pos-text-primary)] truncate">
                              {isOrder 
                                ? `Create ${String(item.body?.orderType || 'dine-in').toUpperCase()} Order`
                                : `Update Order Status to ${String(item.body?.status || 'Next').toUpperCase()}`
                              }
                            </h4>
                          </div>
                          
                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-[var(--pos-text-muted)] font-medium">
                            <span>Added: {formatTime(item.createdAt)}</span>
                            {isOrder && (
                              <>
                                <span>•</span>
                                <span>Table: {item.body?.tableNumber || '—'}</span>
                                <span>•</span>
                                <span className="font-mono font-bold text-slate-300">
                                  {formatCurrency(item.body?.paymentAmount || item.body?.totalAmount || 0)}
                                </span>
                              </>
                            )}
                            {!isOrder && (
                              <>
                                <span>•</span>
                                <span className="font-mono">ID: {item.url ? item.url.split('/')[2]?.slice(-8) : '...'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item)}
                          disabled={isSyncing}
                          className="p-2 rounded-xl text-red-500/80 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                          title="Remove item from queue"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Error Banner */}
                    {hasError && (
                      <div className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 font-mono leading-relaxed">
                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500" />
                        <div className="flex-1">
                          <span className="font-bold uppercase tracking-wider text-[9px] bg-red-500/10 px-1.5 py-0.5 rounded mr-1.5 border border-red-500/20">
                            Sync Error
                          </span>
                          {item.lastError}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-900/10">
          <div>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isSyncing}
                className="px-3.5 py-2 text-xs font-semibold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer disabled:opacity-40"
              >
                Clear Queue
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)] hover:bg-slate-800/40 border border-slate-700/60 transition cursor-pointer"
            >
              Close
            </button>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={!online || isSyncing}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  online
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/10'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/40 shadow-none'
                }`}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Sync Queue
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
