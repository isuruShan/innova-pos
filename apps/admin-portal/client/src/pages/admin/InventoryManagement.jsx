import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Package, X, AlertTriangle, Truck, Search,
  LineChart as LineChartIcon, Calendar, User, SlidersHorizontal,
  Eye, Trash2, BarChart2, TrendingDown, TrendingUp, Layers,
  Download, Upload, Calculator
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/format';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import SlideOver from '../../components/SlideOver';
import Badge from '../../components/Badge';
import Toast from '../../components/Toast';
import { useStoreContext } from '../../context/StoreContext';
import { InventoryTableSkeleton } from '../../components/StoreSkeletons';
import { useListSort } from '../../hooks/useListSort';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import InventoryAdjustments from '../../components/inventory/InventoryAdjustments';
import CountSheetsManager from '../../components/inventory/CountSheetsManager';
import PrepRecipesManager from '../../components/inventory/PrepRecipesManager';
import StockTransfersManager from '../../components/inventory/StockTransfersManager';
import WastageManagement from './WastageManagement';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable from '../../components/ResponsiveTable';
import ViewModeToggle from '../../components/ViewModeToggle';
import ListPagination from '../../components/common/ListPagination';
import ImportModal from '../../components/ImportModal';
import {
  exportInventoryToCSV,
  getInventoryImportFields,
  validateInventoryRow
} from '../../utils/csvExportImport';

const EMPTY_FORM = { itemName: '', unit: 'pcs', quantity: '', minThreshold: '', category: '', suppliers: [] };

const PREDEFINED_UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'mL', label: 'Milliliter (mL)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'lb', label: 'Pound (lb)' },
  { value: 'box', label: 'Box' },
  { value: 'bag', label: 'Bag' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' },
  { value: 'pack', label: 'Pack' },
  { value: 'other', label: 'Other (custom)' },
];

const getStockStatus = (qty, min) => {
  if (qty <= 0) return { label: 'Out of Stock', variant: 'critical' };
  if (qty < min) return { label: 'Critical', variant: 'critical' };
  if (qty < min * 1.5) return { label: 'Low', variant: 'low' };
  return { label: 'OK', variant: 'ok' };
};



function SupplierPills({ suppliers }) {
  if (!suppliers?.length) return <span className="text-slate-600 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {suppliers.map(s => (
        <span key={s._id}
          className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-full px-2 py-0.5 text-xs font-medium">
          <Truck size={9} /> {s.name}
        </span>
      ))}
    </div>
  );
}

const FORMULA_FIELDS = {
  wac: 'wacCost',
  fifo: 'fifoCost',
  lifo: 'lifoCost',
  last_cost: 'lastCost',
};

const FORMULA_LABELS = {
  wac: 'WAC',
  fifo: 'FIFO',
  lifo: 'LIFO',
  last_cost: 'Last Cost',
};

