import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const NOTIFICATION_QUERY_PREFIXES = [
  'notifications-unread-count',
  'notifications-bell',
  'notifications-all',
  'waiter-call-notifications',
  'qr-order-update-notifications',
];

/**
 * Opens one SSE connection when logged in; invalidates notification-related React Query caches on push.
 */
export default function PosNotificationStream() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tokenRef = useRef(typeof window !== 'undefined' ? localStorage.getItem('pos_token') : null);

  useEffect(() => {
    tokenRef.current = localStorage.getItem('pos_token');
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !user?.tenantId) return undefined;
    const token = localStorage.getItem('pos_token');
    if (!token) return undefined;

    const url = `${window.location.origin}/api/notifications/stream?token=${encodeURIComponent(token)}`;
    let es;
    try {
      es = new EventSource(url);
    } catch {
      return undefined;
    }

    const invalidate = () => {
      NOTIFICATION_QUERY_PREFIXES.forEach((prefix) => {
        qc.invalidateQueries({ queryKey: [prefix] });
      });
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'refresh') invalidate();
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      try {
        es.close();
      } catch {
        /* ignore */
      }
    };
  }, [user?.id, user?.tenantId, qc]);

  return null;
}
