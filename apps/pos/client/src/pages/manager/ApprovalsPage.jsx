import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Check, X, Clock, User, Edit, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

// Helper to format dates
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper to get field label
const getFieldLabel = (key) => {
  const labels = {
    name: 'Name',
    description: 'Description',
    type: 'Type',
    startDate: 'Start Date',
    endDate: 'End Date',
    active: 'Active',
    bundlePrice: 'Bundle Price',
    buyQty: 'Buy Quantity',
    getFreeQty: 'Free Quantity',
    flatPrice: 'Flat Price',
    discountAmount: 'Discount Amount',
    discountPercent: 'Discount Percent',
    minOrderAmount: 'Minimum Order Amount',
    maxDiscountAmount: 'Maximum Discount Amount',
    pointsCost: 'Points Cost',
    redemptionType: 'Redemption Type',
    rewardType: 'Reward Type',
    minTierLevel: 'Minimum Tier Level',
  };
  return labels[key] || key;
};

// Helper to format field values
const formatValue = (key, value) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key.includes('Date')) return formatDate(value);
  if (typeof value === 'number' && (key.includes('Price') || key.includes('Amount'))) {
    return `Rs ${value.toFixed(2)}`;
  }
  if (typeof value === 'number' && key.includes('Percent')) {
    return `${value}%`;
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Component to show change delta
function ChangesDelta({ previousValues, newValues }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!previousValues || !newValues) return null;

  // Find changed fields
  const changedFields = {};
  const allKeys = new Set([...Object.keys(previousValues), ...Object.keys(newValues)]);
  
  allKeys.forEach(key => {
    // Skip internal fields
    if (key.startsWith('_') || key === 'tenantId' || key === 'storeId' || key === 'createdAt' || 
        key === 'updatedAt' || key === 'changeHistory' || key === 'approvalStatus') return;
    
    const oldVal = previousValues[key];
    const newVal = newValues[key];
    
    // Compare values (handle arrays and objects)
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);
    
    if (oldStr !== newStr) {
      changedFields[key] = { old: oldVal, new: newVal };
    }
  });

  const changeCount = Object.keys(changedFields).length;
  if (changeCount === 0) return <p className="text-xs text-slate-500">No field changes detected</p>;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {changeCount} field{changeCount > 1 ? 's' : ''} changed
      </button>
      
      {expanded && (
        <div className="bg-[var(--pos-surface-inset)] border border-slate-700/50 rounded-lg p-3 space-y-2">
          {Object.entries(changedFields).map(([key, { old, new: newVal }]) => (
            <div key={key} className="text-xs">
              <div className="font-semibold text-slate-300 mb-1">{getFieldLabel(key)}</div>
              <div className="flex items-start gap-2">
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                  <span className="text-red-400 font-mono text-[10px] mr-1">OLD:</span>
                  <span className="text-slate-300">{formatValue(key, old)}</span>
                </div>
                <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded px-2 py-1">
                  <span className="text-green-400 font-mono text-[10px] mr-1">NEW:</span>
                  <span className="text-slate-300">{formatValue(key, newVal)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component to show change history
function ChangeHistory({ history }) {
  if (!history || history.length === 0) return null;

  // Get the latest change entry
  const latestChange = history[history.length - 1];
  
  return (
    <div className="bg-[var(--pos-surface-inset)] border border-slate-700/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs">
        {latestChange.action === 'created' && <Plus size={12} className="text-blue-400" />}
        {latestChange.action === 'updated' && <Edit size={12} className="text-amber-400" />}
        <span className="font-semibold text-slate-300 capitalize">{latestChange.action}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-slate-500 flex items-center gap-1">
            <User size={10} />
            <span>Changed by</span>
          </div>
          <div className="text-slate-200 font-medium">
            {latestChange.changedBy?.name || 'Unknown User'}
          </div>
        </div>
        <div>
          <div className="text-slate-500 flex items-center gap-1">
            <Clock size={10} />
            <span>Changed at</span>
          </div>
          <div className="text-slate-200 font-medium">
            {formatDate(latestChange.changedAt)}
          </div>
        </div>
      </div>

      {latestChange.action === 'updated' && (
        <ChangesDelta 
          previousValues={latestChange.previousValues} 
          newValues={latestChange.newValues} 
        />
      )}
      
      {latestChange.reason && latestChange.reason !== 'Initial creation' && latestChange.reason !== 'Manager update' && (
        <div className="text-xs">
          <span className="text-slate-500">Reason:</span>
          <span className="text-slate-300 ml-1">{latestChange.reason}</span>
        </div>
      )}
    </div>
  );
}

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
                <ul className="space-y-3">
                  {promos.map((p) => (
                    <li key={p._id} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
                      <div>
                        <p className="font-semibold text-[var(--pos-text-primary)] text-base">{p.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.type} · {formatDate(p.startDate)} to {formatDate(p.endDate)}</p>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                        )}
                      </div>

                      <ChangeHistory history={p.changeHistory} />

                      {showReject[`p-${p._id}`] ? (
                        <div className="flex gap-2">
                          <input
                            placeholder="Reason for rejection"
                            value={rejectReason[`p-${p._id}`] || ''}
                            onChange={(e) =>
                              setRejectReason((s) => ({ ...s, [`p-${p._id}`]: e.target.value }))
                            }
                            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-3 py-2 text-sm text-[var(--pos-text-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              rejectPromo.mutate({
                                id: p._id,
                                reason: rejectReason[`p-${p._id}`] || 'Rejected',
                              })
                            }
                            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition"
                          >
                            Confirm reject
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReject((s) => ({ ...s, [`p-${p._id}`]: false }))}
                            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => approvePromo.mutate(p._id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition"
                          >
                            <Check size={16} /> Approve & Activate
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReject((s) => ({ ...s, [`p-${p._id}`]: true }))}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition"
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
                <ul className="space-y-3">
                  {rewards.map((r) => (
                    <li key={r._id} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
                      <div>
                        <p className="font-semibold text-[var(--pos-text-primary)] text-base">{r.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.pointsCost} points · {r.rewardType} · {r.redemptionType} redemption
                        </p>
                        {r.description && (
                          <p className="text-xs text-slate-400 mt-1">{r.description}</p>
                        )}
                      </div>

                      <ChangeHistory history={r.changeHistory} />

                      {showReject[`r-${r._id}`] ? (
                        <div className="flex gap-2">
                          <input
                            placeholder="Reason for rejection"
                            value={rejectReason[`r-${r._id}`] || ''}
                            onChange={(e) =>
                              setRejectReason((s) => ({ ...s, [`r-${r._id}`]: e.target.value }))
                            }
                            className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-3 py-2 text-sm text-[var(--pos-text-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              rejectReward.mutate({
                                id: r._id,
                                reason: rejectReason[`r-${r._id}`] || 'Rejected',
                              })
                            }
                            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition"
                          >
                            Confirm reject
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReject((s) => ({ ...s, [`r-${r._id}`]: false }))}
                            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => approveReward.mutate(r._id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition"
                          >
                            <Check size={16} /> Approve & Activate
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReject((s) => ({ ...s, [`r-${r._id}`]: true }))}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition"
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
