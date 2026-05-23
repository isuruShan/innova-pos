import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Clock, AlertCircle, Utensils, Edit3 } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

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

function TableCard({ table, status }) {
  const { bg, ring, text } = STATUS_STYLES[status?.status] || STATUS_STYLES.available;
  const shapeClass = SHAPE_RADIUS[table.shape] || SHAPE_RADIUS.rectangle;

  return (
    <div
      className={`
        absolute flex flex-col items-center justify-center text-white font-semibold text-sm
        shadow-lg transition-all duration-200 select-none ${bg} ${shapeClass} ring-2 ${ring}
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
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90">
          <Clock size={10} className="inline mr-0.5" />
          {status.seatedMinutes}m
        </span>
      )}
      {status?.status === 'reserved' && status.reservationTime && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90">
          {new Date(status.reservationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
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

export default function FloorPlanViewPage() {
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));

  // Fetch floor plan
  const { data: floorPlan, isLoading } = useQuery({
    queryKey: ['floor-plan', selectedStoreId],
    queryFn: () => api.get('/floor-plan').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch table list for labels
  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch real-time status (polls every 10s)
  const { data: tableStatus = {} } = useQuery({
    queryKey: ['floor-plan-status', selectedStoreId],
    queryFn: () => api.get('/floor-plan/status').then((r) => r.data),
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
      <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
        <Navbar groups={MANAGER_NAV_GROUPS} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-amber-300">Select a store in the header first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
            <Utensils size={24} className="text-amber-400" />
            Floor Plan
          </h1>
          <Link
            to="/manager/floor-plan/edit"
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold flex items-center gap-2 hover:bg-amber-600"
          >
            <Edit3 size={18} />
            Edit Layout
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Total Tables</p>
              <p className="text-xl font-bold text-[var(--pos-text-primary)]">{stats.total}</p>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <p className="text-xs text-slate-400">Available</p>
              <p className="text-xl font-bold text-green-400">{stats.available}</p>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <div>
              <p className="text-xs text-slate-400">Occupied</p>
              <p className="text-xl font-bold text-red-400">{stats.occupied}</p>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div>
              <p className="text-xs text-slate-400">Reserved</p>
              <p className="text-xl font-bold text-yellow-400">{stats.reserved}</p>
            </div>
          </div>
        </div>

        {/* Floor Plan Canvas */}
        <div className="flex-1 bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Loading floor plan...
            </div>
          ) : floorPlan ? (
            <div
              className="relative mx-auto"
              style={{
                width: `${floorPlan.gridWidth * 50}px`,
                height: `${floorPlan.gridHeight * 50}px`,
                backgroundImage:
                  'linear-gradient(to right, var(--pos-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--pos-grid-line) 1px, transparent 1px)',
                backgroundSize: '50px 50px',
              }}
            >
              {/* Zones */}
              {floorPlan.zones?.map((zone) => (
                <Zone key={zone._id || zone.name} zone={zone} />
              ))}

              {/* Tables */}
              {planTables.map((table) => (
                <TableCard
                  key={String(table.tableId)}
                  table={table}
                  status={tableStatus[String(table.tableId)]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <AlertCircle size={32} className="text-slate-500" />
              <p>No floor plan configured. Go to Floor Plan Editor to set one up.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
