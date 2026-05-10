import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { listQueue } from '../offline/idb.js';
import { processSyncQueue } from '../offline/sync.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

async function countPending() {
  const q = await listQueue();
  return q.length;
}

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);

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
    <div
      className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium border-b ${
        showOffline
          ? 'bg-amber-950/90 text-amber-200 border-amber-600/40'
          : 'bg-sky-950/80 text-sky-200 border-sky-700/40'
      }`}
    >
      {showOffline ? (
        <>
          <CloudOff size={14} className="shrink-0" />
          <span>You are offline. Orders and changes are saved on this device and will sync when online.</span>
        </>
      ) : (
        <>
          <RefreshCw size={14} className="shrink-0 text-sky-300" />
          <span>
            {pending} offline change{pending === 1 ? '' : 's'} queued — will sync automatically.
          </span>
          <button
            type="button"
            onClick={() => processSyncQueue()}
            className="ml-2 underline underline-offset-2 hover:text-white"
          >
            Retry now
          </button>
        </>
      )}
    </div>
  );
}
