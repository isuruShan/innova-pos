import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useAuth } from '../../context/AuthContext';
import { notificationPathForPos } from '../../utils/notificationRoutes';

const PAGE_SIZE = 40;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isPending, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['notifications-all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get('/notifications', { params: { limit: PAGE_SIZE, skip: pageParam } }).then((r) => r.data),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });

  const rows = data?.pages.flat() ?? [];

  const invalidateLists = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    qc.invalidateQueries({ queryKey: ['notifications-all'] });
  }, [qc]);

  const onRow = async (n) => {
    if (!n.readAt) {
      try {
        await api.patch(`/notifications/${n._id}/read`);
      } catch {
        /* ignore */
      }
      invalidateLists();
    }
    const path = notificationPathForPos(n, user?.role);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="text-amber-400" size={22} />
          <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">All notifications</h1>
        </div>
        <p className="text-slate-500 text-sm mb-6">
          Full history. The bell menu only shows recent items and unread alerts.
        </p>

        {isPending ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm">No notifications yet.</p>
        ) : (
          <>
            <ul className="rounded-2xl border border-slate-700/50 divide-y divide-slate-800/60 overflow-hidden bg-[var(--pos-surface-inset)]">
              {rows.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => onRow(n)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-slate-800/30 transition ${
                      !n.readAt ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--pos-text-primary)]">{n.title}</p>
                    {n.body ? <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{n.body}</p> : null}
                    <p className="text-[10px] text-slate-600 mt-2">
                      {new Date(n.createdAt).toLocaleString()}
                      {n.readAt ? ` · Read ${new Date(n.readAt).toLocaleString()}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {hasNextPage && (
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="mt-4 text-sm text-amber-400 hover:text-amber-300 font-medium disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load older'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
