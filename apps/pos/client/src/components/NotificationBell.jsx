import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { notificationPathForPos } from '../utils/notificationRoutes';

export default function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data),
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['notifications-bell'],
    queryFn: () =>
      api.get('/notifications', { params: { bell: 1, limit: 10 } }).then((r) => r.data),
    enabled: open,
  });

  const invalidateLists = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    qc.invalidateQueries({ queryKey: ['notifications-all'] });
  }, [qc]);

  const readOne = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidateLists,
  });

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: invalidateLists,
  });

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = countData?.count ?? 0;

  const handleItemClick = async (n) => {
    if (!n.readAt) {
      readOne.mutate(n._id);
    }
    const path = notificationPathForPos(n, user?.role);
    navigate(path);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl border border-white/15 bg-black/25 text-amber-400 hover:text-amber-300 hover:bg-white/10 hover:border-amber-500/40 transition shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-[min(70vh,24rem)] bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--pos-text-primary)]">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => readAll.mutate()}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="overflow-y-auto flex-1 py-1 min-h-0">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">No notifications</li>
            ) : (
              items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-800/50 hover:bg-slate-800/40 ${
                      !n.readAt ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--pos-text-primary)]">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-3">{n.body}</p>}
                    <p className="text-[10px] text-slate-600 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="px-3 py-2 border-t border-slate-700/50 shrink-0">
            <Link
              to="/manager/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-amber-400 hover:text-amber-300 py-1"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
