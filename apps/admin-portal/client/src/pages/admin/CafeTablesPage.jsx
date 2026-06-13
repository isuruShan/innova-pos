import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Table, QrCode, RefreshCw, X } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { adminPath, getQrOrderWebOrigin } from '@innovapos/app-urls';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';

function orderPageUrlForTable(tenantId, storeId, tableId) {
  const base = getQrOrderWebOrigin();
  if (!base || !tenantId || !storeId || !tableId) return '';
  return `${base}/${encodeURIComponent(tenantId)}/${encodeURIComponent(storeId)}/${encodeURIComponent(tableId)}`;
}

function QrCell({ table, tenantId, storeId }) {
  const url = orderPageUrlForTable(tenantId, storeId, table?._id);
  const src =
    url && `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
  return (
    <div className="flex flex-col items-start gap-1">
      {src ? (
        <div className="bg-white p-1 rounded-lg border border-slate-600/50">
          <img src={src} alt="" width={120} height={120} className="block" loading="lazy" />
        </div>
      ) : (
        <span className="text-xs text-slate-500">
          Set <span className="font-mono">VITE_QR_ORDER_WEB_ORIGIN</span> at POS client build time to your guest order
          app (e.g. https://order.example.com) — QR is never the POS URL.
        </span>
      )}
      {url ? (
        <span className="text-[10px] text-slate-500 max-w-[140px] break-all font-mono">{url}</span>
      ) : null}
    </div>
  );
}

export default function CafeTablesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));
  const { data: paidAddons } = useTenantPaidAddons();
  const qrAddonActive = paidAddons?.qrOrdering === true;

  const [label, setLabel] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [editing, setEditing] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSort, setEditSort] = useState('0');
  const [editActive, setEditActive] = useState(true);
  const [editCapacity, setEditCapacity] = useState(4);
  const [editShape, setEditShape] = useState('rectangle');
  const [error, setError] = useState('');

  const { data: tables = [], isPending } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pos-tables'] });
    qc.invalidateQueries({ queryKey: ['floor-plan'] });
  };


  const createMut = useMutation({
    mutationFn: (payload) => api.post('/tables', payload),
    onSuccess: () => {
      setLabel('');
      setSortOrder('0');
      setError('');
      invalidate();
    },
    onError: (e) => setError(e.response?.data?.message || 'Failed to add table'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/tables/${id}`, payload),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      setError('');
    },
    onError: (e) => setError(e.response?.data?.message || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/tables/${id}`),
    onSuccess: invalidate,
    onError: (e) => setError(e.response?.data?.message || 'Cannot delete'),
  });

  const regenerateQrMut = useMutation({
    mutationFn: (id) => api.post(`/tables/${id}/regenerate-qr`),
    onSuccess: invalidate,
    onError: (e) => setError(e.response?.data?.message || 'Could not regenerate QR'),
  });

  const onCreate = (e) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Label is required');
      return;
    }
    createMut.mutate({ label: label.trim(), sortOrder: Number(sortOrder) || 0 });
  };


  const [qrAddonModal, setQrAddonModal] = useState(false);

  const adminSubscriptionUrl = useMemo(
    () => adminPath('/addons?code=qr_ordering'),
    [],
  );

  const heading = useMemo(
    () => (
      <div>
        <h1 className="text-xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
          <Table className="text-amber-400" size={22} />
          Café tables & QR ordering
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage tables for <strong>{selectedStore?.name || '…'}</strong> — define tables, then print or share QR codes so guests can order from their phones.
        </p>
      </div>
    ),
    [selectedStore?.name],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
      
      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        {heading}

        {!isStoreReady ? (
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
            Select a store in the header first.
          </p>
        ) : (
          <>
            <form onSubmit={onCreate} className="rounded-xl border border-slate-700/60 bg-[var(--pos-panel)] p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-slate-400 mb-1">Table label</label>
                <input
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
                  placeholder="e.g. Table 2"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="w-24">
                <label className="block text-xs text-slate-400 mb-1">Sort</label>
                <input
                  type="number"
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[var(--pos-selection-text)] text-sm font-semibold disabled:opacity-50"
              >
                <Plus size={16} /> Add table
              </button>
            </form>

            {qrAddonActive ? (
              <div className="rounded-xl border border-green-700/40 bg-green-950/25 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-green-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    QR Ordering is Active
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Guests can scan the QR codes below to browse your menu, build a cart, and place orders directly from their phones.
                  </p>
                </div>
                <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/35 shrink-0 select-none text-center">
                  Active
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-teal-700/40 bg-teal-950/25 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-teal-100">QR Ordering is a paid add-on</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Merchants activate it in the admin portal (subscription). Until it is active, guests opening your table
                    QR link will see an error.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrAddonModal(true)}
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-500 shrink-0"
                >
                  What is this? & subscribe
                </button>
              </div>
            )}

            <div className="rounded-xl border border-slate-700/60 bg-[var(--pos-panel)] overflow-hidden">
              {isPending ? (
                <p className="p-6 text-slate-500 text-sm">Loading…</p>
              ) : tables.length === 0 ? (
                <p className="p-6 text-slate-500 text-sm">No tables yet. Add labels above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-slate-800/80 border-b border-slate-700">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold text-slate-400">Label</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-400">Capacity</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-400">Shape</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-400">Sort</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-400">Active</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <QrCode size={14} /> Guest QR
                          </span>
                        </th>
                        <th className="text-right px-4 py-2 font-semibold text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {tables.map((t) => (
                        <tr key={t._id}>
                          <td className="px-4 py-3 font-medium text-[var(--pos-text-primary)]">{t.label}</td>
                          <td className="px-4 py-3 text-slate-400">{t.capacity || 4}</td>
                          <td className="px-4 py-3 text-slate-400 capitalize">{t.shape || 'rectangle'}</td>
                          <td className="px-4 py-3 text-slate-400">{t.sortOrder}</td>
                          <td className="px-4 py-3 text-slate-400">{t.active ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-3 align-top">
                            <QrCell table={t} tenantId={tenantId} storeId={selectedStoreId} />
                          </td>
                          <td className="px-4 py-3 text-right space-x-2 align-top">
                            <button
                              type="button"
                              className="text-amber-400 text-xs font-semibold"
                              onClick={() => {
                                setEditing(t);
                                setEditLabel(t.label || '');
                                setEditSort(String(t.sortOrder ?? 0));
                                setEditActive(t.active !== false);
                                setEditCapacity(t.capacity || 4);
                                setEditShape(t.shape || 'rectangle');
                              }}
                            >
                              <Pencil size={14} className="inline mr-1" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-slate-400 text-xs"
                              title="New QR link (invalidates old printed codes)"
                              disabled={regenerateQrMut.isPending}
                              onClick={() => {
                                if (confirm('Regenerate QR? Old printed codes will stop working.')) {
                                  regenerateQrMut.mutate(t._id);
                                }
                              }}
                            >
                              <RefreshCw size={14} className="inline mr-1" />
                              New QR
                            </button>
                            <button
                              type="button"
                              className="text-red-400 text-xs"
                              onClick={() => {
                                if (confirm(`Remove table “${t.label}”?`)) deleteMut.mutate(t._id);
                              }}
                            >
                              <Trash2 size={14} className="inline mr-1" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {qrAddonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-addon-title"
        >
          <div className="bg-[var(--pos-panel)] rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-700 space-y-4">
            <h3 id="qr-addon-title" className="font-bold text-[var(--pos-text-primary)] text-lg">
              QR Ordering
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Guests scan a QR code at the table to browse your menu, build a cart, and send orders to the kitchen. This is
              billed as an add-on to your subscription (price follows your monthly or yearly billing period). Pay by PayPal
              or bank transfer in the admin portal, then super admin verifies bank receipts.
            </p>
            <p className="text-xs text-amber-200/90">
              Opens the <strong>Add-ons</strong> page in the admin portal in a new tab so you can stay on the POS while you subscribe.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                className="flex-1 py-2.5 border border-slate-600 rounded-xl text-sm text-slate-300"
                onClick={() => setQrAddonModal(false)}
              >
                Close
              </button>
              <a
                href={adminSubscriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[var(--pos-selection-text)] text-sm font-semibold text-center"
                onClick={() => setQrAddonModal(false)}
              >
                Open subscription & pay
              </a>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[var(--pos-panel)] rounded-2xl w-full max-w-sm p-6 shadow-xl border border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[var(--pos-text-primary)]">Edit table</h3>
              <button 
                onClick={() => setEditing(null)} 
                className="text-slate-500 hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <label className="block text-xs text-slate-400">Label</label>
            <input
              className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Shape</label>
                <select
                  className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-panel)] text-[var(--pos-text-primary)] focus:outline-none"
                  value={editShape}
                  onChange={(e) => setEditShape(e.target.value)}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="round">Round</option>
                  <option value="booth">Booth</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
            </div>

            <label className="block text-xs text-slate-400">Sort order</label>
            <input
              type="number"
              className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
              value={editSort}
              onChange={(e) => setEditSort(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--pos-text-primary)]">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              Active
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 py-2 border border-slate-600 rounded-xl text-sm text-slate-300"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded-xl bg-amber-500 text-[var(--pos-selection-text)] text-sm font-semibold"
                onClick={() =>
                  updateMut.mutate({
                    id: editing._id,
                    payload: {
                      label: editLabel.trim(),
                      sortOrder: Number(editSort) || 0,
                      active: editActive,
                      capacity: Number(editCapacity) || 4,
                      shape: editShape,
                    },
                  })
                }
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
