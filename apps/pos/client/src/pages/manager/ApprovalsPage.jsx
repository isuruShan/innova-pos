import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Check, X } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState({});
  const [showReject, setShowReject] = useState({});

  const { data: promos = [], isPending: p1 } = useQuery({
    queryKey: ['promotions-pending'],
    queryFn: () => api.get('/promotions', { params: { pending: true } }).then((r) => r.data),
  });

  const { data: rewards = [], isPending: p2 } = useQuery({
    queryKey: ['loyalty-rewards-pending'],
    queryFn: () => api.get('/loyalty/rewards', { params: { pending: true } }).then((r) => r.data),
  });

  const approvePromo = useMutation({
    mutationFn: (id) => api.post(`/promotions/${id}/approve`, { active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions-pending'] });
      qc.invalidateQueries({ queryKey: ['promotions'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
      qc.invalidateQueries({ queryKey: ['notifications-all'] });
    },
  });

  const rejectPromo = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/promotions/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions-pending'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
      qc.invalidateQueries({ queryKey: ['notifications-all'] });
    },
  });

  const approveReward = useMutation({
    mutationFn: (id) => api.post(`/loyalty/rewards/${id}/approve`, { active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards-pending'] });
      qc.invalidateQueries({ queryKey: ['loyalty-rewards'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
      qc.invalidateQueries({ queryKey: ['notifications-all'] });
    },
  });

  const rejectReward = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/loyalty/rewards/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-rewards-pending'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-bell'] });
      qc.invalidateQueries({ queryKey: ['notifications-all'] });
    },
  });

  const pending = promos.length + rewards.length;

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Inbox className="text-amber-400" />
          <h1 className="text-xl font-bold text-[var(--pos-text-primary)]">Approvals</h1>
          {pending > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending}</span>
          )}
        </div>
        <p className="text-slate-500 text-sm mb-6">Approve or reject promotions and loyalty rewards submitted by managers.</p>

        {p1 || p2 ? (
          <p className="text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Promotions</h2>
              {promos.length === 0 ? (
                <p className="text-slate-600 text-sm">No pending promotions.</p>
              ) : (
                <ul className="space-y-2">
                  {promos.map((p) => (
                    <li key={p._id} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
                      <div>
                        <p className="font-semibold text-[var(--pos-text-primary)]">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.type}</p>
                      </div>
                      {showReject[`p-${p._id}`] ? (
                        <div className="flex gap-2">
                          <input
                            placeholder="Reason"
                            value={rejectReason[`p-${p._id}`] || ''}
                            onChange={(e) =>
                              setRejectReason((s) => ({ ...s, [`p-${p._id}`]: e.target.value }))
                            }
                            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              rejectPromo.mutate({
                                id: p._id,
                                reason: rejectReason[`p-${p._id}`] || 'Rejected',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm"
                          >
                            Confirm reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => approvePromo.mutate(p._id)}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium"
                          >
                            <Check size={16} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReject((s) => ({ ...s, [`p-${p._id}`]: true }))}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-500/15 text-red-400 text-sm"
                          >
                            <X size={16} /> Reject
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Loyalty rewards</h2>
              {rewards.length === 0 ? (
                <p className="text-slate-600 text-sm">No pending rewards.</p>
              ) : (
                <ul className="space-y-2">
                  {rewards.map((r) => (
                    <li key={r._id} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
                      <div>
                        <p className="font-semibold text-[var(--pos-text-primary)]">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.pointsCost} points · {r.rewardType}</p>
                      </div>
                      {showReject[`r-${r._id}`] ? (
                        <div className="flex gap-2">
                          <input
                            placeholder="Reason"
                            value={rejectReason[`r-${r._id}`] || ''}
                            onChange={(e) =>
                              setRejectReason((s) => ({ ...s, [`r-${r._id}`]: e.target.value }))
                            }
                            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              rejectReward.mutate({
                                id: r._id,
                                reason: rejectReason[`r-${r._id}`] || 'Rejected',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm"
                          >
                            Confirm reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => approveReward.mutate(r._id)}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium"
                          >
                            <Check size={16} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReject((s) => ({ ...s, [`r-${r._id}`]: true }))}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-500/15 text-red-400 text-sm"
                          >
                            <X size={16} /> Reject
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
