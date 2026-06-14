import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Link2,
  ChevronDown, ChevronUp, Tag, GripVertical, Search, LayoutGrid, List,
  Download, Upload, Phone, X,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import CategoryManagerModal from '../../components/CategoryManagerModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import MenuItemFormModal from '../../components/menu/MenuItemFormModal';
import MenuItemTable from '../../components/menu/MenuItemTable';
import ImportModal from '../../components/ImportModal';
import ProfitabilityAnalytics from '../../components/menu/ProfitabilityAnalytics';
import { COMBO_CATEGORY_NAME, isSelectableMenuCategory } from '../../constants/categories';
import { useDragReorder, reorderByDrag } from '../../hooks/useDragReorder';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import { formatCurrency, getItemDisplayPrice } from '../../utils/format';
import { compareSortValues, buildCategorySortMap, scopeMenuItemsByCategory, sortMenuItemsForDisplay } from '../../utils/menuItemSearch';
import { useStoreContext } from '../../context/StoreContext';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
import { 
  exportMenuItemsToCSV, 
  getMenuItemImportFields, 
  validateMenuItemRow 
} from '../../utils/csvExportImport';
import { MenuGridSkeleton } from '../../components/StoreSkeletons';
import PageHeader from '../../components/PageHeader';

const EMPTY_FORM = {
  name: '', category: '', price: '', description: '', images: [],
  available: true, isCombo: false, comboItems: [],
  hasVariants: false, variantOptions: [], variants: [], defaultVariantId: null,
  channelPrices: {}, ingredients: [],
};

function menuQueryKey(storeId) {
  return ['menu', storeId];
}

function applyMenuReorder(allItems, orderedIds, category) {
  const idOrder = orderedIds.map(String);
  const idSet = new Set(idOrder);
  const categoryItems = (allItems || []).filter((i) => i.category === category);
  const otherItems = (allItems || []).filter((i) => i.category !== category);

  const reordered = idOrder.map((id, index) => {
    const item = categoryItems.find((i) => String(i._id) === id);
    return item ? { ...item, sortOrder: index } : null;
  }).filter(Boolean);

  const leftover = categoryItems.filter((i) => !idSet.has(String(i._id)));
  return [...otherItems, ...reordered, ...leftover];
}

