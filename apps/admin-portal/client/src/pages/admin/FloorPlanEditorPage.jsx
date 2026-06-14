import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Grid3X3, Save, RotateCcw, Plus, Trash2, Square, Circle as CircleIcon, 
  Sofa, Wine, ZoomIn, ZoomOut, Move, Users, Layers, List, X, QrCode, Edit2,
  Slash, Type, Map as MapIcon,
} from 'lucide-react';
import { Stage, Layer, Rect, Circle, Text, Line, Group, Transformer } from 'react-konva';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { getQrOrderWebOrigin } from '@innovapos/app-urls';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';

const SHAPES = [
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'round', icon: CircleIcon, label: 'Round' },
  { id: 'booth', icon: Sofa, label: 'Booth' },
  { id: 'bar', icon: Wine, label: 'Bar seat' },
];

const SHAPE_COLORS = {
  rectangle: { fill: '#b45309', stroke: '#f59e0b' },
  round: { fill: '#0f766e', stroke: '#14b8a6' },
  booth: { fill: '#6b21a8', stroke: '#a855f7' },
  bar: { fill: '#c2410c', stroke: '#f97316' },
};

const STATUS_COLORS = {
  occupied: { fill: '#ef4444', stroke: '#f87171' },
  reserved: { fill: '#eab308', stroke: '#facc15' },
};

