import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Grid3X3, Save, RotateCcw, Plus, Trash2, Square, Circle, 
  Sofa, Wine, ZoomIn, ZoomOut, Move, Users, Layers,
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import Navbar from '../../components/Navbar';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';

const SHAPES = [
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'round', icon: Circle, label: 'Round' },
  { id: 'booth', icon: Sofa, label: 'Booth' },
  { id: 'bar', icon: Wine, label: 'Bar seat' },
];

const SHAPE_COLORS = {
  rectangle: 'bg-amber-500/90',
  round: 'bg-teal-500/90',
  booth: 'bg-purple-500/90',
  bar: 'bg-orange-500/90',
};

const STATUS_COLORS = {
  available: 'ring-2 ring-green-500',
  occupied: 'ring-2 ring-red-500 animate-pulse',
  reserved: 'ring-2 ring-yellow-500',
};

function TableShape({ table, isSelected, onClick, onDragStart, tableStatus, showCapacity, zoom = 1 }) {
  const status = tableStatus?.[String(table.tableId)] || {};
  const statusClass = status.status ? STATUS_COLORS[status.status] || '' : '';
  const cellSize = 50 * zoom;

  return (
    <div
      className={`
        absolute cursor-move flex items-center justify-center text-white font-bold
        transition-all duration-150 select-none
        ${SHAPE_COLORS[table.shape] || SHAPE_COLORS.rectangle}
        ${table.shape === 'round' ? 'rounded-full' : 'rounded-lg'}
        ${isSelected ? 'ring-4 ring-amber-400 z-20' : 'hover:ring-2 hover:ring-white/50'}
        ${statusClass}
      `}
      style={{
        left: `${table.x * cellSize}px`,
        top: `${table.y * cellSize}px`,
        width: `${table.width * cellSize - 4}px`,
        height: `${table.height * cellSize - 4}px`,
        transform: `rotate(${table.rotation || 0}deg)`,
        fontSize: `${Math.max(10, 12 * zoom)}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(table);
      }}
      draggable
      onDragStart={(e) => onDragStart?.(e, table)}
    >
      <div className="flex flex-col items-center">
        <span className="truncate max-w-full px-1">{table.label || 'T'}</span>
        {showCapacity && (
          <span style={{ fontSize: `${Math.max(8, 10 * zoom)}px` }} className="opacity-75 flex items-center gap-0.5">
            <Users size={Math.max(8, 10 * zoom)} /> {table.capacity}
          </span>
        )}
      </div>
      {status.status === 'occupied' && status.seatedMinutes && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-red-600 px-1 rounded" style={{ fontSize: `${Math.max(8, 10 * zoom)}px` }}>
          {status.seatedMinutes}m
        </div>
      )}
    </div>
  );
}

function Zone({ zone, zoom = 1 }) {
  const cellSize = 50 * zoom;
  return (
    <div
      className="absolute rounded-lg opacity-30 pointer-events-none"
      style={{
        left: `${zone.x * cellSize}px`,
        top: `${zone.y * cellSize}px`,
        width: `${zone.width * cellSize}px`,
        height: `${zone.height * cellSize}px`,
        backgroundColor: zone.color || '#3b82f6',
      }}
    >
      <span className="absolute top-1 left-2 font-medium text-white/80" style={{ fontSize: `${Math.max(10, 12 * zoom)}px` }}>
        {zone.name}
      </span>
    </div>
  );
}

export default function FloorPlanEditorPage() {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));
  const canvasRef = useRef(null);

  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showCapacity, setShowCapacity] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [localPlan, setLocalPlan] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [nextTableNumber, setNextTableNumber] = useState(1);

  // Fetch floor plan
  const { data: floorPlan, isLoading } = useQuery({
    queryKey: ['floor-plan', selectedStoreId],
    queryFn: () => api.get('/floor-plan').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch tables for list
  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady,
  });

  // Fetch real-time status
  const { data: tableStatus = {} } = useQuery({
    queryKey: ['floor-plan-status', selectedStoreId],
    queryFn: () => api.get('/floor-plan/status').then((r) => r.data),
    enabled: isStoreReady,
    refetchInterval: 10000,
  });

  // Initialize local plan when data loads
  useEffect(() => {
    if (floorPlan && !localPlan) {
      // Ensure tables array exists
      setLocalPlan({
        ...floorPlan,
        tables: floorPlan.tables || [],
        zones: floorPlan.zones || [],
      });
    }
  }, [floorPlan, localPlan]);

  // Create default plan structure if none exists after loading
  useEffect(() => {
    if (!isLoading && !floorPlan && isStoreReady && !localPlan) {
      // Create a temporary local plan while the API creates one
      setLocalPlan({
        name: 'Main Floor',
        gridWidth: 20,
        gridHeight: 15,
        tables: [],
        zones: [],
      });
    }
  }, [isLoading, floorPlan, isStoreReady, localPlan]);

  // Update next table number based on existing tables
  useEffect(() => {
    if (tables.length > 0) {
      const maxNum = tables.reduce((max, t) => {
        const match = t.label?.match(/Table\s*(\d+)/i);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);
      setNextTableNumber(maxNum + 1);
    }
  }, [tables]);

  const plan = localPlan || floorPlan;
  const [errorMessage, setErrorMessage] = useState(null);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/floor-plan', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-plan'] });
      setIsDirty(false);
      setErrorMessage(null);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to save floor plan';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Sync tables mutation
  const syncMutation = useMutation({
    mutationFn: () => api.post('/floor-plan/sync-tables'),
    onSuccess: (data) => {
      setLocalPlan(data.data?.plan || data.plan);
      qc.invalidateQueries({ queryKey: ['floor-plan'] });
      setErrorMessage(null);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to sync tables';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Create new table mutation
  const createTableMutation = useMutation({
    mutationFn: (tableData) => api.post('/tables', tableData),
    onSuccess: (response, variables) => {
      const newTable = response.data;
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      
      // Add the newly created table to the floor plan
      if (localPlan && variables._tempPosition) {
        const newTablePos = {
          tableId: newTable._id,
          label: newTable.label,
          x: variables._tempPosition.x,
          y: variables._tempPosition.y,
          width: 2,
          height: 2,
          shape: selectedShape,
          rotation: 0,
          capacity: newTable.capacity || 4,
        };
        
        setLocalPlan({
          ...localPlan,
          tables: [...(localPlan.tables || []), newTablePos],
        });
        setIsDirty(true);
      }
      setNextTableNumber((n) => n + 1);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to create table';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleSave = useCallback(() => {
    if (!localPlan) return;
    saveMutation.mutate({
      name: localPlan.name,
      gridWidth: localPlan.gridWidth,
      gridHeight: localPlan.gridHeight,
      tables: localPlan.tables,
      zones: localPlan.zones,
    });
  }, [localPlan, saveMutation]);

  const handleTableDragStart = useCallback((e, table) => {
    e.dataTransfer.setData('tableId', String(table.tableId));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleCanvasDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      const tableId = e.dataTransfer.getData('tableId');
      const newTableId = e.dataTransfer.getData('newTableId');

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        console.warn('Floor plan drop failed: missing canvas rect');
        setErrorMessage('Drop failed: Canvas not ready');
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }
      
      if (!localPlan) {
        console.warn('Floor plan drop failed: no local plan');
        setErrorMessage('Drop failed: Floor plan not loaded');
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      // Ensure tables array exists
      const currentTables = localPlan.tables || [];

      // Cell size in pixels (accounting for zoom)
      const cellSize = 50 * zoom;
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);

      console.log('Drop event:', { newTableId, tableId, x, y, zoom, cellSize });

      if (newTableId) {
        // Adding a new table from sidebar
        const table = tables.find((t) => String(t._id) === newTableId);
        if (!table) {
          console.warn('Table not found:', newTableId);
          return;
        }

        // Check if already on plan
        const exists = currentTables.some((t) => String(t.tableId) === newTableId);
        if (exists) {
          console.warn('Table already on floor plan:', newTableId);
          return;
        }

        const newTablePos = {
          tableId: table._id,
          label: table.label,
          x: Math.max(0, Math.min(x, (localPlan.gridWidth || 20) - 2)),
          y: Math.max(0, Math.min(y, (localPlan.gridHeight || 15) - 2)),
          width: 2,
          height: 2,
          shape: selectedShape,
          rotation: 0,
          capacity: table.capacity || 4,
        };

        console.log('Adding table to floor plan:', newTablePos);

        setLocalPlan({
          ...localPlan,
          tables: [...currentTables, newTablePos],
        });
        setIsDirty(true);
      } else if (tableId) {
        // Moving existing table
        const updatedTables = currentTables.map((t) => {
          if (String(t.tableId) === tableId) {
            return {
              ...t,
              x: Math.max(0, Math.min(x, (localPlan.gridWidth || 20) - t.width)),
              y: Math.max(0, Math.min(y, (localPlan.gridHeight || 15) - t.height)),
            };
          }
          return t;
        });

        setLocalPlan({ ...localPlan, tables: updatedTables });
        setIsDirty(true);
      }
    },
    [localPlan, tables, zoom, selectedShape]
  );

  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleCanvasDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the canvas (not a child element)
    if (!canvasRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  // Handle canvas click - create new table when in add mode
  const handleCanvasClick = useCallback((e) => {
    // If clicking on canvas background (not on a table), handle based on mode
    if (isAddMode && localPlan) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cellSize = 50 * zoom;
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);

      // Clamp to grid bounds
      const gridX = Math.max(0, Math.min(x, (localPlan.gridWidth || 20) - 2));
      const gridY = Math.max(0, Math.min(y, (localPlan.gridHeight || 15) - 2));

      // Create a new table in the database and add to floor plan
      createTableMutation.mutate({
        label: `Table ${nextTableNumber}`,
        capacity: 4,
        sortOrder: tables.length,
        _tempPosition: { x: gridX, y: gridY }, // Used in onSuccess to place on plan
      });
    } else {
      // Deselect table when clicking on empty space
      setSelectedTable(null);
    }
  }, [isAddMode, localPlan, zoom, nextTableNumber, tables.length, createTableMutation]);

  const handleTableSelect = useCallback((table) => {
    setSelectedTable(table);
  }, []);

  const handleRotateSelected = useCallback(() => {
    if (!selectedTable || !localPlan) return;
    const updatedTables = localPlan.tables.map((t) => {
      if (String(t.tableId) === String(selectedTable.tableId)) {
        return { ...t, rotation: ((t.rotation || 0) + 90) % 360 };
      }
      return t;
    });
    setLocalPlan({ ...localPlan, tables: updatedTables });
    setSelectedTable({ ...selectedTable, rotation: ((selectedTable.rotation || 0) + 90) % 360 });
    setIsDirty(true);
  }, [selectedTable, localPlan]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedTable || !localPlan) return;
    const updatedTables = localPlan.tables.filter(
      (t) => String(t.tableId) !== String(selectedTable.tableId)
    );
    setLocalPlan({ ...localPlan, tables: updatedTables });
    setSelectedTable(null);
    setIsDirty(true);
  }, [selectedTable, localPlan]);

  const handleUpdateSelectedProperty = useCallback(
    (prop, value) => {
      if (!selectedTable || !localPlan) return;
      const updatedTables = localPlan.tables.map((t) => {
        if (String(t.tableId) === String(selectedTable.tableId)) {
          return { ...t, [prop]: value };
        }
        return t;
      });
      setLocalPlan({ ...localPlan, tables: updatedTables });
      setSelectedTable({ ...selectedTable, [prop]: value });
      setIsDirty(true);
    },
    [selectedTable, localPlan]
  );

  // Tables not yet on the floor plan
  const unplacedTables = useMemo(() => {
    if (!plan) return tables;
    const planTables = plan.tables || [];
    const placedIds = new Set(planTables.map((t) => String(t.tableId)));
    return tables.filter((t) => !placedIds.has(String(t._id)));
  }, [tables, plan]);

  // Merge table labels into plan tables
  const planTablesWithLabels = useMemo(() => {
    if (!plan) return [];
    const planTables = plan.tables || [];
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    return planTables.map((pt) => ({
      ...pt,
      label: tableMap.get(String(pt.tableId))?.label || pt.label || 'T',
    }));
  }, [plan, tables]);

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

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Toolbar */}
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Shape:</span>
              {SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => setSelectedShape(shape.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedShape === shape.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  title={shape.label}
                >
                  <shape.icon size={16} />
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-slate-400 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-colors ${
                showGrid ? 'bg-amber-500/30 text-amber-400' : 'bg-slate-700 text-slate-300'
              }`}
              title="Toggle grid"
            >
              <Grid3X3 size={16} />
            </button>

            <button
              onClick={() => setShowCapacity(!showCapacity)}
              className={`p-2 rounded-lg transition-colors ${
                showCapacity ? 'bg-amber-500/30 text-amber-400' : 'bg-slate-700 text-slate-300'
              }`}
              title="Show capacity"
            >
              <Users size={16} />
            </button>

            <div className="h-6 w-px bg-slate-700" />

            {/* Add Mode Toggle */}
            <button
              onClick={() => setIsAddMode(!isAddMode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                isAddMode
                  ? 'bg-green-500 text-white ring-2 ring-green-400'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title={isAddMode ? 'Exit add mode' : 'Click to add tables'}
            >
              <Plus size={16} />
              {isAddMode ? 'Adding...' : 'Add Mode'}
            </button>

            <div className="flex-1" />

            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm flex items-center gap-2"
            >
              <Layers size={14} />
              Sync Tables
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl overflow-auto min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                Loading floor plan...
              </div>
            ) : plan ? (
              <div
                ref={canvasRef}
                className={`relative transition-all ${isDragOver ? 'ring-2 ring-amber-400 ring-inset bg-amber-500/5' : ''} ${isAddMode ? 'cursor-crosshair' : ''}`}
                style={{
                  width: `${(plan.gridWidth || 20) * 50 * zoom}px`,
                  height: `${(plan.gridHeight || 15) * 50 * zoom}px`,
                  minWidth: '600px',
                  minHeight: '400px',
                  backgroundImage: showGrid
                    ? 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)'
                    : 'none',
                  backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                onDragEnter={handleCanvasDragEnter}
                onDragLeave={handleCanvasDragLeave}
                onClick={handleCanvasClick}
              >
                {/* Zones */}
                {plan.zones?.map((zone) => (
                  <Zone key={zone._id || zone.name} zone={zone} zoom={zoom} />
                ))}

                {/* Empty state helper */}
                {planTablesWithLabels.length === 0 && !isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-slate-500">
                      {isAddMode ? (
                        <>
                          <Plus size={48} className="mx-auto mb-2 opacity-50 text-amber-400" />
                          <p className="text-sm text-amber-400">Click anywhere to add a table</p>
                          <p className="text-xs">Tables will be created as "Table {nextTableNumber}"</p>
                        </>
                      ) : (
                        <>
                          <Move size={48} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Click "Add Mode" in the toolbar to create tables</p>
                          <p className="text-xs">or drag existing tables from the sidebar</p>
                        </>
                      )}
                    </div>
                  </div>
                )}


                {/* Tables */}
                {planTablesWithLabels.map((table) => (
                  <TableShape
                    key={String(table.tableId)}
                    table={table}
                    isSelected={String(selectedTable?.tableId) === String(table.tableId)}
                    onClick={handleTableSelect}
                    onDragStart={handleTableDragStart}
                    tableStatus={tableStatus}
                    showCapacity={showCapacity}
                    zoom={zoom}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No floor plan found
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          {/* Selected Table Properties */}
          {selectedTable && (
            <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-[var(--pos-text-primary)] flex items-center justify-between">
                Table Properties
                <button
                  onClick={handleDeleteSelected}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  title="Remove from floor"
                >
                  <Trash2 size={14} />
                </button>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Shape</label>
                  <div className="flex gap-2 mt-1">
                    {SHAPES.map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => handleUpdateSelectedProperty('shape', shape.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          selectedTable.shape === shape.id
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        <shape.icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Width</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={selectedTable.width}
                      onChange={(e) => handleUpdateSelectedProperty('width', Number(e.target.value))}
                      className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Height</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={selectedTable.height}
                      onChange={(e) => handleUpdateSelectedProperty('height', Number(e.target.value))}
                      className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedTable.capacity}
                    onChange={(e) => handleUpdateSelectedProperty('capacity', Number(e.target.value))}
                    className="w-full mt-1 border border-slate-600 rounded-lg px-3 py-2 text-sm bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)]"
                  />
                </div>

                <button
                  onClick={handleRotateSelected}
                  className="w-full py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} />
                  Rotate 90°
                </button>
              </div>
            </div>
          )}

          {/* Unplaced Tables */}
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h3 className="font-semibold text-[var(--pos-text-primary)] mb-3 flex items-center gap-2">
              <Plus size={16} className="text-amber-400" />
              Add Tables
            </h3>
            {unplacedTables.length === 0 ? (
              <p className="text-xs text-slate-500">All tables are on the floor plan.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unplacedTables.map((table) => (
                  <div
                    key={table._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('newTableId', String(table._id));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/50 cursor-grab hover:bg-slate-700 active:cursor-grabbing"
                  >
                    <Move size={14} className="text-slate-500" />
                    <span className="text-sm text-[var(--pos-text-primary)]">{table.label}</span>
                    <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                      <Users size={12} /> {table.capacity || 4}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4">
            <h3 className="font-semibold text-[var(--pos-text-primary)] mb-3">Status Legend</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded ring-2 ring-green-500" />
                <span className="text-slate-400">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded ring-2 ring-red-500" />
                <span className="text-slate-400">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded ring-2 ring-yellow-500" />
                <span className="text-slate-400">Reserved</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {errorMessage && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
