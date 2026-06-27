import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { listQueue } from '../offline/idb.js';
import { processSyncQueue } from '../offline/sync.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import OfflineQueueManagerModal from './OfflineQueueManagerModal.jsx';

async function countPending() {
  const q = await listQueue();
  return q.length;
}

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

  const refresh = async () => {
    setPending(await countPending());
  };

  useEffect(() => {
    refresh();
    const onQ = () => refresh();
    window.addEventListener('pos-offline-queue', onQ);
    window.addEventListener('pos-offline-sync-done', onQ);
    return () => {
      window.removeEventListener('pos-offline-queue', onQ);
      window.removeEventListener('pos-offline-sync-done', onQ);
    };
  }, []);

  const showOffline = !online;
  const showPending = online && pending > 0;

  if (!showOffline && !showPending) return null;

  return (
    <>
      <div
        className={`flex items-center justify-center flex-wrap gap-x-3 gap-y-1 px-4 py-2 text-xs font-semibold border-b ${
          showOffline
            ? 'bg-amber-950/90 text-amber-200 border-amber-600/40'
            : 'bg-sky-950/80 text-sky-200 border-sky-700/40'
        }`}
      >
        {showOffline ? (
          <div className="flex items-center justify-center gap-2 flex-wrap text-center">
            <CloudOff size={14} className="shrink-0 text-amber-400" />
            <span>You are offline. Changes are saved on this device and will sync when online.</span>
            <button
              type="button"
              onClick={() => setIsQueueModalOpen(true)}
              className="ml-2.5 underline underline-offset-2 hover:text-white font-bold cursor-pointer"
            >
              Manage Queue ({pending})
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 flex-wrap text-center">
            <RefreshCw size={14} className="shrink-0 text-sky-300" />
            <span>
              {pending} offline change{pending === 1 ? '' : 's'} queued — will sync automatically.
            </span>
            <div className="flex items-center gap-2 ml-1">
              <button
                type="button"
                onClick={() => setIsQueueModalOpen(true)}
                className="underline underline-offset-2 hover:text-white font-bold cursor-pointer"
              >
                Manage Queue
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => processSyncQueue()}
                className="underline underline-offset-2 hover:text-white font-bold cursor-pointer"
              >
                Retry now
              </button>
            </div>
          </div>
        )}
      </div>

      <OfflineQueueManagerModal 
        open={isQueueModalOpen} 
        onClose={() => setIsQueueModalOpen(false)} 
      />
    </>
  );
}
