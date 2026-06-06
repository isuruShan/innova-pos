import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, AlertCircle, Utensils, List, X, Play, Save, ChevronRight, UserPlus } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useFohrMode } from '../../hooks/useFohrMode';
import { useCashierDraftOrders } from '../../context/CashierDraftOrdersContext';
import Navbar from '../../components/Navbar';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';

const STATUS_STYLES = {
  available: {
    bg: 'bg-green-500/90 hover:bg-green-500',
    ring: 'ring-green-400',
    text: 'Available',
    colorText: 'text-green-400',
  },
  occupied: {
    bg: 'bg-red-500/90 hover:bg-red-500',
    ring: 'ring-red-400 animate-pulse',
    text: 'Occupied',
    colorText: 'text-red-400',
  },
  reserved: {
    bg: 'bg-yellow-500/90 hover:bg-yellow-500',
    ring: 'ring-yellow-400',
    text: 'Reserved',
    colorText: 'text-yellow-400',
  },
};

const SHAPE_RADIUS = {
  rectangle: 'rounded-lg',
  round: 'rounded-full',
  booth: 'rounded-tl-3xl rounded-tr-3xl rounded-bl-lg rounded-br-lg',
  bar: 'rounded-full',
};

export default function TablesView() {
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));
  const tableMgmt = selectedStore?.tableManagementEnabled === true;
  
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fohr = useFohrMode();
  const { user } = useAuth();
  const { addDraftWithTable } = useCashierDraftOrders(selectedStoreId);

  // View state: 'floor' (floor plan) or 'grid' (tables grid)
  const [viewType, setViewType] = useState('floor');
  const [selectedTableId, setSelectedTableId] = useState(null);
  
  // Local guest count state for updating order or starting order
  const [localGuestsCount, setLocalGuestsCount] = useState(2);
  const [savingGuests, setSavingGuests] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Slideover order details state
  const [activeSlideOverOrder, setActiveSlideOverOrder] = useState(null);

  // Fetch tables
  const { data: tables = [], isLoading: loadingTables } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
  });

  // Fetch floor plan
  const { data: floorPlan, isLoading: loadingPlan } = useQuery({
    queryKey: ['floor-plan', selectedStoreId],
    queryFn: () => api.get('/floor-plan').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
  });

  // Fetch real-time statuses (polls every 10s)
  const { data: tableStatus = {}, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['floor-plan-status', selectedStoreId],
    queryFn: () => api.get('/floor-plan/status').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
    refetchInterval: 10000,
  });

  // Set default view type based on whether a floor plan is configured
  useEffect(() => {
    if (floorPlan) {
      setViewType('floor');
    } else {
      setViewType('grid');
    }
  }, [floorPlan]);

  // Merge table names/labels from CafeTable with floorPlan details
  const planTables = useMemo(() => {
    if (!floorPlan) return [];
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    return (floorPlan.tables || []).map((pt) => ({
      ...pt,
      label: tableMap.get(String(pt.tableId))?.label || pt.label || 'T',
      active: tableMap.get(String(pt.tableId))?.active !== false,
    })).filter(t => t.active); // Only show active tables
  }, [floorPlan, tables]);

  const activeTablesList = useMemo(() => {
    return tables.filter((t) => t.active !== false);
  }, [tables]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const list = floorPlan ? planTables : activeTablesList;
    const total = list.length;
    let available = 0;
    let occupied = 0;
    let reserved = 0;

    list.forEach((t) => {
      const id = floorPlan ? String(t.tableId) : String(t._id);
      const status = tableStatus[id]?.status;
      if (status === 'occupied') occupied++;
      else if (status === 'reserved') reserved++;
      else available++;
    });

    return { total, available, occupied, reserved };
  }, [planTables, activeTablesList, tableStatus, floorPlan]);

  // Currently selected table details
  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null;
    return tables.find((t) => String(t._id) === String(selectedTableId));
  }, [selectedTableId, tables]);

  const selectedTableStatus = useMemo(() => {
    if (!selectedTableId) return null;
    return tableStatus[String(selectedTableId)] || { status: 'available' };
  }, [selectedTableId, tableStatus]);

  // Update guest count state when table selection changes
  useEffect(() => {
    if (selectedTableStatus) {
      if (selectedTableStatus.status === 'occupied') {
        setLocalGuestsCount(selectedTableStatus.guestsCount || 2);
      } else {
        setLocalGuestsCount(selectedTable?.capacity || 2);
      }
      setSuccessMessage('');
    }
  }, [selectedTableId, selectedTableStatus, selectedTable]);

  // Start dine-in order
  const handleStartOrder = (tableId, tableLabel, guests) => {
    addDraftWithTable(tableId, tableLabel, guests);
    navigate(fohr.newOrderPath);
  };

  // Save guest count for an active occupied order
  const handleSaveGuestsCount = async () => {
    if (!selectedTableStatus?.orderId) return;
    setSavingGuests(true);
    try {
      await api.put(`/orders/${selectedTableStatus.orderId}`, {
        guestsCount: localGuestsCount,
      });
      setSuccessMessage('Guests count updated!');
      refetchStatus();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update guests count');
    } finally {
      setSavingGuests(false);
    }
  };

  // Open the slide-over details to view/edit full order
  const handleOpenOrder = async (orderId) => {
    setLoadingOrder(true);
    try {
      const res = await api.get(`/orders/${orderId}`);
      setActiveSlideOverOrder(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load order details');
    } finally {
      setLoadingOrder(false);
    }
  };

  if (!isStoreReady || loadingTables || loadingStatus || (loadingPlan && viewType === 'floor')) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
        <Navbar groups={fohr.navGroups} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 animate-pulse">Loading tables dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tableMgmt) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--pos-page-bg)]">
        <Navbar groups={fohr.navGroups} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
            <Utensils size={32} />
          </div>
          <h2 className="text-lg font-bold text-[var(--pos-text-primary)]">Table Management Disabled</h2>
          <p className="text-sm text-slate-400 mt-2">
            Table management is not enabled for this store. You can enable it in the back-office Settings.
          </p>
          {(user?.role === 'manager' || user?.role === 'merchant_admin') && (
            <button
              onClick={() => navigate('/manager/cafe-tables')}
              className="mt-6 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition"
            >
              Configure Café Tables
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--pos-page-bg)] text-[var(--pos-text-primary)] select-none overflow-hidden">
      <Navbar groups={fohr.navGroups} />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 lg:border-r lg:border-slate-800 min-h-0">
          
          {/* Header & View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Utensils size={20} className="text-amber-500" />
                Tables Overview
              </h1>
              <p className="text-xs text-slate-500">Real-time table status and dining operations</p>
            </div>
            
            <div className="flex items-center gap-2">
              {floorPlan && (
                <div className="bg-[var(--pos-surface-inset)] border border-slate-700/60 p-0.5 rounded-xl flex">
                  <button
                    onClick={() => setViewType('floor')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      viewType === 'floor'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Floor Plan
                  </button>
                  <button
                    onClick={() => setViewType('grid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      viewType === 'grid'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Grid View
                  </button>
                </div>
              )}
              <button
                onClick={() => refetchStatus()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2 bg-[var(--pos-panel)] border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex flex-col items-center justify-center border-r border-slate-800 last:border-r-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Total</span>
              <span className="text-lg font-extrabold mt-0.5">{stats.total}</span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-slate-800 last:border-r-0">
              <span className="text-[10px] text-green-500 uppercase tracking-wider font-medium">Available</span>
              <span className="text-lg font-extrabold text-green-400 mt-0.5">{stats.available}</span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-slate-800 last:border-r-0">
              <span className="text-[10px] text-red-500 uppercase tracking-wider font-medium">Occupied</span>
              <span className="text-lg font-extrabold text-red-400 mt-0.5">{stats.occupied}</span>
            </div>
            <div className="flex flex-col items-center justify-center last:border-r-0">
              <span className="text-[10px] text-yellow-500 uppercase tracking-wider font-medium">Reserved</span>
              <span className="text-lg font-extrabold text-yellow-400 mt-0.5">{stats.reserved}</span>
            </div>
          </div>

          {/* Canvas or Grid container */}
          <div className="flex-1 bg-[var(--pos-panel)] border border-slate-800/85 rounded-2xl overflow-auto p-4 relative min-h-0">
            {viewType === 'floor' && floorPlan ? (
              /* Floor Plan rendering */
              <div
                className="relative"
                style={{
                  width: `${floorPlan.gridWidth * 50}px`,
                  height: `${floorPlan.gridHeight * 50}px`,
                  backgroundImage:
                    'linear-gradient(to right, var(--pos-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--pos-grid-line) 1px, transparent 1px)',
                  backgroundSize: '50px 50px',
                }}
              >
                {/* Render Zones */}
                {floorPlan.zones?.map((zone) => (
                  <div
                    key={zone._id || zone.name}
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
                      color: t.color || '#f8fafc',
                      fontSize: `${t.fontSize || 14}px`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 6,
                    }}
                  >
                    {t.text}
                  </div>
                ))}

                {/* Render Tables */}
                {planTables.map((table) => {
                  const id = String(table.tableId);
                  const status = tableStatus[id]?.status || 'available';
                  const isSelected = selectedTableId === id;
                  const { bg, ring } = STATUS_STYLES[status] || STATUS_STYLES.available;
                  const shapeClass = SHAPE_RADIUS[table.shape] || SHAPE_RADIUS.rectangle;

                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedTableId(id)}
                      className={`
                        absolute flex flex-col items-center justify-center text-white font-semibold text-sm
                        shadow-lg transition-all duration-200 select-none ${bg} ${shapeClass} ring-2 ${ring}
                        ${isSelected ? 'ring-offset-2 ring-offset-slate-900 scale-105 z-10' : ''}
                      `}
                      style={{
                        left: `${table.x * 50}px`,
                        top: `${table.y * 50}px`,
                        width: `${table.width * 50 - 4}px`,
                        height: `${table.height * 50 - 4}px`,
                        transform: `rotate(${table.rotation || 0}deg)`,
                      }}
                    >
                      <span className="truncate max-w-full px-1">{table.label}</span>
                      <span className="text-[10px] opacity-80 flex items-center gap-0.5 mt-0.5">
                        <Users size={10} /> 
                        {tableStatus[id]?.guestsCount != null 
                          ? `${tableStatus[id].guestsCount}/${table.capacity}`
                          : table.capacity
                        }
                      </span>
                      {status === 'occupied' && (
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700">
                          <Clock size={8} className="inline mr-0.5" />
                          {tableStatus[id].seatedMinutes}m
                        </span>
                      )}
                      {status === 'reserved' && tableStatus[id].reservationTime && (
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700">
                          {new Date(tableStatus[id].reservationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Grid View Fallback */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {activeTablesList.map((table) => {
                  const id = String(table._id);
                  const occupancy = tableStatus[id];
                  const status = occupancy?.status || 'available';
                  const isSelected = selectedTableId === id;
                  const { text: statusText, colorText } = STATUS_STYLES[status] || STATUS_STYLES.available;

                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedTableId(id)}
                      className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-800 bg-[var(--pos-surface-inset)] hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="text-base font-bold">{table.label}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${colorText}`}>
                          {statusText}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {occupancy?.guestsCount != null 
                            ? `${occupancy.guestsCount}/${table.capacity}`
                            : `Max ${table.capacity}`
                          }
                        </span>
                      </div>

                      {status === 'occupied' && (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500">
                          <Clock size={10} />
                          <span>Seated {occupancy.seatedMinutes}m ago</span>
                        </div>
                      )}

                      {status === 'reserved' && occupancy.reservationTime && (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-yellow-500/90 font-medium">
                          <span>Res: {new Date(occupancy.reservationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Action Panel */}
        {selectedTableId && (
          <div className="w-full lg:w-80 bg-[var(--pos-panel)] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[var(--pos-panel)]">
              <h3 className="font-bold text-sm flex items-center gap-2">
                Details Panel
              </h3>
              <button
                onClick={() => setSelectedTableId(null)}
                className="text-slate-500 hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {selectedTable && (
                <div className="space-y-4">
                  {/* Table general info */}
                  <div>
                    <h2 className="text-xl font-bold">{selectedTable.label}</h2>
                    <p className="text-xs text-slate-500 mt-1">Capacity: {selectedTable.capacity} guests</p>
                  </div>

                  {/* Status Section */}
                  <div className="p-3 bg-[var(--pos-surface-inset)] border border-slate-800 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Current Status</p>
                    
                    {selectedTableStatus.status === 'occupied' && (
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-sm font-bold text-red-400">Occupied</span>
                        </div>
                        
                        <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800">
                          <div className="flex justify-between">
                            <span>Order ID:</span>
                            <span className="font-mono text-slate-200 font-bold">#{String(selectedTableStatus.orderNumber).padStart(3, '0')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span className="capitalize text-slate-200 font-semibold">{selectedTableStatus.orderStatus}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Seated Time:</span>
                            <span className="text-slate-200">{selectedTableStatus.seatedMinutes} mins ago</span>
                          </div>
                        </div>

                        {/* Guest Count Setter for active occupied table */}
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <label className="text-xs font-semibold text-slate-400 block">Guests Seated</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={localGuestsCount <= 1}
                              onClick={() => setLocalGuestsCount(p => Math.max(1, p - 1))}
                              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-50"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={localGuestsCount}
                              onChange={(e) => setLocalGuestsCount(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-14 bg-slate-900 border border-slate-700 text-center text-sm font-semibold rounded-lg py-1 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={localGuestsCount >= 20}
                              onClick={() => setLocalGuestsCount(p => Math.min(20, p + 1))}
                              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              disabled={savingGuests || localGuestsCount === selectedTableStatus.guestsCount}
                              onClick={handleSaveGuestsCount}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5"
                            >
                              <Save size={12} />
                              {savingGuests ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                          {successMessage && (
                            <p className="text-[10px] text-green-400 text-center font-medium mt-1 animate-fade-in">{successMessage}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTableStatus.status === 'reserved' && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                          <span className="text-sm font-bold text-yellow-400">Reserved</span>
                        </div>
                        
                        <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800">
                          <p className="font-semibold text-slate-200">{selectedTableStatus.guestName || 'Guest'}</p>
                          <p>{selectedTableStatus.partySize || selectedTable.capacity} guests</p>
                          <p className="text-yellow-400/90 font-medium mt-1">
                            Reservation Time: {new Date(selectedTableStatus.reservationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedTableStatus.status === 'available' && (
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="text-sm font-bold text-green-400">Available</span>
                        </div>
                        
                        {/* Guest Picker for starting a new order */}
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <label className="text-xs font-semibold text-slate-400 block">Number of Guests</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={localGuestsCount <= 1}
                              onClick={() => setLocalGuestsCount(p => Math.max(1, p - 1))}
                              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-50"
                            >
                              -
                            </button>
                            <span className="w-12 text-center text-sm font-semibold">{localGuestsCount}</span>
                            <button
                              type="button"
                              disabled={localGuestsCount >= 20}
                              onClick={() => setLocalGuestsCount(p => Math.min(20, p + 1))}
                              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Operations Buttons */}
                  <div className="space-y-2 pt-2">
                    {selectedTableStatus.status === 'occupied' ? (
                      <button
                        onClick={() => handleOpenOrder(selectedTableStatus.orderId)}
                        disabled={loadingOrder}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                      >
                        {loadingOrder ? (
                          <span>Loading...</span>
                        ) : (
                          <>
                            <span>View / Edit Order</span>
                            <ChevronRight size={16} />
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartOrder(selectedTable._id, selectedTable.label, localGuestsCount)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
                      >
                        <UserPlus size={16} />
                        <span>Start Dine-In Order</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Order details Slide-Over */}
      {activeSlideOverOrder && (
        <OrderDetailSlideOver
          order={activeSlideOverOrder}
          onClose={() => {
            setActiveSlideOverOrder(null);
            refetchStatus();
          }}
        />
      )}
    </div>
  );
}
