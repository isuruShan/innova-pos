import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, Truck, Package, Search, X,
  Phone, Mail, MapPin, User, FileText, ChevronDown, ChevronRight, ArrowDown, ArrowUp,
  SlidersHorizontal, List, LayoutGrid, Download, Upload
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import SlideOver from '../../components/SlideOver';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { SupplierCardsSkeleton } from '../../components/StoreSkeletons';
import { useListSort } from '../../hooks/useListSort';
import { useBranding } from '../../context/BrandingContext';
import PosPhoneField, { validatePosPhoneField, phoneDisplayFromParts, parseStoredPhone } from '../../components/PosPhoneField';
import PageHeader from '../../components/PageHeader';
import Badge from '../../components/Badge';
import ResponsiveTable from '../../components/ResponsiveTable';
import ViewModeToggle from '../../components/ViewModeToggle';
import ImportModal from '../../components/ImportModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  exportSuppliersToCSV,
  getSupplierImportFields,
  validateSupplierRow
} from '../../utils/csvExportImport';

const SUPPLIER_SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created' },
];

const EMPTY_FORM = { name: '', contactPerson: '', email: '', phone: '', address: '', notes: '' };

function SupplierForm({
  form,
  setForm,
  phoneField,
  setPhoneField,
  onSubmit,
  onCancel,
  isPending,
  error,
  editing,
  phoneError
}) {
  const field = (key, label, placeholder, icon, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-500">
        {icon}
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {field('name', 'Supplier Name *', 'e.g. Fresh Foods Co.', <Truck size={14} className="text-slate-500 flex-shrink-0" />)}
      {field('contactPerson', 'Contact Person', 'e.g. John Smith', <User size={14} className="text-slate-500 flex-shrink-0" />)}
      
      <PosPhoneField
        countryIso={phoneField.countryIso}
        nationalDigits={phoneField.nationalDigits}
        onCountryIsoChange={(iso) => setPhoneField((p) => ({ ...p, countryIso: iso }))}
        onNationalDigitsChange={(d) => setPhoneField((p) => ({ ...p, nationalDigits: d }))}
        error={phoneError}
        label="Phone"
      />

      {field('email', 'Email', 'e.g. orders@freshfoods.com', <Mail size={14} className="text-slate-500 flex-shrink-0" />, 'email')}
      {field('address', 'Address', 'Street, City', <MapPin size={14} className="text-slate-500 flex-shrink-0" />)}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Delivery schedule, payment terms, etc."
          className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm">
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
          {isPending ? 'Saving…' : (editing ? 'Save Changes' : 'Add Supplier')}
        </button>
      </div>
    </form>
  );
}

