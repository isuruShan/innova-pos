import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '../api/axios';

export default function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data),
    refetchInterval: 25_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => api.get('/notifications', { params: { limit: 25 } }).then((r) => r.data),
    enabled: open,
  });

  const readOne = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = countData?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg border border-gray-300 bg-white text-amber-600 hover:bg-amber-50 hover:border-amber-400 transition shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-[min(70vh,24rem)] bg-white border border-gray-200 rounded-xl shadow-xl z-[200] flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => readAll.mutate()}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="overflow-y-auto flex-1 py-1">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">No notifications</li>
            ) : (
              items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.readAt) readOne.mutate(n._id);
                    }}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 ${
                      !n.readAt ? 'bg-amber-50/80' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
