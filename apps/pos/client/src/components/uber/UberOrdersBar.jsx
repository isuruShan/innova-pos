import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, X, Loader2, Play } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import OrderDetailSlideOver from '../OrderDetailSlideOver';

// playChime uses Web Audio API to play a double arpeggiated chime
function playChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.3);
    
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1109, audioCtx.currentTime + 0.12); // C#6
    gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.42);
    osc2.start(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + 0.42);
  } catch (e) {
    console.warn('Failed to play audio chime:', e);
  }
}

function ElapsedTime({ createdAt }) {
  const [mins, setMins] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
      setMins(Math.max(0, diff));
    };
    calc();
    const timer = setInterval(calc, 30000);
    return () => clearInterval(timer);
  }, [createdAt]);

  return <span>{mins < 1 ? '< 1m' : `${mins}m`}</span>;
}

export default function UberOrdersBar() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { selectedStoreId, isStoreReady } = useStoreContext();
  
  const [alertOrder, setAlertOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [prepTimeInput, setPrepTimeInput] = useState('15');
  const [denyReason, setDenyReason] = useState('OUT_OF_ITEMS');
  const [showDenyForm, setShowDenyForm] = useState(false);
  const prevOrdersCountRef = useRef(0);

  // 1. Fetch Tenant settings to check if add-on is active
  const { data: paidAddons } = useQuery({
    queryKey: ['tenant-paid-addons'],
    queryFn: () => api.get('/tenant/paid-addons').then((r) => r.data),
    staleTime: 60_000,
  });

  const isAddonActive = paidAddons?.uberEats === true;

  // 2. Fetch active Uber Eats orders
  const { data: orders = [] } = useQuery({
    queryKey: ['uber-active-orders', selectedStoreId],
    queryFn: () =>
      api
        .get('/uber/orders/active', { params: { storeId: selectedStoreId } })
        .then((r) => r.data),
    enabled: isStoreReady && !!selectedStoreId && isAddonActive,
    refetchInterval: 12000,
  });

  // Sound and Popup trigger logic on new pending orders
  useEffect(() => {
    if (!orders.length) {
      prevOrdersCountRef.current = 0;
      return;
    }

    const pendingOrders = orders.filter((o) => o.status === 'pending');
    if (pendingOrders.length > 0) {
      // Find if there is a new pending order
      const firstPending = pendingOrders[0];
      if (prevOrdersCountRef.current < pendingOrders.length) {
        playChime();
        setAlertOrder(firstPending);
      }
    }
    prevOrdersCountRef.current = pendingOrders.length;
  }, [orders]);

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: ({ id, prepTime }) =>
      api.put(`/uber/orders/${encodeURIComponent(id)}/uber-accept`, { prepTime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uber-active-orders'] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
      setAlertOrder(null);
      setSelectedOrder(null);
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to accept order'),
  });

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      api.put(`/uber/orders/${encodeURIComponent(id)}/uber-deny`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uber-active-orders'] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
      setAlertOrder(null);
      setSelectedOrder(null);
      setShowDenyForm(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to deny order'),
  });

  if (!isAddonActive || !orders.length) return null;

  return (
    <>
      <div className="border-b border-emerald-500/25 bg-gradient-to-r from-emerald-950/90 via-emerald-900/80 to-emerald-950/90 px-3 py-2 flex items-center gap-2 shrink-0 z-[55]">
        <Truck size={16} className="text-emerald-400 shrink-0" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200/90 shrink-0 hidden sm:inline">
          Uber Eats
        </span>
        <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto pb-0.5">
          {orders.map((o) => (
            <button
              key={o._id}
              type="button"
              onClick={() => setSelectedOrder(o)}
              className={`shrink-0 max-w-[14rem] text-left px-3 py-1.5 rounded-xl border transition text-xs flex items-center gap-2 ${
                o.status === 'pending'
                  ? 'bg-amber-500/15 border-amber-400/35 hover:bg-amber-500/25 text-amber-50 animate-pulse'
                  : 'bg-emerald-500/15 border-emerald-400/35 hover:bg-emerald-500/25 text-emerald-50'
              }`}
            >
              <span className="font-mono font-bold text-amber-400">{o.reference}</span>
              <span className="opacity-75 capitalize">{o.status}</span>
              <span className="text-slate-500 shrink-0">
                • <ElapsedTime createdAt={o.createdAt} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Real-time incoming order popup alert */}
      {alertOrder && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-[var(--pos-panel)] shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
                  <span>🛵</span> New Uber Eats Order
                </h2>
                <p className="text-sm font-mono text-emerald-400 font-bold mt-1">
                  Reference ID: {alertOrder.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {!showDenyForm ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-[var(--pos-surface-inset)] p-3.5 border border-slate-700/50">
                  <p className="text-sm text-slate-300 font-semibold mb-2">Order Items:</p>
                  <ul className="text-xs space-y-1.5 divide-y divide-slate-800">
                    {(alertOrder.items || []).map((item, index) => (
                      <li key={index} className="pt-1.5 first:pt-0 flex justify-between">
                        <span className="truncate text-slate-200">{item.name}</span>
                        <span className="text-slate-500 font-semibold">×{item.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-400">Prep Time (mins):</label>
                  <select
                    value={prepTimeInput}
                    onChange={(e) => setPrepTimeInput(e.target.value)}
                    className="rounded-lg bg-[var(--pos-surface-inset)] border border-slate-700 text-sm text-[var(--pos-text-primary)] p-1.5 outline-none"
                  >
                    <option value="10">10 mins</option>
                    <option value="15">15 mins</option>
                    <option value="20">20 mins</option>
                    <option value="30">30 mins</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDenyForm(true)}
                    className="flex-1 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-sm transition"
                  >
                    Deny Order
                  </button>
                  <button
                    type="button"
                    onClick={() => acceptMutation.mutate({ id: alertOrder._id, prepTime: prepTimeInput })}
                    disabled={acceptMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold text-sm transition flex justify-center items-center gap-2"
                  >
                    {acceptMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                    Accept Order
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Denial Reason:</label>
                  <select
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    className="w-full rounded-lg bg-[var(--pos-surface-inset)] border border-slate-700 text-sm text-[var(--pos-text-primary)] p-2.5 outline-none"
                  >
                    <option value="OUT_OF_ITEMS">Out of Items</option>
                    <option value="KITCHEN_CLOSED">Kitchen Closed</option>
                    <option value="TOO_BUSY">Store Too Busy</option>
                    <option value="CUSTOMER_REQUEST">Customer Request</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDenyForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => denyMutation.mutate({ id: alertOrder._id, reason: denyReason })}
                    disabled={denyMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-450 disabled:opacity-50 text-white font-bold text-sm transition flex justify-center items-center gap-2"
                  >
                    {denyMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                    Confirm Deny
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected slide-over detail */}
      {selectedOrder && (
        <OrderDetailSlideOver
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          canCancel={true}
        />
      )}
    </>
  );
}
