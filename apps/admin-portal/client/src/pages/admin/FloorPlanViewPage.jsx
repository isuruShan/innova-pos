import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Clock, AlertCircle, Utensils, Edit3, List, X, Edit2, QrCode } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { getQrOrderWebOrigin } from '@innovapos/app-urls';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';

const STATUS_STYLES = {
  available: {
    bg: 'bg-green-500/90',
    ring: 'ring-green-400',
    text: 'Available',
  },
  occupied: {
    bg: 'bg-red-500/90',
    ring: 'ring-red-400 animate-pulse',
    text: 'Occupied',
  },
  reserved: {
    bg: 'bg-yellow-500/90',
    ring: 'ring-yellow-400',
    text: 'Reserved',
  },
};

const SHAPE_RADIUS = {
  rectangle: 'rounded-lg',
  round: 'rounded-full',
  booth: 'rounded-tl-3xl rounded-tr-3xl rounded-bl-lg rounded-br-lg',
  bar: 'rounded-full',
};

function TableCard({ table, status, onClick }) {
  const { bg, ring } = STATUS_STYLES[status?.status] || STATUS_STYLES.available;
  const shapeClass = SHAPE_RADIUS[table.shape] || SHAPE_RADIUS.rectangle;

  return (
    <button
      onClick={onClick}
      className={`
        absolute flex flex-col items-center justify-center text-white font-semibold text-sm
        shadow-lg transition-all duration-200 select-none ${bg} ${shapeClass} ring-2 ${ring}
        cursor-pointer hover:scale-[1.03] active:scale-95
      `}
      style={{
        left: `${table.x * 50}px`,
        top: `${table.y * 50}px`,
        width: `${table.width * 50 - 4}px`,
        height: `${table.height * 50 - 4}px`,
        transform: `rotate(${table.rotation || 0}deg)`,
      }}
    >
      <span className="truncate max-w-full px-1">{table.label || 'T'}</span>
      <span className="text-[10px] opacity-80 flex items-center gap-0.5">
        <Users size={10} /> {table.capacity}
      </span>
      {status?.status === 'occupied' && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 pointer-events-none">
          <Clock size={10} className="inline mr-0.5" />
          {status.seatedMinutes}m
        </span>
      )}
      {status?.status === 'reserved' && status.reservationTime && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 pointer-events-none">
          {new Date(status.reservationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </button>
  );
}

function Zone({ zone }) {
  return (
    <div
      className="absolute rounded-xl opacity-20 pointer-events-none border-2 border-dashed border-white/30"
      style={{
        left: `${zone.x * 50}px`,
        top: `${zone.y * 50}px`,
        width: `${zone.width * 50}px`,
        height: `${zone.height * 50}px`,
        backgroundColor: zone.color || '#3b82f6',
      }}
    >
      <span className="absolute top-2 left-3 text-xs font-semibold text-white/90">
        {zone.name}
      </span>
    </div>
  );
}

function TableEditModal({ isOpen, onClose, table, qrOrderEnabled, tenantId, storeId, onSave }) {
  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && table) {
      setLabel(table.label || '');
      setCapacity(table.capacity || 4);
      setError('');
      setSaving(false);
    }
  }, [isOpen, table]);

  const qrUrl = qrOrderEnabled && table?._id 
    ? `${getQrOrderWebOrigin()}/${tenantId}/${storeId}/${table._id}` 
    : null;
  const qrSrc = qrUrl 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}` 
    : null;

  const handleSubmit = async () => {
    if (!label.trim() || label.length > 20) {
      return setError('Table name required (max 20 characters)');
    }
    if (capacity < 1 || capacity > 20) {
      return setError('Capacity must be 1-20');
    }
    setSaving(true);
    try {
      await onSave({ label: label.trim(), capacity });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (window.innerWidth >= 640 && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Edit Table</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-slate-300 transition">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Table Name *</label>
            <input
              type="text"
              maxLength={20}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-gray-400 mt-1">{label.length}/20 characters</p>
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Capacity *</label>
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {qrOrderEnabled && qrSrc ? (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <QrCode size={16} /> QR Code for Guest Ordering
              </p>
              <div className="bg-white p-2 rounded-lg inline-block">
                <img src={qrSrc} alt="QR Code" width={200} height={200} />
              </div>
              <p className="text-xs text-gray-400 mt-2 break-all font-mono">{qrUrl}</p>
            </div>
          ) : (
            <div className="bg-brand-orange/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-brand-orange mb-1.5 flex items-center gap-2">
                <QrCode size={16} /> QR Ordering Not Enabled
              </p>
              <p className="text-xs text-gray-500">
                Enable QR ordering in the admin portal (Subscriptions → Add-ons) to generate QR codes that let guests order directly from their phones.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2.5 rounded-lg transition text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-4 py-2.5 rounded-lg transition text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FloorPlanViewPage() {
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: paidAddons } = useTenantPaidAddons();
  const qrOrderEnabled = paidAddons?.qrOrdering === true;

  const [showTableList, setShowTableList] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch floor plan
  const { data: floorPlan, isLoading } = useQuery({
    queryKey: ['floor-plan', selectedStoreId],
    queryFn: () => api.get('/floor-plan', { headers: { 'x-store-id': selectedStoreId } }).then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch table list for labels
  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables', { headers: { 'x-store-id': selectedStoreId } }).then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch real-time status (polls every 10s)
  const { data: tableStatus = {} } = useQuery({
    queryKey: ['floor-plan-status', selectedStoreId],
    queryFn: () => api.get('/floor-plan/status', { headers: { 'x-store-id': selectedStoreId } }).then((r) => r.data),
    enabled: isStoreReady,
    refetchInterval: 10000,
  });

  // Merge labels
  const planTables = useMemo(() => {
    if (!floorPlan) return [];
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    return floorPlan.tables.map((pt) => ({
      ...pt,
      label: tableMap.get(String(pt.tableId))?.label || pt.label || 'T',
    }));
  }, [floorPlan, tables]);

  // Summary stats
  const stats = useMemo(() => {
    const total = planTables.length;
    let available = 0;
    let occupied = 0;
    let reserved = 0;

    planTables.forEach((t) => {
      const status = tableStatus[String(t.tableId)]?.status;
      if (status === 'occupied') occupied++;
      else if (status === 'reserved') reserved++;
      else available++;
    });

    return { total, available, occupied, reserved };
  }, [planTables, tableStatus]);

  if (!isStoreReady) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md max-w-sm w-full text-center space-y-4">
          <Utensils size={40} className="mx-auto text-brand-orange animate-pulse" />
          <h2 className="text-lg font-bold text-gray-900">Select a Store</h2>
          <p className="text-sm text-gray-500">Please select a store to view the floor plan.</p>
          <select
            value={selectedStoreId || ''}
            onChange={(e) => selectStore(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
          >
            <option value="" disabled>Select Store...</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Utensils size={24} className="text-brand-orange" />
            <h1 className="text-xl font-bold text-gray-900">Floor Plan</h1>
            {stores.length > 0 && (
              <div className="w-56 ml-4">
                <select
                  value={selectedStoreId || ''}
                  onChange={(e) => selectStore(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
                >
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTableList(!showTableList)}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 font-semibold text-sm flex items-center gap-2 transition"
            >
              <List size={18} />
              Tables List
            </button>
            <Link
              to="/floor-plan/editor"
              className="px-4 py-2 rounded-lg bg-brand-orange text-white font-semibold flex items-center gap-2 hover:bg-amber-600"
            >
              <Edit3 size={18} />
              Edit Layout
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <div>
              <p className="text-xs text-gray-500">Total Tables</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-xl font-bold text-green-400">{stats.available}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <div>
              <p className="text-xs text-gray-500">Occupied</p>
              <p className="text-xl font-bold text-red-400">{stats.occupied}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div>
              <p className="text-xs text-gray-500">Reserved</p>
              <p className="text-xl font-bold text-yellow-400">{stats.reserved}</p>
            </div>
          </div>
        </div>

        {/* Floor Plan Canvas */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-auto p-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading floor plan...
            </div>
          ) : floorPlan ? (
            <div
              className="relative"
              style={{
                width: `${floorPlan.gridWidth * 50}px`,
                height: `${floorPlan.gridHeight * 50}px`,
                backgroundColor: '#ffffff',
                backgroundImage:
                  'linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px)',
                backgroundSize: '50px 50px',
              }}
            >
              {/* Zones */}
              {floorPlan.zones?.map((zone) => (
                <Zone key={zone._id || zone.name} zone={zone} />
              ))}

              {/* SVG Lines */}
              <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 4 }}>
                {(floorPlan.lines || []).map((line, idx) => (
                  <line
                    key={`line-${idx}`}
                    x1={line.x1 * 50}
                    y1={line.y1 * 50}
                    x2={line.x2 * 50}
                    y2={line.y2 * 50}
                    stroke={line.color || '#94a3b8'}
                    strokeWidth={line.thickness || 2}
                  />
                ))}
              </svg>

              {/* Text Labels */}
              {(floorPlan.texts || []).map((t, idx) => (
                <div
                  key={`text-${idx}`}
                  className="absolute select-none font-semibold whitespace-nowrap text-center pointer-events-none"
                  style={{
                    left: `${t.x * 50}px`,
                    top: `${t.y * 50}px`,
                    color: (t.color === '#f8fafc' || !t.color || t.color === '#ffffff') ? '#334155' : t.color,
                    fontSize: `${t.fontSize || 14}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 6,
                  }}
                >
                  {t.text}
                </div>
              ))}

              {/* Tables */}
              {planTables.map((table) => (
                <TableCard
                  key={String(table.tableId)}
                  table={table}
                  status={tableStatus[String(table.tableId)]}
                  onClick={() => setEditingTableId(String(table.tableId))}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
              <AlertCircle size={32} className="text-gray-400" />
              <p>No floor plan configured. Go to Floor Plan Editor to set one up.</p>
            </div>
          )}
        </div>
      </div>

      {/* Table List Sidebar */}
      {showTableList && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-2xl z-[60] overflow-y-auto">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <List size={18} />
              All Tables ({tables.length})
            </h3>
            <button 
              onClick={() => setShowTableList(false)} 
              className="text-gray-400 hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {tables.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">No tables created yet.</p>
                <p className="text-slate-600 text-xs mt-1">Add tables from the Café Tables page.</p>
              </div>
            ) : (
              tables.map((table) => {
                const onPlan = floorPlan?.tables?.some(t => String(t.tableId) === String(table._id));
                return (
                  <div
                    key={table._id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-amber-500/50 transition cursor-pointer group"
                    onClick={() => setEditingTableId(table._id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{table.label}</span>
                          {onPlan && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">
                              On Plan
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {table.capacity || 4}
                          </span>
                          <span>•</span>
                          <span className={table.active ? 'text-green-400' : 'text-slate-600'}>
                            {table.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <Edit3 size={14} className="text-gray-400 group-hover:text-brand-orange transition" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Table Edit Modal */}
      <TableEditModal
        isOpen={!!editingTableId}
        onClose={() => setEditingTableId(null)}
        table={tables.find(t => t._id === editingTableId)}
        qrOrderEnabled={qrOrderEnabled}
        tenantId={user?.tenantId}
        storeId={selectedStoreId}
        onSave={async (data) => {
          await api.put(`/tables/${editingTableId}`, data, { headers: { 'x-store-id': selectedStoreId } });
          qc.invalidateQueries({ queryKey: ['pos-tables'] });
          qc.invalidateQueries({ queryKey: ['floor-plan'] });
          setEditingTableId(null);
          setErrorMessage('Table updated successfully');
          setTimeout(() => setErrorMessage(null), 3000);
        }}
      />

      {/* Status Toast */}
      {errorMessage && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md ${
          errorMessage.startsWith('Created') || errorMessage.includes('success')
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
