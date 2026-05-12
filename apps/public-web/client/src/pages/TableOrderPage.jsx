import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ShoppingBag, Plus, Minus, Loader2, ArrowLeft } from 'lucide-react';

function apiUrl(path) {
  const base = (import.meta.env.VITE_POS_API_URL || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `$${x.toFixed(2)}`;
}

const STATUS_LABEL = {
  pending: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function TableOrderPage() {
  const { token } = useParams();
  const [cart, setCart] = useState([]);
  const [activeCat, setActiveCat] = useState('All');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchSession = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(apiUrl(`/api/public/table-order/${encodeURIComponent(token)}`));
      setPayload(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => fetchSession(), 12_000);
    return () => clearInterval(id);
  }, [token, fetchSession]);

  const menuItems = payload?.menuItems || [];
  const categories = useMemo(() => {
    const c = [...new Set(menuItems.map((m) => m.category).filter(Boolean))].sort();
    return ['All', ...c];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    if (activeCat === 'All') return menuItems;
    return menuItems.filter((m) => m.category === activeCat);
  }, [menuItems, activeCat]);

  const addOne = (item) => {
    setCart((prev) => {
      const id = String(item._id);
      const found = prev.find((x) => x.menuItem === id);
      if (found) {
        return prev.map((x) => (x.menuItem === id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { menuItem: id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const changeQty = (menuItemId, delta) => {
    setCart((prev) =>
      prev
        .map((x) => (x.menuItem === menuItemId ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0),
    );
  };

  const cartTotal = cart.reduce((s, i) => s + Number(i.price || 0) * i.qty, 0);

  const onConfirm = async () => {
    if (!cart.length || !token) return;
    setMsg('');
    setSubmitting(true);
    try {
      await axios.post(apiUrl(`/api/public/table-order/${encodeURIComponent(token)}/items`), {
        items: cart.map((c) => ({ menuItem: c.menuItem, qty: c.qty })),
      });
      setCart([]);
      setMsg('Sent to the kitchen. Thank you!');
      fetchSession();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Could not send order');
    } finally {
      setSubmitting(false);
    }
  };

  const order = payload?.order;

  if (!token) {
    return <p className="text-center text-gray-500 py-16">Missing link.</p>;
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 className="animate-spin w-10 h-10" />
        <p>Loading menu…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-medium">
          {loadError.response?.data?.message || 'Unable to load this table.'}
        </p>
        <Link to="/" className="inline-flex items-center gap-2 mt-6 text-teal-700 font-semibold">
          <ArrowLeft size={18} /> Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 shadow-sm">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2">
          <ArrowLeft size={16} /> Home
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{payload.storeName}</h1>
        <p className="text-gray-600 text-sm mt-1">
          Table <span className="font-semibold text-teal-700">{payload.tableLabel}</span>
        </p>
      </header>

      {msg && (
        <div className="mx-4 mt-4 rounded-xl bg-teal-50 border border-teal-100 text-teal-900 text-sm px-4 py-3">{msg}</div>
      )}

      {order && (
        <section className="mx-4 mt-4 rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Your order</p>
              <p className="font-mono font-bold text-gray-900">#{String(order.orderNumber).padStart(3, '0')}</p>
            </div>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-100">
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </div>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {(order.items || []).map((line, idx) => (
              <li key={idx} className="py-2 flex justify-between gap-2">
                <span className="text-gray-800">
                  {line.name} × {line.qty}
                </span>
                <span className="text-gray-500 tabular-nums">{fmtMoney(line.price * line.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">{fmtMoney(order.totalAmount)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Pay with staff when you finish — totals update when you add items below.
          </p>
        </section>
      )}

      <section className="px-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <ShoppingBag size={20} className="text-teal-600" />
          Menu
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCat(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                activeCat === c
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredMenu.map((item) => (
            <button
              key={item._id}
              type="button"
              disabled={!item.available}
              onClick={() => item.available && addOne(item)}
              className={`text-left rounded-2xl border p-4 bg-white shadow-sm transition ${
                item.available
                  ? 'border-gray-200 hover:border-teal-300 hover:shadow'
                  : 'opacity-50 cursor-not-allowed border-gray-100'
              }`}
            >
              <p className="font-semibold text-gray-900">{item.name}</p>
              {item.category && <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>}
              <p className="text-teal-700 font-bold mt-2 tabular-nums">{fmtMoney(item.price)}</p>
            </button>
          ))}
        </div>
      </section>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-4">
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your selection</p>
            {cart.map((c) => (
              <div key={c.menuItem} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-800 truncate">{c.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded-lg border border-gray-200"
                    onClick={() => changeQty(c.menuItem, -1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-semibold">{c.qty}</span>
                  <button
                    type="button"
                    className="p-1 rounded-lg border border-gray-200"
                    onClick={() => changeQty(c.menuItem, 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="font-semibold text-gray-900">Subtotal</span>
              <span className="font-bold text-teal-700 tabular-nums">{fmtMoney(cartTotal)}</span>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onConfirm}
              className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold text-base shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" /> Sending…
                </>
              ) : (
                <>
                  <Plus size={18} /> Confirm & send to kitchen
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