const DECORATION_COLORS = [
  { name: 'Slate', value: '#f8fafc' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
];

function TableShape({ table, isSelected, onClick, onDragEnd, tableStatus, showCapacity }) {
  const status = tableStatus?.[String(table.tableId)] || {};
  const cellSize = 50;
  const capacity = table.capacity || 4;
  const width = table.width * cellSize;
  const height = table.height * cellSize;

  const colors = useMemo(() => {
    if (status.status === 'occupied') return STATUS_COLORS.occupied;
    if (status.status === 'reserved') return STATUS_COLORS.reserved;
    return SHAPE_COLORS[table.shape] || SHAPE_COLORS.rectangle;
  }, [status.status, table.shape]);

  const renderChairs = () => {
    if (!showCapacity) return null;
    const chairs = [];
    const chairSize = 8;
    
    if (table.shape === 'round') {
      const radius = (Math.max(width, height) / 2) + 10;
      for (let i = 0; i < capacity; i++) {
        const angle = (i * 2 * Math.PI) / capacity - Math.PI / 2;
        chairs.push(
          <Circle
            key={`chair-${i}`}
            x={width / 2 + Math.cos(angle) * radius}
            y={height / 2 + Math.sin(angle) * radius}
            radius={chairSize / 2}
            fill="#475569"
            stroke="#334155"
            strokeWidth={1}
          />
        );
      }
    } else if (table.shape === 'bar') {
      const spacing = width / (capacity + 1);
      for (let i = 0; i < capacity; i++) {
        chairs.push(
          <Rect
            key={`chair-${i}`}
            x={spacing * (i + 1) - chairSize / 2}
            y={height + 2}
            width={chairSize}
            height={chairSize - 2}
            fill="#475569"
            stroke="#334155"
            strokeWidth={1}
            cornerRadius={1}
          />
        );
      }
    } else {
      const perimeter = 2 * (width + height);
      const spacing = perimeter / capacity;
      
      for (let i = 0; i < capacity; i++) {
        const distance = i * spacing;
        let cx, cy;
        
        if (distance < width) {
          cx = distance;
          cy = -chairSize - 2;
        } else if (distance < width + height) {
          cx = width + 2;
          cy = distance - width;
        } else if (distance < 2 * width + height) {
          cx = width - (distance - width - height);
          cy = height + 2;
        } else {
          cx = -chairSize - 2;
          cy = height - (distance - 2 * width - height);
        }
        
        chairs.push(
          <Rect
            key={`chair-${i}`}
            x={cx}
            y={cy}
            width={chairSize}
            height={chairSize - 2}
            fill="#475569"
            stroke="#334155"
            strokeWidth={1}
            cornerRadius={1}
          />
        );
      }
    }
    return chairs;
  };

  return (
    <Group
      id={`table-${table.tableId}`}
      x={table.x * cellSize}
      y={table.y * cellSize}
      width={width}
      height={height}
      rotation={table.rotation || 0}
      offsetX={width / 2}
      offsetY={height / 2}
      draggable
      onClick={(e) => onClick?.(table, e.evt)}
      onTap={(e) => onClick?.(table, e.evt)}
      onDragEnd={(e) => onDragEnd?.(e, table.tableId)}
      onTransformEnd={(e) => onDragEnd?.(e, table.tableId)}
    >
      {table.shape === 'round' ? (
        <Circle
          x={width / 2}
          y={height / 2}
          radius={Math.min(width, height) / 2 - 2}
          fill={colors.fill}
          stroke={isSelected ? '#38bdf8' : colors.stroke}
          strokeWidth={isSelected ? 3 : 1.5}
          shadowBlur={isSelected ? 8 : 4}
          shadowColor="black"
          shadowOpacity={0.4}
        />
      ) : (
        <Rect
          x={2}
          y={2}
          width={width - 4}
          height={height - 4}
          fill={colors.fill}
          stroke={isSelected ? '#38bdf8' : colors.stroke}
          strokeWidth={isSelected ? 3 : 1.5}
          cornerRadius={table.shape === 'booth' ? 8 : 4}
          shadowBlur={isSelected ? 8 : 4}
          shadowColor="black"
          shadowOpacity={0.4}
        />
      )}

      {renderChairs()}

      <Text
        text={table.label || 'T'}
        x={0}
        y={height / 2 - 10}
        width={width}
        align="center"
        fontSize={12}
        fontStyle="bold"
        fill="#ffffff"
      />
      <Text
        text={`${table.shape === 'bar' ? 'Bar' : table.shape === 'booth' ? 'Booth' : table.shape === 'round' ? 'Round' : 'Table'} (${capacity})`}
        x={0}
        y={height / 2 + 4}
        width={width}
        align="center"
        fontSize={8}
        fill="#e2e8f0"
        opacity={0.8}
      />
      {status.status === 'occupied' && status.seatedMinutes && (
        <Text
          text={`${status.seatedMinutes}m`}
          x={0}
          y={height + 14}
          width={width}
          align="center"
          fontSize={9}
          fill="#f87171"
          fontStyle="bold"
        />
      )}
    </Group>
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

export default function FloorPlanEditorPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: paidAddons } = useTenantPaidAddons();
  const qrOrderEnabled = paidAddons?.qrOrdering === true;
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const draggedTableRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);

  const [selectedElement, setSelectedElement] = useState(null); // { type: 'table'|'zone'|'text'|'line', id|index }
  const [selectedTables, setSelectedTables] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showCapacity, setShowCapacity] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [localPlan, setLocalPlan] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [nextTableNumber, setNextTableNumber] = useState(1);
  const [showTableList, setShowTableList] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [drawingLine, setDrawingLine] = useState(null);
  const [drawingHall, setDrawingHall] = useState(null);
  const [isStageDraggable, setIsStageDraggable] = useState(false);

  // Derive selected elements for backward compatibility and visual properties rendering
  const plan = localPlan;
  
  const selectedTable = useMemo(() => {
    if (selectedElement?.type === 'table') {
      return localPlan?.tables?.find(t => String(t.tableId) === String(selectedElement.id));
    }
    return null;
  }, [selectedElement, localPlan?.tables]);

  const selectedZone = useMemo(() => {
    if (selectedElement?.type === 'zone') {
      return localPlan?.zones?.[selectedElement.index];
    }
    return null;
  }, [selectedElement, localPlan?.zones]);

  const selectedText = useMemo(() => {
    if (selectedElement?.type === 'text') {
      return localPlan?.texts?.[selectedElement.index];
    }
    return null;
  }, [selectedElement, localPlan?.texts]);

  const selectedLine = useMemo(() => {
    if (selectedElement?.type === 'line') {
      return localPlan?.lines?.[selectedElement.index];
    }
    return null;
  }, [selectedElement, localPlan?.lines]);

  // Keyboard spacebar, escape, delete listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept hotkeys when editing inputs
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
      ) {
        return;
      }
      
      if (e.code === 'Space') {
        setIsStageDraggable(true);
        e.preventDefault();
      }
      
      if (e.key === 'Escape') {
        setSelectedElement(null);
        setSelectedTables([]);
        setDrawingLine(null);
        setDrawingHall(null);
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement && localPlan) {
          e.preventDefault();
          if (selectedElement.type === 'table') {
            handleDeleteSelected();
          } else if (selectedElement.type === 'zone') {
            const updated = localPlan.zones.filter((_, idx) => idx !== selectedElement.index);
            setLocalPlan({ ...localPlan, zones: updated });
            setSelectedElement(null);
            setIsDirty(true);
          } else if (selectedElement.type === 'text') {
            const updated = localPlan.texts.filter((_, idx) => idx !== selectedElement.index);
            setLocalPlan({ ...localPlan, texts: updated });
            setSelectedElement(null);
            setIsDirty(true);
          } else if (selectedElement.type === 'line') {
            const updated = localPlan.lines.filter((_, idx) => idx !== selectedElement.index);
            setLocalPlan({ ...localPlan, lines: updated });
            setSelectedElement(null);
            setIsDirty(true);
          }
        }
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsStageDraggable(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElement, localPlan]);

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
    setSelectedElement(null);
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

  const [errorMessage, setErrorMessage] = useState(null);

  // Attach Transformer to selected tables
  useEffect(() => {
    if (trRef.current) {
      const stage = stageRef.current;
      const nodes = [];
      if (selectedTable) {
        const node = stage.findOne(`#table-${selectedTable.tableId}`);
        if (node) nodes.push(node);
      } else if (selectedTables.length > 0) {
        selectedTables.forEach((id) => {
          const node = stage.findOne(`#table-${id}`);
          if (node) nodes.push(node);
        });
      }
      trRef.current.nodes(nodes);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedTable, selectedTables, localPlan]);

  // Handle nudging shapes with arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      if (!isArrowKey) return;

      const hasSelection = selectedTable || selectedTables.length > 0;
      if (!hasSelection || !localPlan) return;

      e.preventDefault(); // Prevent page scrolling

      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'ArrowRight') dx = 1;
      else if (e.key === 'ArrowUp') dy = -1;
      else if (e.key === 'ArrowDown') dy = 1;

      const selectedIds = selectedTable 
        ? [String(selectedTable.tableId)] 
        : selectedTables.map(String);

      const updatedTables = localPlan.tables.map((t) => {
        if (selectedIds.includes(String(t.tableId))) {
          const newX = Math.max(0, t.x + dx);
          const newY = Math.max(0, t.y + dy);
          return { ...t, x: newX, y: newY };
        }
        return t;
      });

      setLocalPlan({ ...localPlan, tables: updatedTables });
      setIsDirty(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTable, selectedTables, localPlan]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/floor-plan', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-plan'] });
      setIsDirty(false);
      setErrorMessage(null);
      navigate('/floor-plan');
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
      
      if (localPlan && variables._tempPosition) {
        const newTablePos = {
          tableId: newTable._id,
          label: newTable.label,
          x: variables._tempPosition.x + 1,
          y: variables._tempPosition.y + 1,
          width: 2,
          height: 2,
          shape: selectedShape || 'rectangle',
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
      
      if (localPlan) {
        const updatedTables = localPlan.tables.filter(
          (t) => String(t.tableId) !== String(tableId)
        );
        setLocalPlan({ ...localPlan, tables: updatedTables });
        setIsDirty(true);
      }
      
      setSelectedElement(null);
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
      
      if (localPlan) {
        const deletedIds = new Set(selectedTables.map(String));
        const updatedTables = localPlan.tables.filter(
          (t) => !deletedIds.has(String(t.tableId))
        );
        setLocalPlan({ ...localPlan, tables: updatedTables });
        setIsDirty(true);
      }
      
      setSelectedElement(null);
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

  // Handle table drag/transform end on stage
  const handleTableDragOrTransformEnd = useCallback((e, tableId) => {
    const node = e.target;
    const cellSize = 50;
    
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    
    const rawWidth = (node.width() * scaleX) / cellSize;
    const rawHeight = (node.height() * scaleY) / cellSize;
    const newWidth = Math.max(1, Math.round(rawWidth));
    const newHeight = Math.max(1, Math.round(rawHeight));
    
    const newX = Math.round((node.x() - (newWidth * cellSize) / 2) / cellSize);
    const newY = Math.round((node.y() - (newHeight * cellSize) / 2) / cellSize);
    const newRotation = Math.round(node.rotation() / 90) * 90;

    if (localPlan) {
      let updatedGridWidth = localPlan.gridWidth || 20;
      let updatedGridHeight = localPlan.gridHeight || 15;

      if (newX + newWidth > updatedGridWidth) {
        updatedGridWidth = Math.min(50, newX + newWidth + 2);
      }
      if (newY + newHeight > updatedGridHeight) {
        updatedGridHeight = Math.min(40, newY + newHeight + 2);
      }

      const updatedTables = localPlan.tables.map((t) => {
        if (String(t.tableId) === String(tableId)) {
          return {
            ...t,
            x: Math.max(0, newX),
            y: Math.max(0, newY),
            width: newWidth,
            height: newHeight,
            rotation: newRotation % 360,
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
  }, [localPlan]);

  // Handle Drop from Sidebar to Canvas
  const handleCanvasDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      const tableId = e.dataTransfer.getData('tableId') || (draggedTableRef.current?.type === 'existing' ? draggedTableRef.current.id : null);
      const newTableId = e.dataTransfer.getData('newTableId') || (draggedTableRef.current?.type === 'new' ? draggedTableRef.current.id : null);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      if (!localPlan) return;

      const currentTables = localPlan.tables || [];
      const cellSize = 50 * zoom;
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);

      let updatedGridWidth = localPlan.gridWidth || 20;
      let updatedGridHeight = localPlan.gridHeight || 15;
      const width = newTableId ? 2 : (currentTables.find((t) => String(t.tableId) === tableId)?.width || 2);
      const height = newTableId ? 2 : (currentTables.find((t) => String(t.tableId) === tableId)?.height || 2);

      if (x + width > updatedGridWidth) {
        updatedGridWidth = Math.min(50, Math.max(updatedGridWidth + 5, x + width));
      }
      if (y + height > updatedGridHeight) {
        updatedGridHeight = Math.min(40, Math.max(updatedGridHeight + 5, y + height));
      }

      if (newTableId) {
        const table = tables.find((t) => String(t._id) === newTableId);
        if (!table) return;

        const exists = currentTables.some((t) => String(t.tableId) === newTableId);
        if (exists) return;

        const newTablePos = {
          tableId: table._id,
          label: table.label,
          x: Math.max(0, Math.min(x, updatedGridWidth - 2)),
          y: Math.max(0, Math.min(y, updatedGridHeight - 2)),
          width: 2,
          height: 2,
          shape: selectedShape || 'rectangle',
          rotation: 0,
          capacity: table.capacity || 4,
        };

        setLocalPlan({
          ...localPlan,
          gridWidth: updatedGridWidth,
          gridHeight: updatedGridHeight,
          tables: [...currentTables, newTablePos],
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
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const getStageRelativePointerPosition = useCallback((stage) => {
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return {
      x: (pos.x - stage.x()) / zoom,
      y: (pos.y - stage.y()) / zoom,
    };
  }, [zoom]);

  const handleStageMouseDown = (e) => {
    if (isStageDraggable || e.evt.button === 2) return;
    
    const stage = stageRef.current;
    const pos = getStageRelativePointerPosition(stage);
    if (!pos) return;
    
    const cellSize = 50;
    const gridX = Math.round(pos.x / cellSize);
    const gridY = Math.round(pos.y / cellSize);

    if (selectedShape === 'line') {
      setDrawingLine({ x1: gridX, y1: gridY, x2: gridX, y2: gridY });
    } else if (selectedShape === 'hall') {
      const cellFloorX = Math.floor(pos.x / cellSize);
      const cellFloorY = Math.floor(pos.y / cellSize);
      setDrawingHall({ x1: cellFloorX, y1: cellFloorY, x2: cellFloorX + 1, y2: cellFloorY + 1 });
    } else {
      const isBackground = e.target === stage || e.target.hasName('grid-bg') || e.target.hasName('zone-rect');
      if (isBackground) {
        setSelectedElement(null);
        setSelectedTables([]);
      }
    }
  };

  const handleStageMouseMove = (e) => {
    if (isStageDraggable) return;
    const stage = stageRef.current;
    const pos = getStageRelativePointerPosition(stage);
    if (!pos) return;
    
    const cellSize = 50;

    if (selectedShape === 'line' && drawingLine) {
      const gridX = Math.round(pos.x / cellSize);
      const gridY = Math.round(pos.y / cellSize);
      setDrawingLine({ ...drawingLine, x2: gridX, y2: gridY });
    } else if (selectedShape === 'hall' && drawingHall) {
      const gridX = Math.floor(pos.x / cellSize);
      const gridY = Math.floor(pos.y / cellSize);
      setDrawingHall({ ...drawingHall, x2: gridX + 1, y2: gridY + 1 });
    }
  };

  const handleStageMouseUp = (e) => {
    if (isStageDraggable) return;

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
  };

  const handleStageClick = (e) => {
    if (isStageDraggable || e.evt.button === 2) return;
    
    const stage = stageRef.current;
    const isBackground = e.target === stage || e.target.hasName('grid-bg') || e.target.hasName('zone-rect');
    
    if (isBackground) {
      if (selectedShape && selectedShape !== 'line' && selectedShape !== 'hall') {
        const pos = getStageRelativePointerPosition(stage);
        if (!pos) return;
        const cellSize = 50;
        const gridX = Math.max(0, Math.min(Math.floor(pos.x / cellSize), (localPlan?.gridWidth || 20) - 2));
        const gridY = Math.max(0, Math.min(Math.floor(pos.y / cellSize), (localPlan?.gridHeight || 15) - 2));

        if (selectedShape === 'text') {
          const textVal = prompt("Enter text label:");
          if (textVal && textVal.trim()) {
            const newText = {
              x: gridX,
              y: gridY,
              text: textVal.trim(),
              color: '#334155',
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

        createTableMutation.mutate({
          label: `Table ${nextTableNumber}`,
          capacity: 4,
          sortOrder: tables.length,
          _tempPosition: { x: gridX, y: gridY },
        });
      }
    }
  };

  const handleTableSelect = useCallback((table, event) => {
    if (event?.ctrlKey || event?.metaKey) {
      const tableId = String(table.tableId);
      if (selectedTables.includes(tableId)) {
        setSelectedTables(selectedTables.filter(id => id !== tableId));
      } else {
        setSelectedTables([...selectedTables, tableId]);
      }
      setSelectedElement(null);
    } else {
      setSelectedElement({ type: 'table', id: table.tableId });
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
    setIsDirty(true);
  }, [selectedTable, localPlan]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedTable || !localPlan) return;
    const updatedTables = localPlan.tables.filter(
      (t) => String(t.tableId) !== String(selectedTable.tableId)
    );
    setLocalPlan({ ...localPlan, tables: updatedTables });
    setSelectedElement(null);
    setIsDirty(true);
  }, [selectedTable, localPlan]);

  const handleDeletePermanently = useCallback(() => {
    if (selectedTables.length > 0) {
      if (confirm(`Permanently delete ${selectedTables.length} table(s)? This cannot be undone.`)) {
        const tableIdsToDelete = selectedTables.map(tableId => {
          const planTable = (localPlan?.tables || []).find(t => String(t.tableId) === String(tableId));
          return planTable ? planTable.tableId : tableId;
        });
        bulkDeleteMutation.mutate(tableIdsToDelete);
      }
    } else if (selectedTable) {
      if (confirm(`Permanently delete "${selectedTable.label}"? This cannot be undone.`)) {
        deleteTableMutation.mutate(selectedTable.tableId);
      }
    }
  }, [selectedTable, selectedTables, deleteTableMutation, bulkDeleteMutation, localPlan]);

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
      setIsDirty(true);
    },
    [selectedTable, localPlan]
  );

  const unplacedTables = useMemo(() => {
    if (!plan) return tables;
    const planTables = plan.tables || [];
    const placedIds = new Set(planTables.map((t) => String(t.tableId)));
    return tables.filter((t) => !placedIds.has(String(t._id)));
  }, [tables, plan]);

  const planTablesWithLabels = useMemo(() => {
    if (!plan) return [];
    const planTables = plan.tables || [];
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    return planTables.map((pt) => ({
      ...pt,
      label: tableMap.get(String(pt.tableId))?.label || pt.label || 'T',
    }));
  }, [plan, tables]);

  // Grid Lines helper (drawn inside Canvas Stage)
  const renderGridLines = () => {
    if (!showGrid || !plan) return null;
    const lines = [];
    const gridW = plan.gridWidth || 20;
    const gridH = plan.gridHeight || 15;
    const cellSize = 50;

    for (let i = 0; i <= gridW; i++) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i * cellSize, 0, i * cellSize, gridH * cellSize]}
          stroke="#cbd5e1"
          strokeWidth={1}
          opacity={0.6}
        />
      );
    }
    for (let j = 0; j <= gridH; j++) {
      lines.push(
        <Line
          key={`h-${j}`}
          points={[0, j * cellSize, gridW * cellSize, j * cellSize]}
          stroke="#cbd5e1"
          strokeWidth={1}
          opacity={0.6}
        />
      );
    }
    return lines;
  };

  if (!isStoreReady) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
                <div className="flex-1 flex items-center justify-center">
          <p className="text-amber-300">Select a store in the header first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden min-h-0">
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
          {/* Toolbar */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedShape(null)}
                className={`p-2 rounded-lg transition-colors border ${
                  selectedShape === null
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
                }`}
                title="Select / Move mode"
              >
                <Move size={16} />
              </button>
              <div className="h-6 w-px bg-gray-200 mx-1" />
              <span className="text-xs text-gray-500">Add Table:</span>
              {SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => setSelectedShape(shape.id)}
                  className={`p-2 rounded-lg transition-colors border ${
                    selectedShape === shape.id
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
                  }`}
                  title={shape.label}
                >
                  <shape.icon size={16} />
                </button>
              ))}
              <div className="h-6 w-px bg-gray-200 mx-1" />
              <span className="text-xs text-gray-500 font-medium">Design:</span>
              <button
                onClick={() => setSelectedShape('line')}
                className={`p-2 rounded-lg transition-colors border ${
                  selectedShape === 'line' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
                }`}
                title="Draw Straight Line"
              >
                <Slash size={16} />
              </button>
              <button
                onClick={() => setSelectedShape('text')}
                className={`p-2 rounded-lg transition-colors border ${
                  selectedShape === 'text' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
                }`}
                title="Add Text Label"
              >
                <Type size={16} />
              </button>
              <button
                onClick={() => setSelectedShape('hall')}
                className={`p-2 rounded-lg transition-colors border ${
                  selectedShape === 'hall' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
                }`}
                title="Define Hall / Area"
              >
                <MapIcon size={16} />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-750 hover:bg-gray-50 transition shadow-sm"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-gray-500 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-750 hover:bg-gray-50 transition shadow-sm"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-colors border ${
                showGrid ? 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange' : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
              }`}
              title="Toggle grid"
            >
              <Grid3X3 size={16} />
            </button>

            <button
              onClick={() => setShowCapacity(!showCapacity)}
              className={`p-2 rounded-lg transition-colors border ${
                showCapacity ? 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange' : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
              }`}
              title="Show capacity & chairs"
            >
              <Users size={16} />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setShowTableList(!showTableList)}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-750 hover:bg-gray-50 text-sm flex items-center gap-2 transition shadow-sm"
              title="View all tables"
            >
              <List size={14} />
              Tables ({tables.length})
            </button>

            <Link
              to="/floor-plan"
              className="px-4 py-2 rounded-lg bg-white text-gray-750 hover:bg-gray-50 font-semibold text-sm flex items-center gap-2 transition border border-gray-205 shadow-sm"
            >
              Exit Editor
            </Link>

            <button
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-brand-orange text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
            </button>
          </div>

          {/* Canvas Wrapper */}
          <div
            ref={canvasRef}
            className={`flex-1 bg-gray-50 border border-gray-200 rounded-xl overflow-auto min-h-0 relative select-none ${
              isStageDraggable ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading floor plan...
              </div>
            ) : plan ? (
              <Stage
                ref={stageRef}
                width={(localPlan?.gridWidth || plan.gridWidth || 20) * 50 * zoom}
                height={(localPlan?.gridHeight || plan.gridHeight || 15) * 50 * zoom}
                scaleX={zoom}
                scaleY={zoom}
                draggable={isStageDraggable}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onClick={handleStageClick}
              >
                <Layer>
                  {/* Grid Background */}
                  <Rect
                    name="grid-bg"
                    x={0}
                    y={0}
                    width={(localPlan?.gridWidth || plan.gridWidth || 20) * 50}
                    height={(localPlan?.gridHeight || plan.gridHeight || 15) * 50}
                    fill="#ffffff"
                  />

                  {/* Dynamic grid lines */}
                  {renderGridLines()}

                  {/* Zones / Halls */}
                  {(plan.zones || []).map((zone, idx) => {
                    const isZoneSelected = selectedElement?.type === 'zone' && selectedElement.index === idx;
                    return (
                      <Group
                        key={`zone-${idx}`}
                        draggable
                        onDragEnd={(e) => {
                          const node = e.target;
                          const newX = Math.max(0, Math.round(node.x() / 50));
                          const newY = Math.max(0, Math.round(node.y() / 50));
                          node.x(newX * 50);
                          node.y(newY * 50);
                          const updated = localPlan.zones.map((z, i) => 
                            i === idx ? { ...z, x: newX, y: newY } : z
                          );
                          setLocalPlan({ ...localPlan, zones: updated });
                          setIsDirty(true);
                        }}
                      >
                        <Rect
                          name="zone-rect"
                          x={zone.x * 50}
                          y={zone.y * 50}
                          width={zone.width * 50}
                          height={zone.height * 50}
                          fill={zone.color || '#3b82f6'}
                          opacity={isZoneSelected ? 0.35 : 0.15}
                          stroke={isZoneSelected ? '#38bdf8' : 'transparent'}
                          strokeWidth={2}
                          cornerRadius={6}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            setSelectedElement({ type: 'zone', index: idx });
                          }}
                          onTap={(e) => {
                            e.cancelBubble = true;
                            setSelectedElement({ type: 'zone', index: idx });
                          }}
                        />
                        <Text
                          text={zone.name}
                          x={zone.x * 50 + 10}
                          y={zone.y * 50 + 10}
                          fill={isZoneSelected ? '#38bdf8' : '#94a3b8'}
                          fontSize={11}
                          fontStyle="bold"
                        />
                      </Group>
                    );
                  })}

                  {/* Drawing Hall Preview */}
                  {drawingHall && (
                    <Rect
                      x={Math.min(drawingHall.x1, drawingHall.x2) * 50}
                      y={Math.min(drawingHall.y1, drawingHall.y2) * 50}
                      width={Math.abs(drawingHall.x2 - drawingHall.x1) * 50}
                      height={Math.abs(drawingHall.y2 - drawingHall.y1) * 50}
                      fill="#f59e0b"
                      opacity={0.15}
                      stroke="#f59e0b"
                      strokeWidth={1}
                      dash={[4, 4]}
                    />
                  )}

                  {/* Wall Lines */}
                  {(plan.lines || []).map((line, idx) => {
                    const isLineSelected = selectedElement?.type === 'line' && selectedElement.index === idx;
                    return (
                      <Line
                        key={`line-${idx}`}
                        points={[line.x1 * 50, line.y1 * 50, line.x2 * 50, line.y2 * 50]}
                        stroke={isLineSelected ? '#38bdf8' : (line.color || '#94a3b8')}
                        strokeWidth={(line.thickness || 2) + (isLineSelected ? 2 : 0)}
                        lineCap="round"
                        onClick={(e) => {
                          e.cancelBubble = true;
                          setSelectedElement({ type: 'line', index: idx });
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          setSelectedElement({ type: 'line', index: idx });
                        }}
                      />
                    );
                  })}

                  {/* Drawing Line Preview */}
                  {drawingLine && (
                    <Line
                      points={[drawingLine.x1 * 50, drawingLine.y1 * 50, drawingLine.x2 * 50, drawingLine.y2 * 50]}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dash={[4, 4]}
                      lineCap="round"
                    />
                  )}

                  {/* Texts */}
                  {(plan.texts || []).map((t, idx) => {
                    const isTextSelected = selectedElement?.type === 'text' && selectedElement.index === idx;
                    return (
                      <Text
                        key={`text-${idx}`}
                        text={t.text}
                        x={t.x * 50}
                        y={t.y * 50}
                        fill={isTextSelected ? '#38bdf8' : (t.color === '#f8fafc' || !t.color || t.color === '#ffffff' ? '#334155' : t.color)}
                        fontSize={t.fontSize || 12}
                        fontStyle="bold"
                        offsetX={50}
                        width={100}
                        align="center"
                        draggable
                        onClick={(e) => {
                          e.cancelBubble = true;
                          setSelectedElement({ type: 'text', index: idx });
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          setSelectedElement({ type: 'text', index: idx });
                        }}
                        onDragEnd={(e) => {
                          const node = e.target;
                          const newX = Math.max(0, Math.round(node.x() / 50));
                          const newY = Math.max(0, Math.round(node.y() / 50));
                          node.x(newX * 50);
                          node.y(newY * 50);
                          const updated = localPlan.texts.map((txt, i) => 
                            i === idx ? { ...txt, x: newX, y: newY } : txt
                          );
                          setLocalPlan({ ...localPlan, texts: updated });
                          setIsDirty(true);
                        }}
                      />
                    );
                  })}

                  {/* Placeable Tables */}
                  {planTablesWithLabels.map((table) => {
                    const tableId = String(table.tableId);
                    const isSingleSelected = selectedElement?.type === 'table' && String(selectedElement.id) === tableId;
                    const isMultiSelected = selectedTables.includes(tableId);
                    return (
                      <TableShape
                        key={tableId}
                        table={table}
                        isSelected={isSingleSelected || isMultiSelected}
                        onClick={handleTableSelect}
                        onDragEnd={handleTableDragOrTransformEnd}
                        tableStatus={tableStatus}
                        showCapacity={showCapacity}
                      />
                    );
                  })}

                  {/* Transform overlay handles */}
                  <Transformer
                    ref={trRef}
                    rotateEnabled={true}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 30 || newBox.height < 30) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No floor plan found
              </div>
            )}

            {/* Quick Helper overlay */}
            {!isLoading && planTablesWithLabels.length === 0 && !isDragOver && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-400 bg-white p-6 rounded-xl border border-gray-200/50">
                  <Plus size={40} className="mx-auto mb-2 opacity-50 text-brand-orange animate-bounce" />
                  <p className="text-sm text-brand-orange font-semibold">Click canvas (with shape selected) to place tables</p>
                  <p className="text-xs mt-1">Drag unplaced tables from the sidebar</p>
                  <p className="text-xs mt-1">Hold SPACEBAR + drag mouse to pan canvas</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 flex flex-col gap-4 overflow-y-auto shrink-0 min-h-0">
          {/* Multi-Select Actions */}
          {selectedTables.length > 0 && (
            <div className="bg-white border border-amber-500/60 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">
                {selectedTables.length} Table{selectedTables.length > 1 ? 's' : ''} Selected
              </h3>
              <div className="flex gap-2">
            {stores.length > 0 && (
              <select
                value={selectedStoreId || ''}
                onChange={(e) => selectStore(e.target.value)}
                className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
              >
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
                <button
                  onClick={() => setSelectedTables([])}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-350 hover:bg-slate-600 text-xs"
                >
                  Deselect All
                </button>
                <button
                  onClick={handleDeletePermanently}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Selected Table Properties */}
          {selectedTable && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center justify-between">
                Table Properties
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedElement(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-slate-350 hover:bg-slate-800 transition"
                    title="Close properties panel"
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                    title="Remove from floor plan"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={handleDeletePermanently}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    title="Delete permanently"
                  >
                    <Trash2 size={12} className="fill-current" />
                  </button>
                </div>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Shape</label>
                  <div className="flex gap-2 mt-1">
                    {SHAPES.map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => handleUpdateSelectedProperty('shape', shape.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          selectedTable.shape === shape.id
                            ? 'bg-brand-orange text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-650'
                        }`}
                        title={shape.label}
                      >
                        <shape.icon size={13} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Width (Cells)</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={selectedTable.width}
                      onChange={(e) => handleUpdateSelectedProperty('width', Math.max(1, Number(e.target.value)))}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Height (Cells)</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={selectedTable.height}
                      onChange={(e) => handleUpdateSelectedProperty('height', Math.max(1, Number(e.target.value)))}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedTable.capacity}
                    onChange={(e) => handleUpdateSelectedProperty('capacity', Math.max(1, Number(e.target.value)))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  onClick={handleRotateSelected}
                  className="w-full py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw size={12} />
                  Rotate 90°
                </button>
              </div>
            </div>
          )}

          {/* Selected Zone Properties */}
          {selectedZone && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center justify-between">
                Zone Properties
                <button
                  onClick={() => setSelectedElement(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-slate-350 hover:bg-slate-800 transition"
                >
                  <X size={12} />
                </button>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Zone Name</label>
                  <input
                    type="text"
                    value={selectedZone.name}
                    onChange={(e) => {
                      const updated = localPlan.zones.map((z, idx) => 
                        idx === selectedElement.index ? { ...z, name: e.target.value } : z
                      );
                      setLocalPlan({ ...localPlan, zones: updated });
                      setIsDirty(true);
                    }}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Width</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedZone.width}
                      onChange={(e) => {
                        const updated = localPlan.zones.map((z, idx) => 
                          idx === selectedElement.index ? { ...z, width: Math.max(1, Number(e.target.value)) } : z
                        );
                        setLocalPlan({ ...localPlan, zones: updated });
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Height</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedZone.height}
                      onChange={(e) => {
                        const updated = localPlan.zones.map((z, idx) => 
                          idx === selectedElement.index ? { ...z, height: Math.max(1, Number(e.target.value)) } : z
                        );
                        setLocalPlan({ ...localPlan, zones: updated });
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Color</label>
                  <div className="flex gap-1.5 mt-1">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          const updated = localPlan.zones.map((z, idx) => 
                            idx === selectedElement.index ? { ...z, color: c } : z
                          );
                          setLocalPlan({ ...localPlan, zones: updated });
                          setIsDirty(true);
                        }}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 ${selectedZone.color === c ? 'border-white' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const updated = localPlan.zones.filter((_, idx) => idx !== selectedElement.index);
                    setLocalPlan({ ...localPlan, zones: updated });
                    setSelectedElement(null);
                    setIsDirty(true);
                  }}
                  className="w-full py-1.5 mt-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Delete Zone
                </button>
              </div>
            </div>
          )}

          {/* Selected Text Properties */}
          {selectedText && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center justify-between">
                Label Properties
                <button
                  onClick={() => setSelectedElement(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-slate-350 hover:bg-slate-800 transition"
                >
                  <X size={12} />
                </button>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Text Content</label>
                  <input
                    type="text"
                    value={selectedText.text}
                    onChange={(e) => {
                      const updated = localPlan.texts.map((t, idx) => 
                        idx === selectedElement.index ? { ...t, text: e.target.value } : t
                      );
                      setLocalPlan({ ...localPlan, texts: updated });
                      setIsDirty(true);
                    }}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Font Size</label>
                    <select
                      value={selectedText.fontSize || 12}
                      onChange={(e) => {
                        const updated = localPlan.texts.map((t, idx) => 
                          idx === selectedElement.index ? { ...t, fontSize: Number(e.target.value) } : t
                        );
                        setLocalPlan({ ...localPlan, texts: updated });
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none"
                    >
                      {[10, 12, 14, 16, 20, 24].map((s) => (
                        <option key={s} value={s}>{s}px</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Color</label>
                    <select
                      value={selectedText.color || '#f8fafc'}
                      onChange={(e) => {
                        const updated = localPlan.texts.map((t, idx) => 
                          idx === selectedElement.index ? { ...t, color: e.target.value } : t
                        );
                        setLocalPlan({ ...localPlan, texts: updated });
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none"
                    >
                      {DECORATION_COLORS.map((c) => (
                        <option key={c.value} value={c.value}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const updated = localPlan.texts.filter((_, idx) => idx !== selectedElement.index);
                    setLocalPlan({ ...localPlan, texts: updated });
                    setSelectedElement(null);
                    setIsDirty(true);
                  }}
                  className="w-full py-1.5 mt-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Delete Label
                </button>
              </div>
            </div>
          )}

          {/* Selected Line Properties */}
          {selectedLine && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center justify-between">
                Line Properties
                <button
                  onClick={() => setSelectedElement(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-slate-350 hover:bg-slate-800 transition"
                >
                  <X size={12} />
                </button>
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Thickness</label>
                    <select
                      value={selectedLine.thickness || 2}
                      onChange={(e) => {
                        const updated = localPlan.lines.map((l, idx) => 
                          idx === selectedElement.index ? { ...l, thickness: Number(e.target.value) } : l
                        );
                        setLocalPlan({ ...localPlan, lines: updated });
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none"
                    >
                      {[1, 2, 4, 6, 8].map((t) => (
                        <option key={t} value={t}>{t}px</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Color</label>
                    <select
                      value={selectedLine.color || '#94a3b8'}
                      onChange={(e) => {
                        const updated = localPlan.lines.map((l, idx) => 
                          idx === selectedElement.index ? { ...l, color: e.target.value } : l
                        );
                        setLocalPlan({ ...localPlan, lines: updated });
                        setIsDirty(true);
                      }}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 text-gray-900 focus:outline-none"
                    >
                      {DECORATION_COLORS.map((c) => (
                        <option key={c.value} value={c.value}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const updated = localPlan.lines.filter((_, idx) => idx !== selectedElement.index);
                    setLocalPlan({ ...localPlan, lines: updated });
                    setSelectedElement(null);
                    setIsDirty(true);
                  }}
                  className="w-full py-1.5 mt-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Delete Line
                </button>
              </div>
            </div>
          )}

          {/* Unplaced Tables */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <Plus size={14} className="text-brand-orange" />
              Add Tables
            </h3>
            {unplacedTables.length === 0 ? (
              <p className="text-xs text-gray-400">All tables are on the floor plan.</p>
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
                    onDragEnd={() => { draggedTableRef.current = null; }}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-700/50 cursor-grab hover:bg-slate-700 active:cursor-grabbing"
                  >
                    <Move size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-900">{table.label}</span>
                    <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                      <Users size={10} /> {table.capacity || 4}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Halls & Areas Manager */}
          {localPlan?.zones && localPlan.zones.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 text-xs">
                Halls & Areas
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {localPlan.zones.map((zone, i) => (
                  <div 
                    key={`zone-${i}`} 
                    onClick={() => setSelectedElement({ type: 'zone', index: i })}
                    className={`flex items-center justify-between p-2 rounded-lg text-[10px] cursor-pointer transition ${
                      selectedElement?.type === 'zone' && selectedElement.index === i 
                        ? 'bg-brand-orange/20 border border-amber-500/50' 
                        : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color || '#3b82f6' }} />
                      <span className="truncate text-slate-350 font-medium">{zone.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = localPlan.zones.filter((_, idx) => idx !== i);
                        setLocalPlan({ ...localPlan, zones: updated });
                        if (selectedElement?.type === 'zone' && selectedElement.index === i) {
                          setSelectedElement(null);
                        }
                        setIsDirty(true);
                      }}
                      className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decorations Panel */}
          {((localPlan?.lines && localPlan.lines.length > 0) || (localPlan?.texts && localPlan.texts.length > 0)) && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 text-xs">
                Floor Decorations
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {localPlan.texts?.map((t, i) => (
                  <div 
                    key={`text-${i}`} 
                    onClick={() => setSelectedElement({ type: 'text', index: i })}
                    className={`flex items-center justify-between p-2 rounded-lg text-[10px] cursor-pointer transition ${
                      selectedElement?.type === 'text' && selectedElement.index === i 
                        ? 'bg-brand-orange/20 border border-amber-500/50' 
                        : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <span className="truncate flex-1 text-slate-350">Text: "{t.text}"</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = localPlan.texts.filter((_, idx) => idx !== i);
                        setLocalPlan({ ...localPlan, texts: updated });
                        if (selectedElement?.type === 'text' && selectedElement.index === i) {
                          setSelectedElement(null);
                        }
                        setIsDirty(true);
                      }}
                      className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {localPlan.lines?.map((line, i) => (
                  <div 
                    key={`line-${i}`} 
                    onClick={() => setSelectedElement({ type: 'line', index: i })}
                    className={`flex items-center justify-between p-2 rounded-lg text-[10px] cursor-pointer transition ${
                      selectedElement?.type === 'line' && selectedElement.index === i 
                        ? 'bg-brand-orange/20 border border-amber-500/50' 
                        : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <span className="truncate flex-1 text-slate-350">Line: ({line.x1},{line.y1}) to ({line.x2},{line.y2})</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = localPlan.lines.filter((_, idx) => idx !== i);
                        setLocalPlan({ ...localPlan, lines: updated });
                        if (selectedElement?.type === 'line' && selectedElement.index === i) {
                          setSelectedElement(null);
                        }
                        setIsDirty(true);
                      }}
                      className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 text-xs mb-3">Status Legend</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#10766e]" />
                <span className="text-gray-500">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-gray-500">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500" />
                <span className="text-gray-500">Reserved</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Quick Guide</h4>
              <ul className="space-y-1 text-[10px] text-gray-400">
                <li>• Shape active → Click stage to place table</li>
                <li>• Select and drag any item (Table, Zone, Label) to move</li>
                <li>• Properties panel opens when selecting any item</li>
                <li>• Press Backspace / Delete to remove selected element</li>
                <li>• Hold Spacebar + drag stage to pan canvas</li>
              </ul>
            </div>
          </div>
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
              className="text-gray-400 hover:text-gray-650 transition p-1 rounded-lg hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {tables.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">No tables created yet.</p>
                <p className="text-slate-600 text-xs mt-1">Add tables from the Reservations page.</p>
              </div>
            ) : (
              tables.map((table) => {
                const onPlan = localPlan?.tables?.some(t => String(t.tableId) === String(table._id));
                return (
                  <div
                    key={table._id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-amber-500/50 transition cursor-pointer group"
                    onClick={() => setEditingTableId(table._id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
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
                      </div>
                      <Edit2 size={14} className="text-gray-400 group-hover:text-brand-orange transition" />
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