function SupplierCard({ supplier, onEdit, onDelete, onToggleItems, expanded }) {
  return (
    <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-3.5 space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-purple-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[var(--pos-text-primary)] font-semibold text-sm truncate">{supplier.name}</h3>
            {supplier.contactPerson && (
              <p className="text-slate-500 text-xs truncate">{supplier.contactPerson}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(supplier)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(supplier._id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5">
        {supplier.phone && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Phone size={11} className="text-slate-600" /> {supplier.phone}
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Mail size={11} className="text-slate-600" /> {supplier.email}
          </div>
        )}
        {supplier.address && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin size={11} className="text-slate-600" /> {supplier.address}
          </div>
        )}
        {supplier.notes && (
          <div className="flex items-start gap-2 text-xs text-slate-500 italic border-t border-slate-700/40 pt-2 mt-2">
            <FileText size={11} className="text-slate-600 mt-0.5 flex-shrink-0" /> {supplier.notes}
          </div>
        )}
      </div>

      {/* Inventory item count toggle */}
      <button
        onClick={() => onToggleItems(supplier._id)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-amber-400 transition w-full"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Package size={12} />
        <span>{supplier.itemCount} inventory item{supplier.itemCount !== 1 ? 's' : ''} linked</span>
      </button>

      {/* Expanded items list */}
      {expanded && supplier.items && (
        <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 space-y-1.5">
          {supplier.items.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">No inventory items linked</p>
          ) : (
            supplier.items.map(item => (
              <div key={item._id} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{item.itemName}</span>
                <span className="text-slate-600">{item.quantity} {item.unit}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function SupplierManagement() {
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const branding = useBranding();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [phoneField, setPhoneField] = useState({ countryIso: 'LK', nationalDigits: '' });
  const [phoneError, setPhoneError] = useState('');
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [search, setSearch] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_supplier_management');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const selectedStore = useMemo(() => {
    return stores.find((s) => String(s._id) === String(selectedStoreId));
  }, [stores, selectedStoreId]);

  const isStoreUnderCentralKitchen = useMemo(() => {
    return selectedStore && selectedStore.replenishmentModel === 'central_kitchen';
  }, [selectedStore]);

  if (isStoreReady && isStoreUnderCentralKitchen) {
    return (
      <div className="min-h-screen bg-[var(--pos-page-bg)]">
        <Navbar groups={MANAGER_NAV_GROUPS} />
        <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
            <Truck size={32} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--pos-text-primary)] mb-2">Module Disabled</h2>
          <p className="text-slate-400 text-sm max-w-md">
            Replenishment and inventory for this store are managed via Stock Transfers from the Central Kitchen. Direct supplier management is not required at the store level.
          </p>
        </div>
      </div>
    );
  }

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_supplier_management', mode);
  };

  const [hasLinkedFilter, setHasLinkedFilter] = useState('all'); // 'all', 'linked', 'not_linked'
  const [showFilters, setShowFilters] = useState(false);
  const qc = useQueryClient();
  const { sort, order, toggleSort, sortParams, setSort, setOrder } = useListSort('name', 'asc');

  const { data: suppliers = [], isPending } = useQuery({
    queryKey: ['suppliers', selectedStoreId, sortParams],
    queryFn: () => api.get('/suppliers', { params: { sort, order } }).then(r => r.data),
    enabled: isStoreReady,
  });

  const filteredSuppliers = useMemo(() => {
    let result = suppliers;
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.contactPerson?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.phone?.toLowerCase().includes(query) ||
        s.notes?.toLowerCase().includes(query)
      );
    }
    if (hasLinkedFilter === 'linked') {
      result = result.filter(s => s.itemCount > 0);
    } else if (hasLinkedFilter === 'not_linked') {
      result = result.filter(s => s.itemCount === 0 || !s.itemCount);
    }
    return result;
  }, [suppliers, search, hasLinkedFilter]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['suppliers'] });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/suppliers', data),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/suppliers/${id}`, data),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e) => setFormError(e.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPhoneField({ countryIso: branding?.countryIso || 'LK', nationalDigits: '' });
    setPhoneError('');
    setFormError('');
    setSlideOpen(true);
  };
  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setPhoneField(parseStoredPhone(supplier.phone, branding?.countryIso || 'LK'));
    setPhoneError('');
    setFormError('');
    setSlideOpen(true);
  };
  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setPhoneField({ countryIso: branding?.countryIso || 'LK', nationalDigits: '' });
    setPhoneError('');
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setPhoneError('');
    if (!form.name.trim()) return setFormError('Supplier name is required');

    // Run phone validation if phone number is provided
    if (phoneField.nationalDigits.trim()) {
      const err = validatePosPhoneField(phoneField.countryIso, phoneField.nationalDigits);
      if (err) {
        setPhoneError(err);
        return;
      }
    }

    const phoneDisplay = phoneDisplayFromParts(phoneField.countryIso, phoneField.nationalDigits);
    const dataToSubmit = {
      ...form,
      phone: phoneDisplay,
    };

    if (editing) updateMutation.mutate({ id: editing._id, data: dataToSubmit });
    else createMutation.mutate(dataToSubmit);
  };

  const handleDelete = (id) => {
    const supplier = suppliers.find(s => s._id === id);
    if (supplier) {
      setSupplierToDelete(supplier);
    }
  };

  const handleExportSuppliers = () => {
    exportSuppliersToCSV(filteredSuppliers);
  };

  const handleImportSuppliers = async (csvData, mapping, onProgress) => {
    const errors = [];
    let successCount = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const { supplier, errors: rowErrors } = validateSupplierRow(row, mapping, i);

      if (rowErrors.length > 0) {
        errors.push({ rowIndex: i, message: rowErrors.join('; ') });
        onProgress({ total: csvData.length, current: i + 1, errors });
        continue;
      }

      try {
        await api.post('/suppliers', supplier);
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

    invalidate();

    return {
      total: csvData.length,
      success: successCount,
      errors
    };
  };

  const handleToggleItems = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedItems[id]) {
      const data = await api.get(`/suppliers/${id}`).then(r => r.data);
      setExpandedItems(prev => ({ ...prev, [id]: data.items }));
    }
  };

  const suppliersWithItems = filteredSuppliers.map(s => ({
    ...s,
    items: expandedItems[s._id],
  }));

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={<span className="flex items-center gap-2"><Truck size={20} className="text-purple-400" />Suppliers</span>}
          subtitle={search.trim() 
            ? `${filteredSuppliers.length} found (${suppliers.length} total)`
            : `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''} registered`
          }
          actions={[
            { label: 'Export', icon: Download, onClick: handleExportSuppliers },
            { label: 'Import', icon: Upload, onClick: () => setImportModalOpen(true) },
            { label: 'Add Supplier', icon: Plus, onClick: openAdd, primary: true },
          ]}
        />

        {/* Search + Controls row */}
        <div className="flex flex-col gap-3 mb-6 bg-[var(--pos-panel)] p-3 rounded-xl border border-slate-700/50">
          {/* Search — always full width */}
          <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search suppliers by name, contact, phone, email, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-655"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-slate-500 hover:text-white" /></button>
            )}
          </div>

          {/* Controls — wrap on mobile */}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* View toggle */}
            <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />

            <div className="relative">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  hasLinkedFilter !== 'all'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {hasLinkedFilter !== 'all' && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--pos-panel)]">
                    1
                  </span>
                )}
                <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--pos-panel)] border border-slate-700 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="text-xs font-semibold text-slate-350">Inventory Link</span>
                    {hasLinkedFilter !== 'all' && (
                      <button onClick={() => setHasLinkedFilter('all')} className="text-[10px] text-amber-450 hover:underline">Clear</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { key: 'all', label: 'All Suppliers' },
                      { key: 'linked', label: 'Has Linked Items' },
                      { key: 'not_linked', label: 'No Linked Items' },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => { setHasLinkedFilter(f.key); setShowFilters(false); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition ${
                          hasLinkedFilter === f.key
                            ? 'bg-amber-500/15 text-amber-400 font-semibold border-l-2 border-amber-500'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label htmlFor="supplier-sort" className="text-xs text-slate-550 shrink-0">Sort</label>
            <select
              id="supplier-sort"
              value={sort}
              onChange={(e) => {
                const next = e.target.value;
                if (next === sort) toggleSort(next);
                else { setSort(next); setOrder('asc'); }
              }}
              className="bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {SUPPLIER_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-lg bg-[var(--pos-surface-inset)] border border-slate-700 text-slate-400 hover:text-white transition"
              title={order === 'asc' ? 'Ascending' : 'Descending'}
            >
              {order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        </div>

        {!isStoreReady || isPending ? (
          <SupplierCardsSkeleton />
        ) : suppliers.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Truck size={52} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-semibold">No suppliers yet</p>
            <p className="text-sm mt-1 opacity-60">Add your first supplier to get started</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Search size={52} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-semibold">No matching suppliers</p>
            <p className="text-sm mt-1 opacity-60">Try adjusting your search query</p>
          </div>
        ) : viewMode === 'table' ? (
          <ResponsiveTable
            rows={suppliersWithItems}
            rowKey={(s) => s._id}
            loading={false}
            columns={[
              {
                key: 'name', header: 'Supplier Name',
                mobilePrimary: true,
                render: (s) => (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Truck size={12} className="text-purple-400" />
                    </div>
                    <span className="font-semibold text-[var(--pos-text-primary)]">{s.name}</span>
                  </div>
                ),
              },
              {
                key: 'contact', header: 'Contact Person',
                mobileSecondary: true,
                render: (s) => <span className="text-slate-350">{s.contactPerson || '—'}</span>,
              },
              {
                key: 'phone', header: 'Phone',
                render: (s) => <span className="text-slate-400">{s.phone || '—'}</span>,
              },
              {
                key: 'email', header: 'Email',
                render: (s) => <span className="text-slate-400">{s.email || '—'}</span>,
              },
              {
                key: 'address', header: 'Address',
                render: (s) => <span className="text-slate-450 truncate max-w-xs block">{s.address || '—'}</span>,
              },
              {
                key: 'items', header: 'Linked Items',
                render: (s) => (
                  <div className="space-y-1">
                    <button
                      onClick={() => handleToggleItems(s._id)}
                      className="flex items-center gap-1 text-slate-400 hover:text-amber-450 transition"
                    >
                      {expandedId === s._id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className="font-semibold">{s.itemCount || 0} items</span>
                    </button>
                    {expandedId === s._id && s.items && (
                      <div className="bg-[var(--pos-surface-inset)] rounded-lg p-2 space-y-1 text-[10px] mt-1 border border-slate-800 max-h-24 overflow-y-auto">
                        {s.items.length === 0 ? (
                          <p className="text-slate-500 text-center">No linked items</p>
                        ) : (
                          s.items.map(item => (
                            <div key={item._id} className="flex items-center justify-between gap-2">
                              <span className="text-slate-355">{item.itemName}</span>
                              <span className="text-slate-555 shrink-0">{item.quantity} {item.unit}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'notes', header: 'Notes',
                render: (s) => <span className="text-slate-500 italic truncate max-w-[120px] block" title={s.notes}>{s.notes || '—'}</span>,
              },
              {
                key: 'actions', header: '',
                render: (s) => (
                  <div className="flex items-center gap-1.5 justify-end">
                    <button onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(s._id)}
                      className="p-1.5 rounded-lg text-slate-550 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliersWithItems.map(supplier => (
              <SupplierCard
                key={supplier._id}
                supplier={supplier}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleItems={handleToggleItems}
                expanded={expandedId === supplier._id}
              />
            ))}
          </div>
        )}
      </div>


      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <SupplierForm
          form={form}
          setForm={setForm}
          phoneField={phoneField}
          setPhoneField={setPhoneField}
          onSubmit={handleSubmit}
          onCancel={closeSlide}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={formError}
          editing={editing}
          phoneError={phoneError}
        />
      </SlideOver>

      <ConfirmDialog
        open={supplierToDelete !== null}
        title="Delete Supplier"
        message={`Are you sure you want to delete supplier "${supplierToDelete?.name}"? It will be unlinked from all inventory items.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (supplierToDelete) {
            deleteMutation.mutate(supplierToDelete._id, {
              onSuccess: () => {
                setSupplierToDelete(null);
              }
            });
          }
        }}
        onCancel={() => setSupplierToDelete(null)}
      />

      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Suppliers"
        fields={getSupplierImportFields()}
        onImport={handleImportSuppliers}
        templateName="suppliers"
        instructions={[
          "Fields marked with * are required.",
          "Phone: Format must be a valid phone number with country code (e.g. +94 77 123 4567).",
          "Email: Must be a valid email format.",
          "If some rows fail, a CSV error log will be automatically downloaded with instructions."
        ]}
      />
    </div>
  );
}
