import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Grid3X3, Save, RotateCcw, Plus, Trash2, Square, Circle, 
  Sofa, Wine, ZoomIn, ZoomOut, Move, Users, Layers, List, X, QrCode, Edit2,
  Slash, Type, Map,
} from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import { Link, useNavigate } from 'react-router-dom';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { getQrOrderWebOrigin } from '@innovapos/app-urls';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';

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

function TableShape({ table, isSelected, onClick, onDragStart, onDragEnd, tableStatus, showCapacity, zoom = 1 }) {
  const status = tableStatus?.[String(table.tableId)] || {};
  const statusClass = status.status ? STATUS_COLORS[status.status] || '' : '';
  const cellSize = 50 * zoom;
  const capacity = table.capacity || 4;

  // Calculate chair positions around the table
  const getChairPositions = () => {
    const chairs = [];
    const width = table.width * cellSize - 4;
    const height = table.height * cellSize - 4;
    const chairSize = Math.max(8, 12 * zoom);
    
    if (table.shape === 'round') {
      // Circular arrangement for round tables
      const radius = (Math.max(width, height) / 2) + chairSize;
      for (let i = 0; i < capacity; i++) {
        const angle = (i * 2 * Math.PI) / capacity - Math.PI / 2;
        chairs.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      }
    } else if (table.shape === 'bar') {
      // Single side for bar seating
      const spacing = width / (capacity + 1);
      for (let i = 0; i < capacity; i++) {
        chairs.push({
          x: spacing * (i + 1) - width / 2,
          y: height / 2 + chairSize + 4,
        });
      }
    } else {
      // Rectangle/booth - distribute around perimeter
      const perimeter = 2 * (width + height);
      const spacing = perimeter / capacity;
      
      for (let i = 0; i < capacity; i++) {
        const distance = i * spacing;
        let x, y;
        
        if (distance < width) {
          // Top edge
          x = distance - width / 2;
          y = -height / 2 - chairSize - 4;
        } else if (distance < width + height) {
          // Right edge
          x = width / 2 + chairSize + 4;
          y = (distance - width) - height / 2;
        } else if (distance < 2 * width + height) {
          // Bottom edge
          x = width - (distance - width - height) - width / 2;
          y = height / 2 + chairSize + 4;
        } else {
          // Left edge
          x = -width / 2 - chairSize - 4;
          y = height - (distance - 2 * width - height) - height / 2;
        }
        
        chairs.push({ x, y });
      }
    }
    
    return chairs;
  };

  const chairPositions = showCapacity ? getChairPositions() : [];

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
        onClick?.(table, e);
      }}
      draggable
      onDragStart={(e) => onDragStart?.(e, table)}
      onDragEnd={onDragEnd}
    >
      {/* Chair indicators */}
      {chairPositions.map((pos, idx) => (
        <div
          key={idx}
          className="absolute bg-slate-600 rounded-sm"
          style={{
            width: `${Math.max(8, 12 * zoom)}px`,
            height: `${Math.max(6, 10 * zoom)}px`,
            left: `calc(50% + ${pos.x}px)`,
            top: `calc(50% + ${pos.y}px)`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      
      <div className="flex flex-col items-center relative z-10">
        <span className="truncate max-w-full px-1">{table.label || 'T'}</span>
        <span style={{ fontSize: `${Math.max(7, 9 * zoom)}px` }} className="opacity-60 capitalize">
          {table.shape === 'bar' ? 'Bar' : table.shape === 'booth' ? 'Booth' : table.shape === 'round' ? 'Round' : 'Table'}
        </span>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--pos-panel)] rounded-2xl border border-slate-700 max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[var(--pos-text-primary)]">Edit Table</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1.5">Table Name *</label>
            <input
              type="text"
              maxLength={20}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-slate-500 mt-1">{label.length}/20 characters</p>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1.5">Capacity *</label>
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {qrOrderEnabled && qrSrc ? (
            <div className="border border-slate-700 rounded-lg p-4 bg-[var(--pos-surface-inset)]">
              <p className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <QrCode size={16} /> QR Code for Guest Ordering
              </p>
              <div className="bg-white p-2 rounded-lg inline-block">
                <img src={qrSrc} alt="QR Code" width={200} height={200} />
              </div>
              <p className="text-xs text-slate-500 mt-2 break-all font-mono">{qrUrl}</p>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-400 mb-1.5 flex items-center gap-2">
                <QrCode size={16} /> QR Ordering Not Enabled
              </p>
              <p className="text-xs text-slate-400">
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
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-lg transition text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
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
  const navigate = useNavigate();
  const { data: paidAddons } = useTenantPaidAddons();
  const qrOrderEnabled = paidAddons?.qrOrdering === true;
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const { user } = useAuth();
  const selectedStore = stores.find((s) => String(s._id) === String(selectedStoreId));
  const canvasRef = useRef(null);
  const draggedTableRef = useRef(null);

  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTables, setSelectedTables] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showCapacity, setShowCapacity] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [localPlan, setLocalPlan] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [nextTableNumber, setNextTableNumber] = useState(1);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showTableList, setShowTableList] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [drawingLine, setDrawingLine] = useState(null);
  const [drawingHall, setDrawingHall] = useState(null);

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

  // Reset local plan when selected store changes
  useEffect(() => {
    setLocalPlan(null);
    setIsDirty(false);
    setSelectedTable(null);
    setSelectedTables([]);
  }, [selectedStoreId]);

  // Initialize local plan when data loads
  useEffect(() => {
    if (floorPlan) {
      setLocalPlan({
        ...floorPlan,
        tables: floorPlan.tables || [],
        zones: floorPlan.zones || [],
        lines: floorPlan.lines || [],
        texts: floorPlan.texts || [],
      });
      setIsDirty(false);
    }
  }, [floorPlan]);

  // Create default plan structure if none exists after loading
  useEffect(() => {
    if (!isLoading && !floorPlan && isStoreReady && !localPlan) {
      setLocalPlan({
        name: 'Main Floor',
        gridWidth: 20,
        gridHeight: 15,
        tables: [],
        zones: [],
        lines: [],
        texts: [],
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedTable(null);
        setSelectedTables([]);
        setIsSelecting(false);
        setSelectionBox(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const plan = localPlan || floorPlan;
  const [errorMessage, setErrorMessage] = useState(null);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/floor-plan', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-plan'] });
      setIsDirty(false);
      setErrorMessage(null);
      navigate('/manager/floor-plan');
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to save floor plan';
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
      
      // Show success message
      const successMsg = `Created ${response.data.label}`;
      setErrorMessage(successMsg);
      setTimeout(() => {
        if (errorMessage === successMsg) setErrorMessage(null);
      }, 2000);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to create table';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Delete table permanently mutation
  const deleteTableMutation = useMutation({
    mutationFn: (tableId) => api.delete(`/tables/${tableId}`),
    onSuccess: (response, tableId) => {
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      
      // Remove from floor plan if present
      if (localPlan) {
        const updatedTables = localPlan.tables.filter(
          (t) => String(t.tableId) !== String(tableId)
        );
        setLocalPlan({ ...localPlan, tables: updatedTables });
        setIsDirty(true);
      }
      
      // Clear selection
      setSelectedTable(null);
      setSelectedTables([]);
      
      setErrorMessage('Table deleted permanently');
      setTimeout(() => setErrorMessage(null), 2000);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to delete table';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Bulk delete tables mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (tableIds) => {
      await Promise.all(tableIds.map(id => api.delete(`/tables/${id}`)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      
      // Remove from floor plan
      if (localPlan) {
        const deletedIds = new Set(selectedTables.map(String));
        const updatedTables = localPlan.tables.filter(
          (t) => !deletedIds.has(String(t.tableId))
        );
        setLocalPlan({ ...localPlan, tables: updatedTables });
        setIsDirty(true);
      }
      
      setSelectedTable(null);
      setSelectedTables([]);
      
      setErrorMessage(`${selectedTables.length} tables deleted`);
      setTimeout(() => setErrorMessage(null), 2000);
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Failed to delete tables';
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
      lines: localPlan.lines || [],
      texts: localPlan.texts || [],
    });
  }, [localPlan, saveMutation]);

  const handleTableDragStart = useCallback((e, table) => {
    e.dataTransfer.setData('text/plain', String(table.tableId));
    e.dataTransfer.setData('tableId', String(table.tableId));
    e.dataTransfer.effectAllowed = 'move';
    draggedTableRef.current = { type: 'existing', id: String(table.tableId) };
  }, []);

  const handleTableDragEnd = useCallback(() => {
    draggedTableRef.current = null;
  }, []);

  const handleCanvasDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      const tableId = e.dataTransfer.getData('tableId') || (draggedTableRef.current?.type === 'existing' ? draggedTableRef.current.id : null);
      const newTableId = e.dataTransfer.getData('newTableId') || (draggedTableRef.current?.type === 'new' ? draggedTableRef.current.id : null);

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

      let updatedGridWidth = localPlan.gridWidth || 20;
      let updatedGridHeight = localPlan.gridHeight || 15;
      const width = newTableId ? 2 : (currentTables.find((t) => String(t.tableId) === tableId)?.width || 2);
      const height = newTableId ? 2 : (currentTables.find((t) => String(t.tableId) === tableId)?.height || 2);

      // Expand grid size if table is dragged beyond current boundaries
      if (x + width > updatedGridWidth) {
        updatedGridWidth = Math.min(50, Math.max(updatedGridWidth + 5, x + width));
      }
      if (y + height > updatedGridHeight) {
        updatedGridHeight = Math.min(40, Math.max(updatedGridHeight + 5, y + height));
      }

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
          x: Math.max(0, Math.min(x, updatedGridWidth - 2)),
          y: Math.max(0, Math.min(y, updatedGridHeight - 2)),
          width: 2,
          height: 2,
          shape: selectedShape,
          rotation: 0,
          capacity: table.capacity || 4,
        };

        console.log('Adding table to floor plan:', newTablePos);

        setLocalPlan({
          ...localPlan,
          gridWidth: updatedGridWidth,
          gridHeight: updatedGridHeight,
          tables: [...currentTables, newTablePos],
        });
        setIsDirty(true);
      } else if (tableId) {
        // Moving existing table
        const updatedTables = currentTables.map((t) => {
          if (String(t.tableId) === tableId) {
            return {
              ...t,
              x: Math.max(0, Math.min(x, updatedGridWidth - t.width)),
              y: Math.max(0, Math.min(y, updatedGridHeight - t.height)),
            };
          }
          return t;
        });

        setLocalPlan({
          ...localPlan,
          gridWidth: updatedGridWidth,
          gridHeight: updatedGridHeight,
          tables: updatedTables,
        });
        setIsDirty(true);
      }
      draggedTableRef.current = null;
    },
    [localPlan, tables, zoom, selectedShape]
  );

  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const isNew = draggedTableRef.current?.type === 'new' || e.dataTransfer.types.includes('newtableid');
    e.dataTransfer.dropEffect = isNew ? 'copy' : 'move';
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

  // Handle canvas click - create new table or deselect
  const handleCanvasClick = useCallback((e) => {
    // Check if we're clicking on the canvas itself (not a table or child element)
    const isCanvasBackground = 
      e.target === canvasRef.current || 
      e.target.classList.contains('zone-overlay') ||
      e.currentTarget === canvasRef.current;
    
    if (isCanvasBackground) {
      if (localPlan) {
        // If tables are selected, deselect them first
        if (selectedTable || selectedTables.length > 0) {
          setSelectedTable(null);
          setSelectedTables([]);
          return;
        }
        
        // If in Select/Move mode (no shape selected), do not create table
        if (!selectedShape) return;

        if (selectedShape === 'text') {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const cellSize = 50 * zoom;
          const gridX = Math.round((e.clientX - rect.left) / cellSize);
          const gridY = Math.round((e.clientY - rect.top) / cellSize);

          const textVal = prompt("Enter text label:");
          if (textVal && textVal.trim()) {
            const newText = {
              x: gridX,
              y: gridY,
              text: textVal.trim(),
              color: '#f8fafc',
              fontSize: 14,
            };
            setLocalPlan(prev => ({
              ...prev,
              texts: [...(prev.texts || []), newText]
            }));
            setIsDirty(true);
          }
          return;
        }
        
        // Create a new table at click position
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
      }
    }
  }, [localPlan, zoom, nextTableNumber, tables.length, createTableMutation, selectedTable, selectedTables, selectedShape]);

  const handleTableSelect = useCallback((table, event) => {
    if (event?.ctrlKey || event?.metaKey) {
      // Multi-select with Ctrl/Cmd
      const tableId = String(table.tableId);
      if (selectedTables.includes(tableId)) {
        setSelectedTables(selectedTables.filter(id => id !== tableId));
      } else {
        setSelectedTables([...selectedTables, tableId]);
      }
      setSelectedTable(null);
    } else {
      // Single select
      setSelectedTable(table);
      setSelectedTables([]);
    }
  }, [selectedTables]);

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
    // Only remove from floor plan, not delete permanently
    const updatedTables = localPlan.tables.filter(
      (t) => String(t.tableId) !== String(selectedTable.tableId)
    );
    setLocalPlan({ ...localPlan, tables: updatedTables });
    setSelectedTable(null);
    setIsDirty(true);
  }, [selectedTable, localPlan]);

  const handleDeletePermanently = useCallback(() => {
    if (selectedTables.length > 0) {
      if (confirm(`Permanently delete ${selectedTables.length} table(s)? This cannot be undone.`)) {
        // Get the actual table IDs from the database
        const tableIdsToDelete = selectedTables.map(tableId => {
          const planTable = (localPlan?.tables || []).find(t => String(t.tableId) === String(tableId));
          return planTable ? planTable.tableId : tableId;
        });
        bulkDeleteMutation.mutate(tableIdsToDelete);
      }
    } else if (selectedTable) {
      if (confirm(`Permanently delete "${selectedTable.label}"? This cannot be undone.`)) {
        // Use the tableId from the floor plan, which is the actual table's _id in the database
        deleteTableMutation.mutate(selectedTable.tableId);
      }
    }
  }, [selectedTable, selectedTables, deleteTableMutation, bulkDeleteMutation, localPlan]);

  // Selection box and drawing handlers
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cellSize = 50 * zoom;

    if (selectedShape === 'line') {
      const gridX = Math.round((e.clientX - rect.left) / cellSize);
      const gridY = Math.round((e.clientY - rect.top) / cellSize);
      setDrawingLine({ x1: gridX, y1: gridY, x2: gridX, y2: gridY });
    } else if (selectedShape === 'hall') {
      const gridX = Math.floor((e.clientX - rect.left) / cellSize);
      const gridY = Math.floor((e.clientY - rect.top) / cellSize);
      setDrawingHall({ x1: gridX, y1: gridY, x2: gridX + 1, y2: gridY + 1 });
    } else {
      // Only start selection if clicking on canvas background and not dragging a table
      if (e.target === canvasRef.current || e.target.classList.contains('zone-overlay') || e.target.tagName === 'svg' || e.target.tagName === 'line') {
        setIsSelecting(true);
        setSelectionBox({
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          currentX: e.clientX - rect.left,
          currentY: e.clientY - rect.top,
        });
      }
    }
  }, [selectedShape, zoom]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cellSize = 50 * zoom;

    if (selectedShape === 'line' && drawingLine) {
      const gridX = Math.round((e.clientX - rect.left) / cellSize);
      const gridY = Math.round((e.clientY - rect.top) / cellSize);
      setDrawingLine({ ...drawingLine, x2: gridX, y2: gridY });
    } else if (selectedShape === 'hall' && drawingHall) {
      const gridX = Math.floor((e.clientX - rect.left) / cellSize);
      const gridY = Math.floor((e.clientY - rect.top) / cellSize);
      setDrawingHall({ ...drawingHall, x2: gridX + 1, y2: gridY + 1 });
    } else if (isSelecting && selectionBox) {
      setSelectionBox({
        ...selectionBox,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      });
    }
  }, [isSelecting, selectionBox, selectedShape, zoom, drawingLine, drawingHall]);

  const handleMouseUp = useCallback(() => {
    if (selectedShape === 'line' && drawingLine) {
      if (drawingLine.x1 !== drawingLine.x2 || drawingLine.y1 !== drawingLine.y2) {
        const newLine = {
          x1: drawingLine.x1,
          y1: drawingLine.y1,
          x2: drawingLine.x2,
          y2: drawingLine.y2,
          color: '#94a3b8',
          thickness: 2,
        };
        setLocalPlan(prev => ({
          ...prev,
          lines: [...(prev.lines || []), newLine]
        }));
        setIsDirty(true);
      }
      setDrawingLine(null);
      return;
    }

    if (selectedShape === 'hall' && drawingHall) {
      const x = Math.min(drawingHall.x1, drawingHall.x2);
      const y = Math.min(drawingHall.y1, drawingHall.y2);
      const w = Math.abs(drawingHall.x2 - drawingHall.x1);
      const h = Math.abs(drawingHall.y2 - drawingHall.y1);
      if (w > 0 && h > 0) {
        const name = prompt("Enter Hall/Area name:", "Main Hall");
        if (name && name.trim()) {
          const newZone = {
            name: name.trim(),
            x,
            y,
            width: w,
            height: h,
            color: '#3b82f6',
          };
          setLocalPlan(prev => ({
            ...prev,
            zones: [...(prev.zones || []), newZone]
          }));
          setIsDirty(true);
        }
      }
      setDrawingHall(null);
      return;
    }

    if (!isSelecting || !selectionBox || !localPlan) {
      setIsSelecting(false);
      setSelectionBox(null);
      return;
    }

    // Calculate selection box bounds
    const minX = Math.min(selectionBox.startX, selectionBox.currentX);
    const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
    const minY = Math.min(selectionBox.startY, selectionBox.currentY);
    const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

    // Find tables within selection box
    const cellSize = 50 * zoom;
    const selectedIds = (localPlan.tables || [])
      .filter((table) => {
        const tableLeft = table.x * cellSize;
        const tableTop = table.y * cellSize;
        const tableRight = tableLeft + (table.width * cellSize);
        const tableBottom = tableTop + (table.height * cellSize);
        
        // Check if table overlaps with selection box
        return !(tableRight < minX || tableLeft > maxX || tableBottom < minY || tableTop > maxY);
      })
      .map((t) => String(t.tableId));

    setSelectedTables(selectedIds);
    setSelectedTable(null);
    setIsSelecting(false);
    setSelectionBox(null);
  }, [isSelecting, selectionBox, localPlan, zoom, selectedShape, drawingLine, drawingHall]);

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
    <div className="h-screen flex flex-col bg-[var(--pos-page-bg)] overflow-hidden">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden min-h-0">
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
          {/* Toolbar */}
          <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-3 flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedShape(null)}
                className={`p-2 rounded-lg transition-colors ${
                  selectedShape === null
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title="Select / Move mode"
              >
                <Move size={16} />
              </button>
              <div className="h-6 w-px bg-slate-700 mx-1" />
              <span className="text-xs text-slate-400">Add Table:</span>
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
              <div className="h-6 w-px bg-slate-700 mx-1" />
              <span className="text-xs text-slate-400 font-medium">Design:</span>
              <button
                onClick={() => setSelectedShape('line')}
                className={`p-2 rounded-lg transition-colors ${
                  selectedShape === 'line' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title="Draw Straight Line"
              >
                <Slash size={16} />
              </button>
              <button
                onClick={() => setSelectedShape('text')}
                className={`p-2 rounded-lg transition-colors ${
                  selectedShape === 'text' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title="Add Text Label"
              >
                <Type size={16} />
              </button>
              <button
                onClick={() => setSelectedShape('hall')}
                className={`p-2 rounded-lg transition-colors ${
                  selectedShape === 'hall' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title="Define Hall / Area"
              >
                <Map size={16} />
              </button>
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
              title="Show capacity & chairs"
            >
              <Users size={16} />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setShowTableList(!showTableList)}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm flex items-center gap-2 transition"
              title="View all tables"
            >
              <List size={14} />
              Tables ({tables.length})
            </button>


            <Link
              to="/manager/floor-plan"
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-350 hover:bg-slate-600 font-semibold text-sm flex items-center gap-2 transition border border-slate-600"
            >
              Exit Editor
            </Link>

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
          <div className="flex-1 bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl overflow-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                Loading floor plan...
              </div>
            ) : plan ? (
              <div
                ref={canvasRef}
                className={`relative transition-all ${isDragOver ? 'ring-2 ring-amber-400 ring-inset bg-amber-500/5' : ''}`}
                style={{
                  width: `${(localPlan?.gridWidth || plan.gridWidth || 20) * 50 * zoom}px`,
                  height: `${(localPlan?.gridHeight || plan.gridHeight || 15) * 50 * zoom}px`,
                  backgroundImage: showGrid
                    ? 'linear-gradient(to right, var(--pos-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--pos-grid-line) 1px, transparent 1px)'
                    : 'none',
                  backgroundSize: `${50 * zoom}px ${50 * zoom}px`,
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                onDragEnter={handleCanvasDragEnter}
                onDragLeave={handleCanvasDragLeave}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                {/* Zones */}
                {plan.zones?.map((zone) => (
                  <Zone key={zone._id || zone.name} zone={zone} zoom={zoom} />
                ))}

                {/* SVG Lines */}
                <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 4 }}>
                  {(plan.lines || []).map((line, idx) => (
                    <line
                      key={`line-${idx}`}
                      x1={line.x1 * 50 * zoom}
                      y1={line.y1 * 50 * zoom}
                      x2={line.x2 * 50 * zoom}
                      y2={line.y2 * 50 * zoom}
                      stroke={line.color || '#94a3b8'}
                      strokeWidth={(line.thickness || 2) * zoom}
                    />
                  ))}
                  {drawingLine && (
                    <line
                      x1={drawingLine.x1 * 50 * zoom}
                      y1={drawingLine.y1 * 50 * zoom}
                      x2={drawingLine.x2 * 50 * zoom}
                      y2={drawingLine.y2 * 50 * zoom}
                      stroke="#f59e0b"
                      strokeWidth={2 * zoom}
                      strokeDasharray="4,4"
                    />
                  )}
                </svg>

                {/* Text Labels */}
                {(plan.texts || []).map((t, idx) => (
                  <div
                    key={`text-${idx}`}
                    className="absolute select-none font-semibold whitespace-nowrap text-center pointer-events-none"
                    style={{
                      left: `${t.x * 50 * zoom}px`,
                      top: `${t.y * 50 * zoom}px`,
                      color: t.color || '#f8fafc',
                      fontSize: `${(t.fontSize || 14) * zoom}px`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 6,
                    }}
                  >
                    {t.text}
                  </div>
                ))}

                {/* Hall / Zone drawing preview */}
                {drawingHall && (
                  <div
                    className="absolute border border-dashed border-amber-500 bg-amber-500/10 pointer-events-none"
                    style={{
                      left: `${Math.min(drawingHall.x1, drawingHall.x2) * 50 * zoom}px`,
                      top: `${Math.min(drawingHall.y1, drawingHall.y2) * 50 * zoom}px`,
                      width: `${Math.abs(drawingHall.x2 - drawingHall.x1) * 50 * zoom}px`,
                      height: `${Math.abs(drawingHall.y2 - drawingHall.y1) * 50 * zoom}px`,
                      zIndex: 3,
                    }}
                  />
                )}

                {/* Empty state helper */}
                {planTablesWithLabels.length === 0 && !isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none zone-overlay">
                    <div className="text-center text-slate-500">
                      <Plus size={48} className="mx-auto mb-2 opacity-50 text-amber-400" />
                      <p className="text-sm text-amber-400">Click anywhere on the grid to add a table</p>
                      <p className="text-xs">Or drag existing tables from the sidebar</p>
                      <p className="text-xs mt-1">Ctrl+Click or drag to multi-select</p>
                    </div>
                  </div>
                )}

                {/* Selection Box */}
                {selectionBox && (
                  <div
                    className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none"
                    style={{
                      left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                      top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                      width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                      height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                    }}
                  />
                )}

                {/* Tables */}
                {planTablesWithLabels.map((table) => {
                  const tableId = String(table.tableId);
                  const isSingleSelected = selectedTable && String(selectedTable.tableId) === tableId;
                  const isMultiSelected = selectedTables.includes(tableId);
                  return (
                    <TableShape
                      key={tableId}
                      table={table}
                      isSelected={isSingleSelected || isMultiSelected}
                      onClick={handleTableSelect}
                      onDragStart={handleTableDragStart}
                      onDragEnd={handleTableDragEnd}
                      tableStatus={tableStatus}
                      showCapacity={showCapacity}
                      zoom={zoom}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No floor plan found
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 flex flex-col gap-4 overflow-y-auto shrink-0 min-h-0">
          {/* Multi-Select Actions */}
          {selectedTables.length > 0 && (
            <div className="bg-[var(--pos-panel)] border border-amber-500/60 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[var(--pos-text-primary)]">
                {selectedTables.length} Table{selectedTables.length > 1 ? 's' : ''} Selected
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedTables([]);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
                >
                  Deselect All
                </button>
                <button
                  onClick={handleDeletePermanently}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Selected Table Properties */}
          {selectedTable && (
            <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-[var(--pos-text-primary)] flex items-center justify-between">
                Table Properties
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedTable(null);
                      setSelectedTables([]);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-350 hover:bg-slate-800 transition"
                    title="Close properties panel"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                    title="Remove from floor plan"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={handleDeletePermanently}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    title="Delete permanently"
                  >
                    <Trash2 size={14} className="fill-current" />
                  </button>
                </div>
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
                      e.dataTransfer.setData('text/plain', String(table._id));
                      e.dataTransfer.setData('newTableId', String(table._id));
                      e.dataTransfer.effectAllowed = 'copy';
                      draggedTableRef.current = { type: 'new', id: String(table._id) };
                    }}
                    onDragEnd={handleTableDragEnd}
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

          {/* Halls & Areas Manager */}
          {localPlan?.zones && localPlan.zones.length > 0 && (
            <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[var(--pos-text-primary)] text-sm">
                Halls & Areas
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {localPlan.zones.map((zone, i) => (
                  <div key={`zone-${i}`} className="flex items-center justify-between bg-[var(--pos-surface-inset)] p-2 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zone.color || '#3b82f6' }} />
                      <span className="truncate text-slate-350 font-medium">{zone.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = localPlan.zones.filter((_, idx) => idx !== i);
                        setLocalPlan({ ...localPlan, zones: updated });
                        setIsDirty(true);
                      }}
                      className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decorations Panel */}
          {((localPlan?.lines && localPlan.lines.length > 0) || (localPlan?.texts && localPlan.texts.length > 0)) && (
            <div className="bg-[var(--pos-panel)] border border-slate-700/60 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-[var(--pos-text-primary)] text-sm">
                Floor Decorations
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {localPlan.texts?.map((t, i) => (
                  <div key={`text-${i}`} className="flex items-center justify-between bg-[var(--pos-surface-inset)] p-2 rounded-lg text-xs">
                    <span className="truncate flex-1 text-slate-350">Text: "{t.text}" ({t.x}, {t.y})</span>
                    <button
                      onClick={() => {
                        const updated = localPlan.texts.filter((_, idx) => idx !== i);
                        setLocalPlan({ ...localPlan, texts: updated });
                        setIsDirty(true);
                      }}
                      className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {localPlan.lines?.map((line, i) => (
                  <div key={`line-${i}`} className="flex items-center justify-between bg-[var(--pos-surface-inset)] p-2 rounded-lg text-xs">
                    <span className="truncate flex-1 text-slate-350">Line: ({line.x1},{line.y1}) to ({line.x2},{line.y2})</span>
                    <button
                      onClick={() => {
                        const updated = localPlan.lines.filter((_, idx) => idx !== i);
                        setLocalPlan({ ...localPlan, lines: updated });
                        setIsDirty(true);
                      }}
                      className="text-red-405 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            
            <div className="mt-4 pt-4 border-t border-slate-700/60">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Quick Guide</h4>
              <ul className="space-y-1 text-xs text-slate-500">
                <li>• Click grid to add table</li>
                <li>• Drag tables to move</li>
                <li>• Ctrl+Click for multi-select</li>
                <li>• Drag on grid to select area</li>
                <li>• ESC to deselect</li>
                <li>• 🗑️ Hollow = Remove from plan</li>
                <li>• 🗑️ Filled = Delete permanently</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Table List Sidebar */}
      {showTableList && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--pos-panel)] border-l border-slate-700 shadow-2xl z-[60] overflow-y-auto">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-[var(--pos-panel)] z-10">
            <h3 className="font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              <List size={18} />
              All Tables ({tables.length})
            </h3>
            <button 
              onClick={() => setShowTableList(false)} 
              className="text-slate-500 hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {tables.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 text-sm">No tables created yet.</p>
                <p className="text-slate-600 text-xs mt-1">Add tables from the Café Tables page.</p>
              </div>
            ) : (
              tables.map((table) => {
                const onPlan = localPlan?.tables?.some(t => String(t.tableId) === String(table._id));
                return (
                  <div
                    key={table._id}
                    className="bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg p-3 hover:border-amber-500/50 transition cursor-pointer group"
                    onClick={() => setEditingTableId(table._id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--pos-text-primary)]">{table.label}</span>
                          {onPlan && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">
                              On Plan
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
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
                      <Edit2 size={14} className="text-slate-500 group-hover:text-amber-400 transition" />
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
          await api.put(`/tables/${editingTableId}`, data);
          qc.invalidateQueries({ queryKey: ['pos-tables'] });
          qc.invalidateQueries({ queryKey: ['floor-plan'] });
          if (localPlan && localPlan.tables) {
            const updatedTables = localPlan.tables.map(t => {
              if (String(t.tableId) === String(editingTableId)) {
                return { ...t, label: data.label, capacity: Number(data.capacity) || 4 };
              }
              return t;
            });
            setLocalPlan({ ...localPlan, tables: updatedTables });
            setIsDirty(true);
          }
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