function ComboItemsPreview({ comboItems }) {
  const [open, setOpen] = useState(false);
  if (!comboItems?.length) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-brand-orange/70 hover:text-brand-orange">
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {comboItems.length} item{comboItems.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {comboItems.map((ci, i) => (
            <li key={i} className="text-xs text-gray-400">• {ci.name} ×{ci.qty}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MenuManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
  const { data: paidAddons } = useTenantPaidAddons();
  const whatsappAddonActive = paidAddons?.whatsapp === true;

  const activeMenuTab = location.pathname.endsWith('/profitability') ? 'profitability' : 'items';
  const setActiveMenuTab = (tab) => navigate(`/menu/${tab}`);

  useEffect(() => {
    if (location.pathname === '/menu' || location.pathname === '/menu/') {
      navigate('/menu/items', { replace: true });
    }
  }, [location.pathname, navigate]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_menu_management');
    if (saved) return saved;
    return 'grid';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_menu_management', mode);
  };
  const [importModalOpen, setImportModalOpen] = useState(false);
  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();
  const [sortCriteria, setSortCriteria] = useState('custom');

  // Reset category & search when the selected store changes
  const [prevStoreId, setPrevStoreId] = useState(selectedStoreId);
  if (selectedStoreId !== prevStoreId) {
    setPrevStoreId(selectedStoreId);
    setActiveCategory('All');
    setMenuSearch('');
  }

  // Infinite Scroll States & Logic
  const [visibleCount, setVisibleCount] = useState(20);
  const infiniteScrollTriggerRef = useRef(null);

  useEffect(() => {
    setVisibleCount(20);
  }, [activeCategory, menuSearch, sortCriteria]);


  const sort = useMemo(() => {
    if (sortCriteria === 'name-asc' || sortCriteria === 'name-desc') return 'name';
    if (sortCriteria === 'price-asc' || sortCriteria === 'price-desc') return 'price';
    if (sortCriteria === 'newest' || sortCriteria === 'oldest') return 'createdAt';
    if (sortCriteria === 'status') return 'available';
    return 'sortOrder';
  }, [sortCriteria]);

  const order = useMemo(() => {
    if (sortCriteria === 'name-desc' || sortCriteria === 'price-desc' || sortCriteria === 'newest') return 'desc';
    return 'asc';
  }, [sortCriteria]);

  const toggleSort = useCallback((field) => {
    setSortCriteria((current) => {
      if (field === 'name') {
        return current === 'name-asc' ? 'name-desc' : 'name-asc';
      }
      if (field === 'price') {
        return current === 'price-asc' ? 'price-desc' : 'price-asc';
      }
      if (field === 'createdAt') {
        return current === 'newest' ? 'oldest' : 'newest';
      }
      if (field === 'available') {
        return current === 'status' ? 'custom' : 'status';
      }
      return 'custom';
    });
  }, []);

  const menuKey = menuQueryKey(selectedStoreId);

  const syncMenu = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['menu'] });
  }, [qc]);

  const { data: savedCriteria = [] } = useQuery({
    queryKey: ['variant-criteria', selectedStoreId],
    queryFn: () => api.get('/variant-criteria').then((r) => r.data),
    enabled: isStoreReady,
  });

  const saveCriteriaMutation = useMutation({
    mutationFn: (data) => api.post('/variant-criteria', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variant-criteria'] }),
  });



  const { data: items = [], isPending: menuPending } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then((r) => r.data),
    enabled: isStoreReady,
  });

  const { data: allCategories = [], isPending: categoriesPending } = useQuery({
    queryKey: ['categories', 'all', selectedStoreId],
    queryFn: () => api.get('/categories?all=true').then((r) => r.data),
    enabled: isStoreReady,
  });

  const menuLoading = !isStoreReady || menuPending || categoriesPending;
  const activeCategories = useMemo(() =>
    allCategories
      .filter((c) => c.active)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name)),
    [allCategories]);
  const categoryNames = useMemo(() => activeCategories.map((c) => c.name), [activeCategories]);
  const selectableCategoryNames = useMemo(() => activeCategories
    .filter((c) => isSelectableMenuCategory(c.name))
    .map((c) => c.name), [activeCategories]);


  const reorderMenuMutation = useMutation({
    mutationFn: ({ ids, category }) => api.patch('/menu/reorder', { ids, category }),
    onMutate: async ({ ids, category }) => {
      await qc.cancelQueries({ queryKey: menuKey });
      const previous = qc.getQueryData(menuKey) || [];
      qc.setQueryData(menuKey, applyMenuReorder(previous, ids, category));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(menuKey, ctx.previous);
      showToast(getApiErrorMessage(err, 'Failed to reorder menu items'));
    },
    onSuccess: () => syncMenu(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/menu', data).then((r) => r.data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: menuKey });
      const previous = qc.getQueryData(menuKey) || [];
      const inCategory = previous.filter((i) => i.category === data.category);
      const minSort = inCategory.reduce((min, i) => Math.min(min, i.sortOrder ?? 0), 0);
      const formSnapshot = { editing, form: { ...form } };
      const optimistic = {
        _id: `temp-${Date.now()}`,
        ...data,
        sortOrder: minSort - 1,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData(menuKey, [optimistic, ...previous]);
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError('');
      return { previous, formSnapshot };
    },
    onError: (err, _data, ctx) => {
      if (ctx?.previous) qc.setQueryData(menuKey, ctx.previous);
      if (ctx?.formSnapshot) {
        setEditing(ctx.formSnapshot.editing);
        setForm(ctx.formSnapshot.form);
        setFormOpen(true);
      }
      showToast(getApiErrorMessage(err, 'Failed to save item'));
    },
    onSuccess: () => syncMenu(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/menu/${id}`, data).then((r) => r.data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: menuKey });
      const previous = qc.getQueryData(menuKey) || [];
      const formSnapshot = { editing, form: { ...form } };
      qc.setQueryData(
        menuKey,
        previous.map((item) => (String(item._id) === String(id) ? { ...item, ...data } : item)),
      );
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormError('');
      return { previous, formSnapshot };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(menuKey, ctx.previous);
      if (ctx?.formSnapshot) {
        setEditing(ctx.formSnapshot.editing);
        setForm(ctx.formSnapshot.form);
        setFormOpen(true);
      }
      showToast(getApiErrorMessage(err, 'Failed to save item'));
    },
    onSuccess: () => syncMenu(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/menu/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: menuKey });
      const previous = qc.getQueryData(menuKey) || [];
      qc.setQueryData(
        menuKey,
        previous.filter((item) => String(item._id) !== String(id)),
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(menuKey, ctx.previous);
      showToast(getApiErrorMessage(err, 'Failed to delete menu item'));
    },
    onSuccess: () => syncMenu(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }) => api.put(`/menu/${id}`, { available }),
    onMutate: async ({ id, available }) => {
      await qc.cancelQueries({ queryKey: menuKey });
      const previous = qc.getQueryData(menuKey) || [];
      qc.setQueryData(
        menuKey,
        previous.map((item) => (String(item._id) === String(id) ? { ...item, available } : item)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(menuKey, ctx.previous);
      showToast(getApiErrorMessage(err, 'Failed to update availability'));
    },
    onSuccess: () => syncMenu(),
  });

  const openAdd = useCallback(() => {
    setEditing(null);
    const defaultCategory =
      activeCategory !== 'All' && selectableCategoryNames.includes(activeCategory)
        ? activeCategory
        : selectableCategoryNames[0] || '';
    setForm({ ...EMPTY_FORM, category: defaultCategory });
    setFormError('');
    setFormOpen(true);
  }, [activeCategory, selectableCategoryNames]);

  const openEdit = (item) => {
    setEditing(item);
    const images =
      item.images?.length > 0
        ? item.images.map((x) => ({ url: x.url || '', key: x.key || '' }))
        : item.image || item.imageKey
          ? [{ url: item.image || '', key: item.imageKey || '' }]
          : [];
    setForm({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description,
      images,
      available: item.available,
      isCombo: item.isCombo || false,
      comboItems: item.comboItems || [],
      hasVariants: item.hasVariants || false,
      variantOptions: item.variantOptions || [],
      variants: item.variants || [],
      defaultVariantId: item.defaultVariantId || null,
      channelPrices: item.channelPrices || {},
    });
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const rawPrice = Number(form.price);
    const price = Number.isFinite(rawPrice) ? Math.round(rawPrice * 100) / 100 : NaN;
    if (!form.name.trim()) return setFormError('Name is required');
    if (!form.hasVariants && (Number.isNaN(price) || price < 0)) return setFormError('Price must be a positive number');
    if (form.isCombo && form.comboItems.length === 0) {
      return setFormError('A combo must have at least one item added');
    }

    if (form.hasVariants) {
      if (!form.variantOptions?.length) {
        return setFormError('At least one option (Size or Flavor) is required when variants are enabled');
      }
      const hasEmptyValues = form.variantOptions.some((opt) => !opt.values || opt.values.length === 0);
      if (hasEmptyValues) {
        return setFormError('All option groups must have at least one value');
      }
      if (!form.variants || form.variants.length === 0) {
        return setFormError('No variants generated');
      }
      for (const v of form.variants) {
        const vp = Number(v.price);
        if (v.available && (Number.isNaN(vp) || vp < 0)) {
          return setFormError(`Price for variant "${v.name}" must be a positive number`);
        }
      }
    }

    const payload = {
      name: form.name.trim(),
      category: form.isCombo ? COMBO_CATEGORY_NAME : form.category,
      price: form.hasVariants ? 0 : price,
      description: form.description,
      images: form.images,
      available: form.available,
      isCombo: form.isCombo,
      comboItems: form.isCombo ? form.comboItems : [],
      hasVariants: form.hasVariants,
      variantOptions: form.hasVariants ? form.variantOptions : [],
      variants: form.hasVariants ? form.variants : [],
      defaultVariantId: form.hasVariants ? form.defaultVariantId : null,
      channelPrices: form.channelPrices || {},
      ingredients: form.ingredients || [],
    };
    if (editing) updateMutation.mutate({ id: editing._id, data: payload });
    else createMutation.mutate(payload);
  };

  const categorySortMap = useMemo(
    () => buildCategorySortMap(activeCategories),
    [activeCategories],
  );

  const categoryFiltered = useMemo(
    () => scopeMenuItemsByCategory(items, activeCategory, menuSearch),
    [items, activeCategory, menuSearch],
  );

  const orderedBySortOrder = useMemo(
    () => sortMenuItemsForDisplay(categoryFiltered, {
      activeCategory,
      categorySortMap,
      menuSearch,
    }),
    [categoryFiltered, activeCategory, categorySortMap, menuSearch],
  );

  const displayed = useMemo(() => {
    let result = [...categoryFiltered];

    if (sortCriteria === 'custom') {
      return sortMenuItemsForDisplay(result, {
        activeCategory,
        categorySortMap,
        menuSearch,
      });
    }

    const dir = order === 'asc' ? 1 : -1;
    const field = sort;

    return result.sort((a, b) => {
      if (field === 'createdAt') {
        return compareSortValues(new Date(a.createdAt || 0).getTime(), new Date(b.createdAt || 0).getTime(), dir);
      }
      if (field === 'price') {
        const priceA = getItemDisplayPrice(a).price;
        const priceB = getItemDisplayPrice(b).price;
        return compareSortValues(priceA, priceB, dir);
      }
      if (field === 'available') {
        return compareSortValues(a.available ? 1 : 0, b.available ? 1 : 0, dir);
      }
      if (field === 'category') {
        return compareSortValues(a.category || '', b.category || '', dir);
      }
      if (field === 'name') {
        return compareSortValues(a.name || '', b.name || '', dir);
      }
      return compareSortValues(a[field], b[field], dir);
    });
  }, [categoryFiltered, sortCriteria, sort, order, activeCategory, categorySortMap, menuSearch]);

  useEffect(() => {
    if (viewMode !== 'grid') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { rootMargin: '200px' }
    );
    const currentTrigger = infiniteScrollTriggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }
    return () => {
      if (currentTrigger) {
        observer.unobserve(currentTrigger);
      }
    };
  }, [viewMode, displayed.length]);

  const canDragProducts = activeCategory !== 'All' && sortCriteria === 'custom';

  const persistMenuReorder = useCallback((fromId, toId) => {
    const reordered = reorderByDrag(orderedBySortOrder, fromId, toId);
    if (!reordered) return;
    reorderMenuMutation.mutate({
      ids: reordered.map((i) => i._id),
      category: activeCategory,
    });
  }, [orderedBySortOrder, activeCategory, reorderMenuMutation]);

  const { bindHandle: menuDragHandle, bindDropTarget: menuDropTarget, isOver: menuDragOver } = useDragReorder(
    canDragProducts ? persistMenuReorder : () => {},
  );

  const deleteAffectedCombos = useMemo(() => {
    if (!deleteTarget) return [];
    return items.filter(
      (i) => i.isCombo && i.comboItems?.some((ci) => ci.menuItem === deleteTarget._id),
    );
  }, [deleteTarget, items]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const filterTabs = ['All', ...categoryNames];

  // Export handler
  const handleExportMenuItems = useCallback(() => {
    const itemsToExport = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);
    exportMenuItemsToCSV(itemsToExport);
    showToast(`Exported ${itemsToExport.length} menu items`, 'success');
  }, [items, activeCategory, showToast]);

  // Import handler with auto-category creation and variant support
  const handleImportMenuItems = useCallback(async (csvData, mapping, onProgress) => {
    const errors = [];
    let successCount = 0;
    const createdCategories = new Set(); // Track categories created during this import
    
    // Build a map of existing categories (case-insensitive)
    const existingCategoriesMap = new Map();
    allCategories.forEach(cat => {
      existingCategoriesMap.set(cat.name.toLowerCase(), cat.name);
    });
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const { item, errors: rowErrors } = validateMenuItemRow(row, mapping, i);
      
      if (rowErrors.length > 0) {
        errors.push({ rowIndex: i, message: rowErrors.join('; ') });
        onProgress({ total: csvData.length, current: i + 1, errors });
        continue;
      }
      
      try {
        // Check if category exists (case-insensitive)
        const categoryLower = item.category.toLowerCase();
        
        if (!existingCategoriesMap.has(categoryLower) && !createdCategories.has(categoryLower)) {
          // Category doesn't exist - create it first
          try {
            await api.post('/categories', { 
              name: item.category, // Use the exact case from CSV
              active: true,
              sortOrder: 0
            });
            // Track that we created this category
            existingCategoriesMap.set(categoryLower, item.category);
            createdCategories.add(categoryLower);
          } catch (catError) {
            // If category creation fails, log it but try to create the product anyway
            // (in case category was created by another concurrent import)
            console.warn(`Failed to create category "${item.category}":`, catError.message);
          }
        } else if (existingCategoriesMap.has(categoryLower)) {
          // Use the existing category name (preserves original case)
          item.category = existingCategoriesMap.get(categoryLower);
        }
        
        // Clean up variant data if present (remove temporary IDs)
        if (item.hasVariants && item.variants) {
          item.variants = item.variants.map(v => {
            const rest = { ...v };
            delete rest._id;
            return rest;
          });
        }
        
        // Create the menu item
        await api.post('/menu', item);
        successCount++;
      } catch (error) {
        errors.push({ 
          rowIndex: i, 
          message: error.response?.data?.message || error.message 
        });
      }
      
      onProgress({ total: csvData.length, current: i + 1, errors });
    }
    
    // Refresh both menu and categories after import
    await Promise.all([
      qc.invalidateQueries({ queryKey: menuKey }),
      qc.invalidateQueries({ queryKey: ['categories', 'all', selectedStoreId] })
    ]);
    
    // Show info about created categories
    if (createdCategories.size > 0) {
      const categoryList = Array.from(createdCategories).map(cat => 
        existingCategoriesMap.get(cat)
      ).join(', ');
      showToast(`Created ${createdCategories.size} new categories: ${categoryList}`, 'success');
    }
    
    return {
      total: csvData.length,
      success: successCount,
      errors,
      categoriesCreated: createdCategories.size
    };
  }, [menuKey, qc, allCategories, selectedStoreId, showToast]);

  const headerActions = useMemo(() => {
    const list = [
      { label: 'Export', icon: Download, onClick: handleExportMenuItems },
      { label: 'Import', icon: Upload, onClick: () => setImportModalOpen(true) },
      { label: 'Categories', icon: Tag, onClick: () => setCatModalOpen(true) },
    ];
    if (whatsappAddonActive) {
      list.push({
        label: 'WhatsApp Catalog',
        icon: Phone,
        onClick: () => navigate('/whatsapp-config'),
      });
    }
    list.push({ label: 'Add Item', icon: Plus, onClick: openAdd, primary: true });
    return list;
  }, [navigate, handleExportMenuItems, openAdd, whatsappAddonActive]);

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageHeader
          title="Menu Items"
          subtitle={
            activeMenuTab === 'items'
              ? `${items.length} items · ${items.filter((i) => i.isCombo).length} combos`
              : 'Recipe costs and profitability analysis'
          }
          actions={activeMenuTab === 'items' ? headerActions : []}
        />

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {[
            { key: 'items', label: 'Menu Items' },
            { key: 'profitability', label: 'Recipe Profitability' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveMenuTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition border-b-2 whitespace-nowrap shrink-0 ${
                activeMenuTab === tab.key
                  ? 'border-amber-500 text-brand-orange'
                  : 'border-transparent text-gray-500 hover:text-slate-355'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeMenuTab === 'items' ? (
          <>
            {/* Search + View Toggle */}
            <div className="flex flex-col gap-3 mb-4 bg-white p-3 rounded-xl border border-gray-200">
              {/* Row 1: Store picker + Search — full width */}
              <div className="flex items-center gap-2">
                {stores.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-gray-500 font-semibold hidden sm:block">Store:</span>
                    <select
                      value={selectedStoreId || ''}
                      onChange={(e) => selectStore(e.target.value)}
                      className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
                    >
                      {stores.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search menu items…"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg pl-10 pr-8 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-450"
                  />
                  {menuSearch && (
                    <button
                      type="button"
                      onClick={() => setMenuSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Sort + View toggle — wraps on mobile */}
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-semibold">Sort:</span>
                  <select
                    value={sortCriteria}
                    onChange={(e) => setSortCriteria(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="custom">Drag Order / Default</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="price-asc">Price (Low to High)</option>
                    <option value="price-desc">Price (High to Low)</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="status">Availability</option>
                  </select>
                </div>
                <div className="flex gap-1 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'table' ? 'bg-brand-orange text-white' : 'text-gray-650 hover:bg-gray-100 hover:text-gray-900'}`}
                  >
                    <List size={14} /> Table
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'grid' ? 'bg-brand-orange text-white' : 'text-gray-650 hover:bg-gray-100 hover:text-gray-900'}`}
                  >
                    <LayoutGrid size={14} /> Grid
                  </button>
                </div>
              </div>
            </div>

            {/* Sticky Category Tabs */}
            <div className="sticky top-[-16px] sm:top-[-24px] z-20 bg-gray-50 pt-[16px] sm:pt-[24px] pb-3 border-b border-gray-200 mb-5">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {filterTabs.map((cat) => (
                  <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition border ${
                      activeCategory === cat
                        ? 'bg-brand-orange text-white shadow-lg border-brand-orange shadow-amber-500/20'
                        : 'text-gray-650 hover:text-gray-950 bg-white hover:bg-gray-105 border-gray-200'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                {canDragProducts ? (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <GripVertical size={11} /> Drag products to reorder within {activeCategory}
                  </p>
                ) : sortCriteria !== 'custom' ? (
                  <p className="text-[11px] text-gray-400">Drag to reorder is disabled when sorted. Switch back to "Drag Order / Default" to reorder.</p>
                ) : (
                  <p className="text-[11px] text-gray-400">Select a category tab to drag and reorder products</p>
                )}
              </div>
            </div>

            {menuLoading ? (
              <MenuGridSkeleton cards={viewMode === 'grid' ? 15 : 8} />
            ) : viewMode === 'table' ? (
              <MenuItemTable
                items={displayed}
                sort={sort}
                order={order}
                toggleSort={toggleSort}
                canDrag={canDragProducts}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onToggleAvailable={(item) => toggleMutation.mutate({ id: item._id, available: !item.available })}
                menuDragHandle={menuDragHandle}
                menuDropTarget={menuDropTarget}
                menuDragOver={menuDragOver}
              />
            ) : (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {displayed.length === 0 && (
                    <div className="col-span-full text-center text-slate-655 py-16">No items match your filters</div>
                  )}
                  {displayed.slice(0, visibleCount).map((item) => {
                    const handleDrag = canDragProducts ? menuDragHandle(item._id) : {};
                    const dropTarget = canDragProducts ? menuDropTarget(item._id) : {};
                    return (
                      <div key={item._id}
                        {...dropTarget}
                        className={`bg-white rounded-2xl overflow-hidden border transition group ${
                          item.isCombo ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-gray-200/50 hover:border-gray-300'
                        } ${menuDragOver(item._id) ? 'ring-2 ring-amber-500/60' : ''}`}>
                        <div className="relative h-32 bg-gray-100 overflow-hidden border-b border-gray-100">
                          {canDragProducts && (
                            <div
                              {...handleDrag}
                              className="absolute top-2 left-2 z-10 w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-gray-500 cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical size={12} />
                            </div>
                          )}
                          {(item.images?.[0]?.url || item.image) ? (
                            <img src={item.images?.[0]?.url || item.image} alt={item.name} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">
                              {item.isCombo ? '🍱' : '🍔'}
                            </div>
                          )}
                          {item.isCombo && (
                            <div className={`absolute top-2 ${canDragProducts ? 'left-11' : 'left-2'}`}>
                              <span className="flex items-center gap-1 bg-brand-orange/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                <Link2 size={10} /> Combo
                              </span>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 transition flex gap-1 opacity-90 group-hover:opacity-100">
                            <button type="button" onClick={() => openEdit(item)}
                              className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 border border-gray-200 shadow-sm transition">
                              <Edit2 size={12} />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(item)}
                              className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center text-gray-500 hover:text-red-600 border border-gray-200 shadow-sm transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-gray-900 text-sm truncate" title={item.name}>{item.name}</p>
                          <p className="text-xs text-gray-500 mb-1">{item.category}</p>
                          {item.isCombo && <ComboItemsPreview comboItems={item.comboItems} />}
                          <div className="flex items-center justify-between mt-1">
                            {(() => {
                              const { price, prefix, hasVariants } = getItemDisplayPrice(item);
                              return (
                                <span className="text-brand-orange font-bold">
                                  {prefix && <span className="text-gray-400 font-normal text-[10px]">{prefix}</span>}
                                  {formatCurrency(price)}
                                  {hasVariants && <span className="text-sky-400 text-[10px] ml-1">({item.variants?.length || 0} var.)</span>}
                                </span>
                              );
                            })()}
                            <button type="button"
                              onClick={() => toggleMutation.mutate({ id: item._id, available: !item.available })}
                              className={`flex items-center gap-1 text-xs font-medium transition ${item.available ? 'text-green-400' : 'text-gray-400'}`}>
                              {item.available ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                              {item.available ? 'Active' : 'Hidden'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {displayed.length > visibleCount && (
                  <div ref={infiniteScrollTriggerRef} className="h-10 flex items-center justify-center my-4">
                    <span className="text-sm text-gray-500">Loading more items...</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <ProfitabilityAnalytics />
        )}
      </div>

      <CategoryManagerModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        categories={allCategories}
        menuItems={items}
        selectedStoreId={selectedStoreId}
      />

      <MenuItemFormModal
        open={formOpen}
        onClose={closeForm}
        editing={editing}
        form={form}
        setForm={setForm}
        formError={formError}
        items={items}
        selectableCategoryNames={selectableCategoryNames}
        savedCriteria={savedCriteria}
        saveCriteriaMutation={saveCriteriaMutation}
        onSubmit={handleSubmit}
        isPending={isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Menu Item"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(deleteTarget._id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="space-y-2">
            {deleteTarget.isCombo && deleteTarget.comboItems?.length > 0 && (
              <div className="bg-brand-orange/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-brand-orange">
                This combo includes {deleteTarget.comboItems.length} item{deleteTarget.comboItems.length !== 1 ? 's' : ''}.
              </div>
            )}
            {deleteTarget.hasVariants && deleteTarget.variants?.length > 0 && (
              <div className="bg-brand-orange/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-brand-orange">
                {deleteTarget.variants.length} variant{deleteTarget.variants.length !== 1 ? 's' : ''} will be removed.
              </div>
            )}
            {deleteAffectedCombos.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                Used in {deleteAffectedCombos.length} combo{deleteAffectedCombos.length !== 1 ? 's' : ''}:{' '}
                {deleteAffectedCombos.slice(0, 3).map((c) => c.name).join(', ')}
                {deleteAffectedCombos.length > 3 ? ` and ${deleteAffectedCombos.length - 3} more` : ''}
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>

      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Menu Items"
        fields={getMenuItemImportFields()}
        onImport={handleImportMenuItems}
        templateName="menu_items"
        instructions={[
          "Fields marked with * are required.",
          "Has Variants: Set to 'Yes' or 'No'. If 'Yes', leave Price blank and fill Variant Options & Variants columns.",
          "Variant Options format: Name:value1,value2|Name2:value1,value2 (e.g., Size:Small,Large|Flavor:Vanilla,Mocha).",
          "Variants format: OptionValue1 / OptionValue2:Price:Available|... (e.g., Small / Vanilla:4.50:1|Large / Vanilla:5.50:1). Price must be a number. Available must be 1 (active) or 0 (disabled). Use '/' as separator for attributes.",
          "Default Variant: The exact name matching one of your defined variants (e.g., Small / Vanilla).",
          "If some rows fail, a CSV error log will be automatically downloaded with instructions."
        ]}
      />

      <Toast toast={toast} onDismiss={clearToast} />
    </div>
  );
}