export default function InventoryManagement() {
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const getActiveTab = () => {
    if (location.pathname.endsWith('/adjustments')) return 'adjustments';
    if (location.pathname.endsWith('/sessions')) return 'sessions';
    if (location.pathname.endsWith('/analytics')) return 'analytics';
    if (location.pathname.endsWith('/prep-recipes')) return 'prep-recipes';
    if (location.pathname.endsWith('/count-sheets')) return 'count-sheets';
    if (location.pathname.endsWith('/transfers')) return 'transfers';
    if (location.pathname.endsWith('/wastage')) return 'wastage';
    return 'stock';
  };
  const activeTab = getActiveTab();
  const setActiveTab = (tab) => navigate(`/inventory/${tab}`);

  useEffect(() => {
    if (location.pathname === '/inventory' || location.pathname === '/inventory/') {
      navigate('/inventory/stock', { replace: true });
    }
  }, [location.pathname, navigate]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  
  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchQuery(q);
    if (q) {
      setSelectedCategoryId(null);
    }
  }, [searchParams]);

  const [showFilters, setShowFilters] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_inventory_management');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_inventory_management', mode);
  };

  const filterContainerRef = useRef(null);

  useEffect(() => {
    if (!showFilters) return;
    const handleClickOutside = (e) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  const [importModalOpen, setImportModalOpen] = useState(false);

  const qc = useQueryClient();
  const { sort, order, toggleSort, sortParams } = useListSort('name', 'asc');
  const { toast, showToast, clearToast } = useToast();



  // Addon Status Query
  const { data: addonStatus } = useQuery({
    queryKey: ['tenant-addon-status'],
    queryFn: () => api.get('/paid-addons/status').then((r) => r.data),
  });

  // Storage Area States
  const [manageStorageAreasOpen, setManageStorageAreasOpen] = useState(false);
  const [storageAreaForm, setStorageAreaForm] = useState({ name: '' });
  const [editingStorageArea, setEditingStorageArea] = useState(null);
  const [storageAreaError, setStorageAreaError] = useState('');

  // Storage Area Queries
  const { data: storageAreas = [], isPending: storageAreasPending } = useQuery({
    queryKey: ['storage-areas', selectedStoreId],
    queryFn: () => api.get('/advanced-inventory/storage-areas').then(r => r.data),
    enabled: isStoreReady,
  });

  // Storage Area Mutations
  const createStorageAreaMutation = useMutation({
    mutationFn: (data) => api.post('/advanced-inventory/storage-areas', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storage-areas', selectedStoreId] });
      setStorageAreaForm({ name: '' });
      setStorageAreaError('');
      showToast('Storage area created', 'success');
    },
    onError: (err) => {
      setStorageAreaError(err.response?.data?.message || 'Failed to create storage area');
    }
  });

  const deleteStorageAreaMutation = useMutation({
    mutationFn: (id) => api.delete(`/advanced-inventory/storage-areas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storage-areas', selectedStoreId] });
      showToast('Storage area deleted', 'success');
    },
  });

  // Category States
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState('');

  // Category Queries
  const { data: categories = [], isPending: categoriesPending } = useQuery({
    queryKey: ['inventory-categories', selectedStoreId],
    queryFn: () => api.get('/inventory-categories').then(r => r.data),
    enabled: isStoreReady,
  });

  // Category Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data) => api.post('/inventory-categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-categories'] });
      setCategoryForm({ name: '', description: '' });
      setCategoryError('');
      showToast('Category created', 'success');
    },
    onError: (e) => {
      setCategoryError(getApiErrorMessage(e, 'Failed to create category'));
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/inventory-categories/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-categories'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setEditingCategory(null);
      setCategoryError('');
      showToast('Category updated', 'success');
    },
    onError: (e) => {
      setCategoryError(getApiErrorMessage(e, 'Failed to update category'));
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => api.delete(`/inventory-categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-categories'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      showToast('Category deleted', 'success');
    },
    onError: (e) => {
      showToast(getApiErrorMessage(e, 'Failed to delete category'), 'error');
    },
  });

  // Adjustment History States
  const [sessionStatus, setSessionStatus] = useState('all');
  const [sessionViewMode, setSessionViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_inventory_adjustment_sessions');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetSessionViewMode = (mode) => {
    setSessionViewMode(mode);
    localStorage.setItem('view_mode_inventory_adjustment_sessions', mode);
  };

  const [activeSessionDetails, setActiveSessionDetails] = useState(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [showSessionFilters, setShowSessionFilters] = useState(false);
  const { sort: sessionSort, order: sessionOrder, toggleSort: toggleSessionSort } = useListSort('createdAt', 'desc');

  // Graph States
  const [graphItem, setGraphItem] = useState(null);

  const [selectedFormulaState, setSelectedFormulaState] = useState(null);

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenant-settings').then(r => r.data),
  });

  const selectedFormula = selectedFormulaState || settings?.inventoryCostingMethod || 'wac';

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionLimit, setSessionLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategoryId, filter, activeTab]);

  useEffect(() => {
    setSessionPage(1);
  }, [sessionSearch, sessionStatus, activeTab]);

  const { data: inventoryData = { items: [], total: 0, page: 1, pages: 1, summary: { lowStockCount: 0, categoryCounts: {} } }, isPending: invPending, isFetching: invFetching } = useQuery({
    queryKey: ['inventory', selectedStoreId, page, limit, sort, order, searchQuery, selectedCategoryId, filter, activeTab],
    queryFn: () => api.get('/inventory', {
      params: {
        paginate: activeTab === 'stock' && selectedCategoryId !== null ? 'true' : 'false',
        page,
        limit,
        sort,
        order,
        search: searchQuery,
        categoryId: selectedCategoryId || undefined,
        stockStatus: filter
      }
    }).then(r => r.data),
    enabled: isStoreReady,
  });

  const items = activeTab === 'stock' && selectedCategoryId !== null
    ? (inventoryData.items || [])
    : (Array.isArray(inventoryData) ? inventoryData : (inventoryData.items || []));

  const { data: suppliers = [], isPending: supPending } = useQuery({
    queryKey: ['suppliers', selectedStoreId],
    queryFn: () => api.get('/suppliers').then(r => r.data),
    enabled: isStoreReady,
  });

  // Query for Sessions History
  const { data: sessionsData = { items: [], total: 0, page: 1, pages: 1 }, isPending: sessionsPending, isFetching: sessionsFetching } = useQuery({
    queryKey: ['inventory-sessions', selectedStoreId, sessionPage, sessionLimit, sessionSort, sessionOrder, sessionSearch, sessionStatus],
    queryFn: () => api.get('/inventory-sessions', {
      params: {
        paginate: 'true',
        page: sessionPage,
        limit: sessionLimit,
        sort: sessionSort,
        order: sessionOrder,
        search: sessionSearch,
        status: sessionStatus === 'all' ? undefined : sessionStatus
      }
    }).then(r => r.data),
    enabled: isStoreReady && activeTab === 'sessions',
  });

  const sessions = sessionsData.items || [];

  // Query for Session Movements Details
  const { data: sessionMovements = [], isPending: movementsPending } = useQuery({
    queryKey: ['session-movements', activeSessionDetails?._id],
    queryFn: () => api.get(`/stock-movements/by-session/${activeSessionDetails._id}`).then(r => r.data),
    enabled: !!activeSessionDetails?._id,
  });

  // Query for Item Movements Details (Graph + Table)
  const { data: itemMovements = [], isPending: itemMovementsPending } = useQuery({
    queryKey: ['item-movements', graphItem?._id],
    queryFn: () => api.get(`/stock-movements/by-item/${graphItem._id}`).then(r => r.data),
    enabled: !!graphItem?._id,
  });

  const [analyticsDays, setAnalyticsDays] = useState(30);

  const analyticsFromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - analyticsDays);
    return d.toISOString().split('T')[0];
  }, [analyticsDays]);

  const analyticsToDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { data: consumptionReport, isPending: consumptionPending } = useQuery({
    queryKey: ['inventory-consumption', selectedStoreId, analyticsFromDate, analyticsToDate],
    queryFn: () => api.get('/inventory/consumption-report', {
      params: { from: analyticsFromDate, to: analyticsToDate },
    }).then(r => r.data),
    enabled: isStoreReady && activeTab === 'analytics',
  });

  const pageLoading = !isStoreReady || invPending || supPending;


  const createMutation = useMutation({
    mutationFn: (data) => api.post('/inventory', data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['inventory'] }); 
      closeSlide(); 
      showToast('Item added successfully', 'success');
    },
    onError: (e) => {
      const msg = getApiErrorMessage(e, 'Failed to save item');
      setFormError(msg);
      showToast(msg, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/inventory/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      closeSlide();
      showToast('Item updated successfully', 'success');
    },
    onError: (e) => {
      const msg = getApiErrorMessage(e, 'Failed to update item');
      setFormError(msg);
      showToast(msg, 'error');
    },
  });

  const openAdd = () => { 
    setEditing(null); 
    setForm({
      ...EMPTY_FORM,
      category: selectedCategoryId && selectedCategoryId !== 'uncategorized' ? selectedCategoryId : '',
    }); 
    setFormError(''); 
    setSlideOpen(true); 
    setSupplierSearch(''); 
    setCustomUnit(''); 
  };
  const openEdit = (item) => {
    setEditing(item);
    const unitExists = PREDEFINED_UNITS.some(u => u.value === item.unit);
    setForm({
      itemName: item.itemName,
      unit: unitExists ? item.unit : 'other',
      quantity: item.quantity,
      minThreshold: item.minThreshold,
      category: item.category?._id || item.category || '',
      suppliers: item.suppliers?.map(s => s._id) || [],
    });
    setCustomUnit(unitExists ? '' : item.unit);
    setFormError('');
    setSlideOpen(true);
    setSupplierSearch('');
  };
  const closeSlide = () => { 
    setSlideOpen(false); 
    setEditing(null); 
    setForm(EMPTY_FORM); 
    setFormError(''); 
    setSupplierSearch(''); 
    setCustomUnit(''); 
  };



  const handleExportInventory = async () => {
    try {
      showToast('Preparing export...', 'info');
      const res = await api.get('/inventory', {
        params: {
          paginate: 'false',
          sort,
          order,
          search: searchQuery,
          categoryId: selectedCategoryId || undefined,
          stockStatus: filter
        }
      });
      exportInventoryToCSV(res.data);
      showToast(`Exported ${res.data.length} inventory items`, 'success');
    } catch (err) {
      showToast('Failed to export inventory', 'error');
    }
  };

  const handleImportInventory = async (csvData, mapping, onProgress) => {
    const errors = [];
    let successCount = 0;
    const createdCategories = new Set();
    const createdSuppliersCount = { count: 0 };

    // Map existing inventory categories (case-insensitive)
    const existingCategoriesMap = new Map();
    categories.forEach(cat => {
      existingCategoriesMap.set(cat.name.toLowerCase(), cat);
    });

    // Map existing suppliers (case-insensitive)
    const suppliersMap = new Map();
    suppliers.forEach(sup => {
      suppliersMap.set(sup.name.toLowerCase(), sup._id);
    });

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const { item, errors: rowErrors } = validateInventoryRow(row, mapping, i);

      if (rowErrors.length > 0) {
        errors.push({ rowIndex: i, message: rowErrors.join('; ') });
        onProgress({ total: csvData.length, current: i + 1, errors });
        continue;
      }

      try {
        // 1. Resolve/create category
        if (item.category) {
          const catLower = item.category.toLowerCase();
          let cat = existingCategoriesMap.get(catLower);
          
          if (!cat) {
            // Create the inventory category
            try {
              const res = await api.post('/inventory-categories', {
                name: item.category,
                description: 'Imported category'
              });
              cat = res.data;
              existingCategoriesMap.set(catLower, cat);
              createdCategories.add(item.category);
            } catch (catErr) {
              console.warn(`Failed to create inventory category "${item.category}":`, catErr.message);
            }
          }

          if (cat) {
            item.category = cat._id;
          } else {
            item.category = null;
          }
        } else {
          item.category = null;
        }

        // 2. Resolve or create suppliers on-the-fly
        if (item.suppliersRaw && item.suppliersRaw.length > 0) {
          const resolvedSupplierIds = [];
          for (const sName of item.suppliersRaw) {
            const sNameLower = sName.toLowerCase();
            let sId = suppliersMap.get(sNameLower);
            
            if (!sId) {
              // Create the supplier on-the-fly
              try {
                const res = await api.post('/suppliers', { name: sName });
                sId = res.data._id;
                suppliersMap.set(sNameLower, sId);
                createdSuppliersCount.count++;
              } catch (supErr) {
                console.warn(`Failed to create supplier "${sName}":`, supErr.message);
              }
            }
            
            if (sId) {
              resolvedSupplierIds.push(sId);
            }
          }
          item.suppliers = resolvedSupplierIds;
        } else {
          item.suppliers = [];
        }
        delete item.suppliersRaw;

        // 3. Create the inventory item
        await api.post('/inventory', item);
        successCount++;
      } catch (error) {
        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
        errors.push({
          rowIndex: i,
          message: errorMsg
        });
      }

      onProgress({ total: csvData.length, current: i + 1, errors });
    }

    // Refresh inventory, categories and suppliers after import
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['inventory'] }),
      qc.invalidateQueries({ queryKey: ['inventory-categories'] }),
      qc.invalidateQueries({ queryKey: ['suppliers'] })
    ]);

    if (createdCategories.size > 0) {
      const catList = Array.from(createdCategories).join(', ');
      showToast(`Created ${createdCategories.size} new categories: ${catList}`, 'success');
    }

    if (createdSuppliersCount.count > 0) {
      showToast(`Created ${createdSuppliersCount.count} new suppliers on-the-fly`, 'success');
    }

    return {
      total: csvData.length,
      success: successCount,
      errors,
      categoriesCreated: createdCategories.size
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const finalUnit = form.unit === 'other' ? customUnit.trim() : form.unit;
    if (!finalUnit) return setFormError('Please enter a custom unit');
    
    const payload = {
      itemName: form.itemName.trim(),
      unit: finalUnit,
      minThreshold: parseFloat(form.minThreshold),
      category: form.category || null,
      suppliers: form.suppliers,
    };

    if (!payload.itemName) return setFormError('Item name is required');
    if (isNaN(payload.minThreshold) || payload.minThreshold < 0) return setFormError('Threshold must be 0 or more');
    
    if (editing) {
      updateMutation.mutate({ id: editing._id, data: payload });
    } else {
      payload.quantity = 0; // force 0 on creation
      createMutation.mutate(payload);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(search) || 
      s.contact?.toLowerCase().includes(search)
    );
  }, [suppliers, supplierSearch]);

  const removeSupplier = (id) => {
    setForm(f => ({ ...f, suppliers: f.suppliers.filter(s => s !== id) }));
  };

  const filtered = useMemo(() => {
    let result = items;
    return result;
  }, [items]);

  const sortedSessions = sessions;

  const lowCount = items.filter(i => getStockStatus(i.quantity, i.minThreshold).variant !== 'ok').length;
  const isPending = createMutation.isPending || updateMutation.isPending;
  if (!isStoreReady) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md max-w-sm w-full text-center space-y-4">
          <Package size={40} className="mx-auto text-brand-orange animate-pulse" />
          <h2 className="text-lg font-bold text-gray-900">Select a Store</h2>
          <p className="text-sm text-gray-500">Please select a store to view and manage inventory.</p>
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

  const storeSelector = stores.length > 0 ? (
    <select
      value={selectedStoreId || ''}
      onChange={(e) => selectStore(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer w-full sm:w-56"
    >
      <option value="" disabled>Select Store...</option>
      {stores.map((s) => (
        <option key={s._id} value={s._id}>
          {s.name}
        </option>
      ))}
    </select>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              Inventory
              {activeTab === 'stock' && lowCount > 0 && (
                <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <AlertTriangle size={12} /> {lowCount} need attention
                </span>
              )}
            </span>
          }
          subtitle={
            activeTab === 'stock' ? `${items.length} items tracked` :
            activeTab === 'adjustments' ? 'Make manual stock adjustments' :
            activeTab === 'analytics' ? 'Stock health, category breakdown & consumption' :
            'View history of stock adjustments'
          }
          storeSelector={storeSelector}
          actions={activeTab === 'stock' ? [
            { label: 'Export', icon: Download, onClick: handleExportInventory },
            { label: 'Import', icon: Upload, onClick: () => setImportModalOpen(true) },
            { label: 'Manage Categories', icon: SlidersHorizontal, onClick: () => setManageCategoriesOpen(true) },
            ...(addonStatus?.activeAddons?.includes('advanced_inventory') ? [
              { label: 'Manage Storage Areas', icon: SlidersHorizontal, onClick: () => setManageStorageAreasOpen(true) }
            ] : []),
            { label: 'Add Item', icon: Plus, onClick: openAdd, primary: true },
          ] : activeTab === 'analytics' ? [
            { label: 'Stock Levels', icon: Package, onClick: () => { setActiveTab('stock'); setSelectedCategoryId(null); } },
          ] : []}
        />

        {/* Tabs */}

        {/* Tab Content */}
        {activeTab === 'stock' && (
          <>
            {selectedCategoryId === null ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Inventory Categories</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* Uncategorized Card */}
                  <div
                    onClick={() => setSelectedCategoryId('uncategorized')}
                    className="cursor-pointer bg-white hover:bg-gray-50 border border-gray-200 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg flex flex-col justify-between min-h-[140px]"
                  >
                    <div>
                      <h4 className="font-bold text-base text-gray-900 mb-1">Uncategorized</h4>
                      <p className="text-slate-400 text-xs line-clamp-2">Items without an assigned category</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 border-t border-gray-200/40 pt-3">
                      <span className="text-xs text-gray-400 font-medium">Stock Items</span>
                      <span className="bg-slate-700/50 text-slate-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-gray-200">
                        {items.filter(item => !item.category).length}
                      </span>
                    </div>
                  </div>

                  {/* Category Cards */}
                  {categoriesPending ? (
                    <div className="col-span-full py-12 text-center text-gray-400 text-sm">
                      Loading categories...
                    </div>
                  ) : (
                    categories.map(cat => {
                      const count = items.filter(item => {
                        const catId = item.category?._id || item.category;
                        return String(catId) === String(cat._id);
                      }).length;
                      return (
                        <div
                          key={cat._id}
                          onClick={() => setSelectedCategoryId(cat._id)}
                          className="cursor-pointer bg-white hover:bg-gray-50 border border-gray-200 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg flex flex-col justify-between min-h-[140px]"
                        >
                          <div>
                            <h4 className="font-bold text-base text-gray-900 mb-1 truncate">{cat.name}</h4>
                            <p className="text-slate-500 text-xs line-clamp-2">
                              {cat.description || 'No description provided.'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-4 border-t border-gray-200/40 pt-3">
                            <span className="text-xs text-gray-400 font-medium">Stock Items</span>
                            <span className="bg-brand-orange/10 text-amber-500 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Back to Categories breadcrumb */}
                <div className="flex items-center gap-2 mb-4 bg-white px-4 py-2.5 rounded-xl border border-gray-200 w-fit">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-brand-orange transition"
                  >
                    &larr; Back to Categories
                  </button>
                  <span className="text-slate-600 text-xs font-medium">/</span>
                  <span className="text-xs font-medium text-gray-900 truncate">
                    {selectedCategoryId === 'uncategorized'
                      ? 'Uncategorized Items'
                      : categories.find(c => c._id === selectedCategoryId)?.name || 'Category Items'}
                  </span>
                </div>

                {/* Standardized Search & Filter Header */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search inventory items by name..."
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <span className="text-xs text-gray-500 font-semibold font-sans flex items-center gap-1">
                      <Calculator size={13} /> Costing:
                    </span>
                    <select
                      value={selectedFormula}
                      onChange={(e) => setSelectedFormulaState(e.target.value)}
                      className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
                    >
                      {Object.keys(FORMULA_LABELS).map(key => (
                        <option key={key} value={key}>{FORMULA_LABELS[key]}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="relative self-end sm:self-auto" ref={filterContainerRef}>
                    <button
                      onClick={() => setShowFilters(f => !f)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                        filter !== 'all'
                          ? 'bg-brand-orange/10 border-amber-500/30 text-amber-500 font-semibold'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <SlidersHorizontal size={14} />
                      <span>Filters</span>
                      {filter !== 'all' && (
                        <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                          1
                        </span>
                      )}
                    </button>

                    {showFilters && (
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="text-xs font-semibold text-gray-700">Status Filter</span>
                          {filter !== 'all' && (
                            <button onClick={() => setFilter('all')} className="text-[10px] text-brand-orange hover:underline">Clear</button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { key: 'all', label: 'All Statuses' },
                            { key: 'ok', label: 'OK' },
                            { key: 'low', label: 'Low Stock' },
                            { key: 'critical', label: 'Critical' },
                          ].map(f => (
                            <button
                              key={f.key}
                              onClick={() => { setFilter(f.key); setShowFilters(false); }}
                              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition ${
                                filter === f.key
                                  ? 'bg-brand-orange/15 text-brand-orange font-semibold'
                                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {pageLoading ? (
                  <InventoryTableSkeleton />
                ) : viewMode === 'table' ? (
                  <ResponsiveTable
                    rows={filtered}
                    rowKey={(item) => item._id}
                    loading={false}
                    onSort={toggleSort}
                    currentSort={sort}
                    currentOrder={order}
                    emptyState={
                      <span className="flex flex-col items-center gap-2">
                        <Package size={36} className="opacity-30" />
                        No inventory items found
                      </span>
                    }
                    columns={[
                      {
                        key: 'name', header: 'Item Name',
                        mobilePrimary: true,
                        sortField: 'name',
                        render: (item) => <span className="font-medium text-gray-900">{item.itemName}</span>,
                      },
                      {
                        key: 'status', header: 'Status',
                        mobileSecondary: true,
                        render: (item) => {
                          const status = getStockStatus(item.quantity, item.minThreshold);
                          return <Badge label={status.label} variant={status.variant} />;
                        },
                      },
                      {
                        key: 'qty', header: 'Qty',
                        mobileRight: true,
                        className: 'text-right',
                        headerClassName: 'text-right',
                        sortField: 'quantity',
                        render: (item) => (
                          <span className="text-gray-900 font-semibold">{item.quantity}</span>
                        ),
                      },
                      {
                        key: 'unit', header: 'Unit',
                        render: (item) => <span className="text-gray-500">{item.unit}</span>,
                      },
                      {
                        key: 'unitCost', header: `Unit Cost (${FORMULA_LABELS[selectedFormula]})`,
                        className: 'text-right',
                        headerClassName: 'text-right',
                        render: (item) => {
                          const cost = item[FORMULA_FIELDS[selectedFormula]] || 0;
                          return <span className="text-gray-900 font-medium">{formatCurrency(cost)}</span>;
                        },
                      },
                      {
                        key: 'threshold', header: 'Min',
                        mobileLabel: 'Min Threshold',
                        render: (item) => <span className="text-gray-500">{item.minThreshold}</span>,
                      },
                      {
                        key: 'suppliers', header: 'Suppliers',
                        render: (item) => <SupplierPills suppliers={item.suppliers} />,
                      },
                      {
                        key: 'updated', header: 'Updated',
                        sortField: 'createdAt',
                        render: (item) => (
                          <span className="text-gray-400 text-xs">
                            {new Date(item.lastUpdated || item.updatedAt).toLocaleDateString()}
                          </span>
                        ),
                      },
                      {
                        key: 'actions', header: '', mobileHide: true,
                        render: (item) => (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setGraphItem(item)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-orange hover:bg-gray-100 transition"
                              title="View Stock Movements & Graph">
                              <LineChartIcon size={13} />
                            </button>
                            <button onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition"
                              title="Edit Item Details">
                              <Edit2 size={13} />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                  />
                ) : (
                  filtered.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                      <Package size={36} className="mx-auto opacity-30 mb-2 text-gray-500" />
                      <p className="text-sm text-gray-400">No inventory items found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filtered.map((item) => {
                        const status = getStockStatus(item.quantity, item.minThreshold);
                        return (
                          <div key={item._id} className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-gray-300 transition shadow-sm">
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="text-gray-900 font-bold text-sm truncate">{item.itemName}</h4>
                                <Badge label={status.label} variant={status.variant} className="text-[10px] px-1.5 py-0.5" />
                              </div>
                              <div className="grid grid-cols-3 gap-2 mt-3 bg-gray-50 rounded-lg p-2.5 text-xs border border-gray-150">
                                <div>
                                  <p className="text-[10px] text-gray-400">Quantity</p>
                                  <p className="font-semibold text-gray-800">{item.quantity} {item.unit}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-400">Min Threshold</p>
                                  <p className="font-semibold text-gray-800">{item.minThreshold} {item.unit}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-400">Unit Cost ({FORMULA_LABELS[selectedFormula]})</p>
                                  <p className="font-semibold text-gray-900">{formatCurrency(item[FORMULA_FIELDS[selectedFormula]] || 0)}</p>
                                </div>
                              </div>
                              <div className="mt-3">
                                <p className="text-[10px] text-gray-400 mb-1">Suppliers</p>
                                <SupplierPills suppliers={item.suppliers} />
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                              <span className="text-[10px] text-gray-400">
                                Updated: {new Date(item.lastUpdated || item.updatedAt).toLocaleDateString()}
                              </span>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setGraphItem(item)}
                                  className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-brand-orange hover:bg-gray-100 border border-gray-200 transition"
                                  title="View Stock Movements & Graph">
                                  <LineChartIcon size={13} />
                                </button>
                                <button onClick={() => openEdit(item)}
                                  className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition"
                                  title="Edit Item Details">
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
                <ListPagination
                  page={page}
                  pages={inventoryData.pages || 1}
                  total={inventoryData.total || 0}
                  onPageChange={setPage}
                  isFetching={invFetching}
                  className="mt-4"
                />
              </>
            )}
          </>
        )}

        {activeTab === 'prep-recipes' && <PrepRecipesManager storeId={selectedStoreId} />}
        {activeTab === 'count-sheets' && <CountSheetsManager storeId={selectedStoreId} />}
        {activeTab === 'transfers' && <StockTransfersManager storeId={selectedStoreId} />}
        {activeTab === 'wastage' && <WastageManagement hideHeader={true} hideStoreSelector={true} hideNavbar={true} />}

        {activeTab === 'adjustments' && <InventoryAdjustments />}

        {/* Adjustment History Tab */}
        {activeTab === 'sessions' && (
          <>
            {/* Standardized Search & Filter Header */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search sessions by user or notes..."
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500"
                />
                {sessionSearch && (
                  <button onClick={() => setSessionSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900">
                    <X size={14} />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                {/* View toggle */}
                <ViewModeToggle mode={sessionViewMode} setMode={handleSetSessionViewMode} />

                <div className="relative">
                  <button
                    onClick={() => setShowSessionFilters(f => !f)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      sessionStatus !== 'all'
                        ? 'bg-brand-orange/10 border-amber-500/30 text-brand-orange'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-950'
                    }`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Filters</span>
                    {sessionStatus !== 'all' && (
                      <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                        1
                      </span>
                    )}
                  </button>

                  {showSessionFilters && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <span className="text-xs font-semibold text-gray-700">Session Status</span>
                        {sessionStatus !== 'all' && (
                          <button onClick={() => setSessionStatus('all')} className="text-[10px] text-brand-orange hover:underline">Clear</button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {[
                          { key: 'all', label: 'All Statuses' },
                          { key: 'active', label: 'Active Sessions' },
                          { key: 'closed', label: 'Closed Sessions' },
                        ].map(st => (
                          <button
                            key={st.key}
                            onClick={() => { setSessionStatus(st.key); setShowSessionFilters(false); }}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition ${
                              sessionStatus === st.key
                                ? 'bg-brand-orange/15 text-brand-orange font-semibold'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Lists */}
            {sessionsPending ? (
              <div className="text-center py-12 text-gray-400">Loading history...</div>
            ) : sortedSessions.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Package size={36} className="mx-auto opacity-30 mb-2 text-gray-500" />
                <p className="text-sm text-gray-400">No adjustment sessions found</p>
              </div>
            ) : sessionViewMode === 'table' ? (
              <ResponsiveTable
                rows={sortedSessions}
                rowKey={(sess) => sess._id}
                loading={false}
                onSort={toggleSessionSort}
                currentSort={sessionSort}
                currentOrder={sessionOrder}
                columns={[
                  {
                    key: 'started', header: 'Date Started',
                    sortField: 'createdAt',
                    render: (sess) => (
                      <span className="text-xs text-gray-900 font-medium">
                        {new Date(sess.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    ),
                  },
                  {
                    key: 'user', header: 'Staff Member',
                    sortField: 'staff',
                    render: (sess) => (
                      <span className="text-xs text-gray-900 font-semibold">
                        {sess.userId?.name || 'Staff'}
                      </span>
                    ),
                  },
                  {
                    key: 'changes', header: 'Changes',
                    sortField: 'adjustments',
                    render: (sess) => (
                      <span className="text-xs text-brand-orange font-bold">
                        {sess.adjustmentCount} adjustments
                      </span>
                    ),
                  },
                  {
                    key: 'qtyChanged', header: 'Total Quantity',
                    sortField: 'totalQty',
                    render: (sess) => (
                      <span className="text-xs text-gray-500">
                        {sess.totalQuantityChanged} units
                      </span>
                    ),
                  },
                  {
                    key: 'status', header: 'Status',
                    sortField: 'status',
                    render: (sess) => (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${sess.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'}`}>
                        {sess.status}
                      </span>
                    ),
                  },
                  {
                    key: 'notes', header: 'Notes',
                    render: (sess) => (
                      <span className="text-xs text-gray-400 italic max-w-xs truncate block" title={sess.notes}>
                        {sess.notes || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions', header: '',
                    render: (sess) => (
                      <button onClick={() => setActiveSessionDetails(sess)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition"
                        title="View Session Details">
                        <Eye size={14} />
                      </button>
                    ),
                  },
                ]}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {sortedSessions.map((sess) => (
                  <div key={sess._id} className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-gray-300 transition shadow-sm">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sess.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'}`}>
                          {sess.status}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(sess.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-900 font-bold flex items-center gap-1.5 mt-1.5">
                        <User size={12} className="text-gray-400" />
                        {sess.userId?.name || 'Staff'}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-3 bg-gray-50 rounded-lg p-2 border border-gray-150">
                        <div>
                          <p className="text-[9px] uppercase text-gray-400 tracking-wide font-medium">Changes</p>
                          <p className="text-xs font-bold text-brand-orange">{sess.adjustmentCount}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-gray-400 tracking-wide font-medium">Total Qty</p>
                          <p className="text-xs font-bold text-gray-900">{sess.totalQuantityChanged}</p>
                        </div>
                      </div>
                      {sess.notes && (
                        <p className="text-xs text-gray-400 italic mt-2.5 border-t border-gray-100 pt-2 line-clamp-1">{sess.notes}</p>
                      )}
                    </div>
                    <button onClick={() => setActiveSessionDetails(sess)}
                      className="mt-3.5 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-semibold py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5">
                      <Eye size={12} />
                      View Movements
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ListPagination
              page={sessionPage}
              pages={sessionsData.pages || 1}
              total={sessionsData.total || 0}
              onPageChange={setSessionPage}
              isFetching={sessionsFetching}
              className="mt-4"
            />
          </>
        )}

        {/* ── Analytics Tab ── */}
        {activeTab === 'analytics' && (() => {
          const outOfStock = items.filter(i => i.quantity <= 0);
          const lowStock = items.filter(i => i.quantity > 0 && getStockStatus(i.quantity, i.minThreshold).variant !== 'ok');
          const okStock = items.filter(i => getStockStatus(i.quantity, i.minThreshold).variant === 'ok');

          // Category breakdown
          const catMap = {};
          categories.forEach(c => { catMap[c._id] = { name: c.name, count: 0, lowCount: 0 }; });
          items.forEach(item => {
            const catId = item.category?._id || item.category || 'uncategorized';
            if (!catMap[catId]) catMap[catId] = { name: item.category?.name || 'Uncategorized', count: 0, lowCount: 0 };
            catMap[catId].count++;
            if (getStockStatus(item.quantity, item.minThreshold).variant !== 'ok') catMap[catId].lowCount++;
          });
          const catData = Object.values(catMap).filter(c => c.count > 0);

          const PIE_COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#3b82f6'];

          // Consumption chart data from report
          const consumptionItems = (consumptionReport?.items || [])
            .filter(i => (i.theoreticalConsumed || 0) > 0)
            .sort((a, b) => (b.theoreticalConsumed || 0) - (a.theoreticalConsumed || 0))
            .slice(0, 10);

          return (
            <div className="space-y-6">
              {/* Date range selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-medium">Period:</span>
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => setAnalyticsDays(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      analyticsDays === d
                        ? 'bg-brand-orange text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Items', value: items.length, icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                  { label: 'Out of Stock', value: outOfStock.length, icon: Package, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                  { label: 'Low Stock', value: lowStock.length, icon: TrendingDown, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                  { label: 'Well Stocked', value: okStock.length, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-xl border p-4 flex items-start gap-3 ${stat.bg}`}>
                    <stat.icon size={20} className={`shrink-0 mt-0.5 ${stat.color}`} />
                    <div>
                      <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown Pie */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart2 size={15} className="text-brand-orange" /> Items by Category
                  </h3>
                  {catData.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">No category data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={catData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="name"
                        >
                          {catData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                          formatter={(val, name) => [`${val} items`, name]}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Low Stock Items Table */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-yellow-400" /> Items Needing Attention
                  </h3>
                  {outOfStock.length + lowStock.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <TrendingUp size={28} className="text-green-400 opacity-70" />
                      <p className="text-sm text-gray-500">All items are well stocked!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {[...outOfStock, ...lowStock].map(item => {
                        const status = getStockStatus(item.quantity, item.minThreshold);
                        return (
                          <div key={item._id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{item.itemName}</p>
                              <p className="text-[10px] text-gray-400">{item.category?.name || 'Uncategorized'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-xs font-bold ${status.variant === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                                {item.quantity} {item.unit}
                              </p>
                              <p className="text-[10px] text-gray-400">min: {item.minThreshold}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Consumption Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <LineChartIcon size={15} className="text-purple-400" /> Top Consumed Ingredients (last {analyticsDays} days)
                  </h3>
                  {consumptionReport && (
                    <span className="text-xs text-gray-400">{consumptionReport.summary?.totalOrders || 0} orders</span>
                  )}
                </div>
                {consumptionPending ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
                ) : consumptionItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <LineChartIcon size={28} className="text-slate-600 opacity-50" />
                    <p className="text-sm text-gray-400">No consumption data for this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={consumptionItems} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="itemName"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        width={110}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        formatter={(val) => [`${val} ${''} units`, 'Consumed']}
                        cursor={{ fill: 'rgba(245,158,11,0.07)' }}
                      />
                      <Bar dataKey="theoreticalConsumed" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={14} name="Consumed" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Inventory Item' : 'Add Inventory Item'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Item Name *</label>
            <input type="text" value={form.itemName}
              onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
              placeholder="e.g. Burger Buns" required
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
            <select value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">None (Uncategorized)</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Unit *</label>
            <select value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              required
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              {PREDEFINED_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            {form.unit === 'other' && (
              <input
                type="text"
                value={customUnit}
                onChange={e => setCustomUnit(e.target.value)}
                placeholder="Enter custom unit (e.g. tray, dozen)"
                required
                className="mt-2 w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Minimum Threshold *</label>
            <input type="number" min="0" step="0.01" value={form.minThreshold}
              onChange={e => setForm(f => ({ ...f, minThreshold: e.target.value }))}
              placeholder="e.g. 50" required
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600" />
            <p className="text-xs text-gray-400 mt-1">Alert when quantity drops below this value</p>
          </div>

          {/* Supplier binding */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5"><Truck size={13} /> Suppliers</span>
            </label>
            {suppliers.length === 0 ? (
              <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                No suppliers added yet. Add suppliers from the Suppliers page first.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Selected suppliers as chips */}
                {form.suppliers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.suppliers.map(sId => {
                      const supplier = suppliers.find(s => s._id === sId);
                      if (!supplier) return null;
                      return (
                        <span
                          key={sId}
                          className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full px-3 py-1.5 text-sm font-medium"
                        >
                          <Truck size={12} />
                          {supplier.name}
                          <button
                            type="button"
                            onClick={() => removeSupplier(sId)}
                            className="ml-1 text-purple-300 hover:text-purple-100 transition"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* Searchable dropdown */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={e => setSupplierSearch(e.target.value)}
                      placeholder="Search suppliers to add..."
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
                    />
                  </div>
                  {supplierSearch && filteredSuppliers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredSuppliers
                        .filter(s => !form.suppliers.includes(s._id))
                        .map(s => (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, suppliers: [...f.suppliers, s._id] }));
                              setSupplierSearch('');
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition flex items-center gap-2 text-sm text-gray-900"
                          >
                            <Truck size={14} className="text-purple-400" />
                            <span>{s.name}</span>
                            {s.contact && <span className="text-gray-400 text-xs ml-auto">{s.contact}</span>}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeSlide}
              className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
              {isPending ? 'Saving...' : (editing ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* Category Management SlideOver */}
      <SlideOver
        open={manageCategoriesOpen}
        onClose={() => {
          setManageCategoriesOpen(false);
          setEditingCategory(null);
          setCategoryForm({ name: '', description: '' });
          setCategoryError('');
        }}
        title="Manage Inventory Categories"
      >
        <div className="space-y-6">
          {/* Add / Edit Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCategoryError('');
              if (!categoryForm.name.trim()) return setCategoryError('Category name is required');
              if (editingCategory) {
                updateCategoryMutation.mutate({ id: editingCategory._id, data: categoryForm });
              } else {
                createCategoryMutation.mutate(categoryForm);
              }
            }}
            className="space-y-4 bg-gray-50 border border-gray-200/50 rounded-2xl p-4"
          >
            <h4 className="text-sm font-semibold text-gray-900">
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h4>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sauces & Dressings"
                required
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={categoryForm.description}
                onChange={e => setCategoryForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description..."
                rows={2}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600 resize-none"
              />
            </div>

            {categoryError && (
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                {categoryError}
              </div>
            )}

            <div className="flex gap-2">
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '' }); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold py-1.5 rounded-xl transition text-xs"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold py-1.5 rounded-xl transition text-xs disabled:opacity-60"
              >
                {editingCategory ? 'Save' : 'Create'}
              </button>
            </div>
          </form>

          {/* List of Categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200/50 pb-2">
              Existing Categories ({categories.length})
            </h4>

            {categoriesPending ? (
              <div className="text-xs text-gray-400 text-center py-4">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4 bg-white border border-gray-200/40 rounded-xl">
                No categories created yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {categories.map(cat => (
                  <div
                    key={cat._id}
                    className="flex items-start justify-between bg-white border border-gray-200/50 hover:border-gray-300 rounded-xl p-3 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">{cat.name}</p>
                      {cat.description && (
                        <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryForm({ name: cat.name, description: cat.description || '' });
                        }}
                        className="p-1 text-gray-500 hover:text-brand-orange transition"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${cat.name}"? Linked items will become Uncategorized.`)) {
                            deleteCategoryMutation.mutate(cat._id);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SlideOver>

      {/* Storage Areas Management SlideOver */}
      <SlideOver
        open={manageStorageAreasOpen}
        onClose={() => {
          setManageStorageAreasOpen(false);
          setEditingStorageArea(null);
          setStorageAreaForm({ name: '' });
          setStorageAreaError('');
        }}
        title="Manage Storage Areas"
      >
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStorageAreaError('');
              if (!storageAreaForm.name.trim()) return setStorageAreaError('Name is required');
              createStorageAreaMutation.mutate(storageAreaForm);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">New Storage Area Name *</label>
              <input
                type="text"
                value={storageAreaForm.name}
                onChange={(e) => setStorageAreaForm({ name: e.target.value })}
                placeholder="e.g. Walk-in Freezer, Shelf A"
                required
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
              />
            </div>
            {storageAreaError && (
              <p className="text-xs text-red-500 font-semibold">{storageAreaError}</p>
            )}
            <button
              type="submit"
              disabled={createStorageAreaMutation.isPending}
              className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold py-2 rounded-xl transition text-xs disabled:opacity-60"
            >
              {createStorageAreaMutation.isPending ? 'Creating...' : 'Create Storage Area'}
            </button>
          </form>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200/50 pb-2">
              Existing Storage Areas ({storageAreas.length})
            </h4>

            {storageAreasPending ? (
              <div className="text-xs text-gray-400 text-center py-4">Loading storage areas...</div>
            ) : storageAreas.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4 bg-white border border-gray-200/40 rounded-xl">
                No storage areas created yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {storageAreas.map(area => (
                  <div
                    key={area._id}
                    className="flex items-center justify-between bg-white border border-gray-200/50 hover:border-gray-300 rounded-xl p-3 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">{area.name}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete storage area "${area.name}"?`)) {
                            deleteStorageAreaMutation.mutate(area._id);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SlideOver>

      {/* Stock Movements Graph & Table Modal */}
      {graphItem && (
        <div
          className="fixed inset-0 bg-gray-50/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (window.innerWidth >= 640 && e.target === e.currentTarget) setGraphItem(null);
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Stock Movements & History</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Historical stock levels and audit logs for <span className="font-semibold text-brand-orange">{graphItem.itemName}</span> ({graphItem.unit})
                </p>
              </div>
              <button onClick={() => setGraphItem(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition">
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-6 flex-1">
              {itemMovementsPending ? (
                <div className="text-center py-12 text-gray-400">Loading movement history...</div>
              ) : itemMovements.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                  <Package size={40} className="mx-auto text-slate-600 opacity-35 mb-2" />
                  <p className="text-sm text-gray-400">No stock movements recorded for this item yet.</p>
                </div>
              ) : (
                <>
                  {/* Recharts Graph Container */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Stock Level Trend (Last 50 changes)</h3>
                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...itemMovements].reverse().map(m => ({
                          date: new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                          stock: m.newQty,
                        }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--pos-panel)', borderColor: '#475569', borderRadius: '12px', color: 'var(--pos-text-primary)' }}
                            labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#f59e0b' }}
                            itemStyle={{ fontSize: '12px' }}
                          />
                          <Line type="monotone" dataKey="stock" name="Stock Level" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', strokeWidth: 1 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Movements Table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Detailed Movements Audit Log</h3>
                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-white border-b border-gray-200 text-gray-500 font-medium uppercase tracking-wider">
                            <th className="p-3">Date & Time</th>
                            <th className="p-3">Type</th>
                            <th className="p-3 text-right">Prev</th>
                            <th className="p-3 text-right">Change</th>
                            <th className="p-3 text-right">New Qty</th>
                            <th className="p-3">Reason / Notes</th>
                            <th className="p-3">Staff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {itemMovements.map((m) => {
                            const MOVEMENT_TYPE_BADGES = {
                              sale: { label: 'Sale', variant: 'low' },
                              adjustment: { label: 'Adjustment', variant: 'warning' },
                              grn: { label: 'GRN', variant: 'ok' },
                              wastage: { label: 'Wastage', variant: 'critical' },
                              return: { label: 'Return', variant: 'critical' },
                              po: { label: 'PO', variant: 'info' },
                            };
                            const badge = MOVEMENT_TYPE_BADGES[m.type] || { label: m.type?.toUpperCase().replace('_', ' ') || 'OTHER', variant: 'info' };
                            const changeQty = m.quantity;
                            const isPositive = changeQty > 0;
                            return (
                              <tr key={m._id} className="hover:bg-gray-100/40 transition">
                                <td className="p-3 text-slate-400 whitespace-nowrap">
                                  {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                </td>
                                <td className="p-3">
                                  <Badge label={badge.label} variant={badge.variant} className="text-[10px] px-1.5 py-0.5" />
                                </td>
                                <td className="p-3 text-right text-gray-400 font-medium">{m.previousQty}</td>
                                <td className={`p-3 text-right font-bold ${isPositive ? 'text-green-500' : changeQty < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                  {isPositive ? `+${changeQty}` : changeQty}
                                </td>
                                <td className="p-3 text-right text-slate-300 font-semibold">{m.newQty}</td>
                                <td className="p-3 text-gray-500 max-w-[200px] truncate" title={m.notes || m.reason || ''}>
                                  {m.notes || m.reason || <span className="text-slate-600">—</span>}
                                </td>
                                <td className="p-3 text-slate-300 font-medium">{m.createdBy?.name || 'System'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 bg-white p-4 flex justify-end rounded-b-2xl">
              <button onClick={() => setGraphItem(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {activeSessionDetails && (
        <div
          className="fixed inset-0 bg-gray-50/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (window.innerWidth >= 640 && e.target === e.currentTarget) setActiveSessionDetails(null);
          }}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Adjustment Session Details</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Started on <span className="font-semibold text-amber-600">{new Date(activeSessionDetails.createdAt).toLocaleString()}</span>
                </p>
              </div>
              <button onClick={() => setActiveSessionDetails(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition">
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                <div>
                  <p className="text-[10px] uppercase text-gray-400 tracking-wider">Staff Member</p>
                  <p className="text-sm font-semibold text-gray-900">{activeSessionDetails.userId?.name || 'Staff'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-400 tracking-wider">Status</p>
                  <p className="text-sm font-semibold">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${activeSessionDetails.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {activeSessionDetails.status}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-400 tracking-wider">Total Adjustments</p>
                  <p className="text-sm font-semibold text-amber-600">{activeSessionDetails.adjustmentCount} items adjusted</p>
                </div>
              </div>

              {activeSessionDetails.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-gray-600">
                  <span className="font-semibold text-amber-700 block mb-0.5">Session Notes:</span>
                  {activeSessionDetails.notes}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Stock Changes</h3>
                {movementsPending ? (
                  <div className="text-center py-8 text-gray-400">Loading adjustments list...</div>
                ) : sessionMovements.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 italic bg-gray-50 rounded-xl border border-gray-200">
                    No stock movements recorded in this session.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                          <th className="p-3">Inventory Item</th>
                          <th className="p-3 text-right">Technical Qty</th>
                          <th className="p-3 text-right">Actual Qty</th>
                          <th className="p-3 text-right">Variance</th>
                          <th className="p-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sessionMovements.map((m) => {
                          const changeQty = m.quantity;
                          const isPositive = changeQty > 0;
                          const technicalQty = m.previousQty;
                          const actualQty = m.newQty;
                          return (
                            <tr key={m._id} className="hover:bg-gray-50/60 transition">
                              <td className="p-3 font-semibold text-gray-800">
                                {m.inventoryItemId?.itemName || 'Unknown Item'}
                                {m.inventoryItemId?.unit && <span className="text-[10px] text-gray-400 ml-1.5">({m.inventoryItemId.unit})</span>}
                              </td>
                              <td className="p-3 text-right text-gray-500 font-medium">{technicalQty}</td>
                              <td className="p-3 text-right font-semibold text-gray-800">{actualQty}</td>
                              <td className={`p-3 text-right font-bold ${isPositive ? 'text-green-600' : changeQty < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {isPositive ? `+${changeQty}` : changeQty}
                              </td>
                              <td className="p-3 text-gray-400 truncate max-w-[200px]" title={m.notes || ''}>
                                {m.notes || <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 bg-white p-4 flex justify-end rounded-b-2xl">
              <button onClick={() => setActiveSessionDetails(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Inventory Items"
        fields={getInventoryImportFields()}
        onImport={handleImportInventory}
        templateName="inventory_items"
        instructions={[
          "Fields marked with * are required.",
          "Unit: The stock unit of measure (e.g., kg, g, L, pcs, box).",
          "Current Stock: Enter the starting stock value (number) for this item. Defaults to 0 if left blank.",
          "Min Threshold: The minimum stock level before warning of critical stock (must be >= 0).",
          "Suppliers: Comma-separated supplier names (e.g., Supplier A, Supplier B). If a supplier does not exist, it will be automatically created on-the-fly.",
          "If some rows fail, a CSV error log will be automatically downloaded with instructions."
        ]}
      />
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={clearToast} />}
    </div>
  );
}
