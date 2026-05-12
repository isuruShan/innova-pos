import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '../../api/axios';
import { notificationPathForAdmin } from '../../utils/notificationRoutes';

const PAGE_SIZE = 40;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

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
    navigate(notificationPathForAdmin(n));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="text-brand-orange" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">All notifications</h1>
        </div>
        <p className="text-gray-600 text-sm">
          Full history. The bell menu shows a short list and hides read items older than 24 hours.
        </p>
      </div>

      {isPending ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications yet.</p>
      ) : (
        <>
          <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden bg-white shadow-sm">
            {rows.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => onRow(n)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition ${
                    !n.readAt ? 'bg-amber-50/80' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.body ? <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{n.body}</p> : null}
                  <p className="text-[10px] text-gray-400 mt-2">
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
              className="text-sm font-medium text-brand-teal hover:opacity-90 disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load older'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
