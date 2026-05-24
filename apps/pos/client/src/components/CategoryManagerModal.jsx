import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Tag, Check, X,
  Search, ChevronUp, ChevronDown, Loader2, AlertTriangle,
} from 'lucide-react';
import api from '../api/axios';
import CenteredModal from './CenteredModal';
import SortableTh from './SortableTh';
import { useListSort } from '../hooks/useListSort';

export const PLACEHOLDER_CATEGORY_NAME = 'Uncategorized';
const CATEGORY_NAME_MAX = 100;

function compareValues(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'string') {
    return dir * a.localeCompare(b, undefined, { sensitivity: 'base' });
  }
  if (typeof a === 'boolean') {
    return dir * (Number(a) - Number(b));
  }
  return dir * (a - b);
}

function DeleteCategoryDialog({ category, productCount, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--pos-surface)] border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Trash2 className="text-red-400" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--pos-text-primary)]">Delete Category</h3>
            <p className="text-sm text-slate-400 mt-1">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-200">{category.name}</span>?
            </p>
          </div>
        </div>

        <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-400 font-medium flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              {productCount > 0
                ? `${productCount} product${productCount !== 1 ? 's' : ''} in this category will be moved to "${PLACEHOLDER_CATEGORY_NAME}".`
                : `No products are linked to this category.`}
              {' '}The category will be permanently removed.
            </span>
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Category'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoryManagerModal({ open, onClose, categories, menuItems }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { sort, order, toggleSort } = useListSort('sortOrder', 'asc');

  const productCounts = useMemo(() => {
    const counts = {};
    for (const item of menuItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [menuItems]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['menu'] });
  };

  const createMutation = useMutation({
    mutationFn: (name) => api.post('/categories', { name }),
    onSuccess: () => { invalidateAll(); setNewName(''); setError(''); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to add category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/categories/${id}`, data),
    onSuccess: () => { invalidateAll(); setEditingId(null); setError(''); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/categories/${id}`),
    onSuccess: () => { invalidateAll(); setDeleteTarget(null); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to delete category'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids) => api.patch('/categories/reorder', { ids }),
    onSuccess: () => invalidateAll(),
    onError: (e) => setError(e.response?.data?.message || 'Failed to reorder categories'),
  });

  const enriched = useMemo(
    () => categories.map((c) => ({
      ...c,
      productCount: productCounts[c.name] || 0,
    })),
    [categories, productCounts],
  );

  const displayed = useMemo(() => {
    let list = enriched;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    const dir = order === 'asc' ? 1 : -1;
    const field = sort === 'productCount' ? 'productCount' : sort;

    return [...list].sort((a, b) => {
      if (field === 'createdAt') {
        return compareValues(new Date(a.createdAt).getTime(), new Date(b.createdAt).getTime(), dir);
      }
      return compareValues(a[field], b[field], dir);
    });
  }, [enriched, search, sort, order]);

  const startEdit = (cat) => {
    setEditingId(cat._id);
    setEditName(cat.name);
    setError('');
  };

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    if (trimmed.length > CATEGORY_NAME_MAX) {
      setError(`Category name must be ${CATEGORY_NAME_MAX} characters or fewer`);
      return;
    }
    updateMutation.mutate({ id: editingId, data: { name: trimmed } });
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (trimmed.length > CATEGORY_NAME_MAX) {
      setError(`Category name must be ${CATEGORY_NAME_MAX} characters or fewer`);
      return;
    }
    createMutation.mutate(trimmed);
  };

  const allOrdered = useMemo(() => {
    return [...categories].sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [categories]);

  const moveCategory = (catId, direction) => {
    const ids = allOrdered.map((c) => c._id);
    const idx = ids.findIndex((id) => String(id) === String(catId));
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    reorderMutation.mutate(ids);
  };

  const handleClose = () => {
    setSearch('');
    setEditingId(null);
    setError('');
    setDeleteTarget(null);
    onClose();
  };

  return (
    <>
      <CenteredModal
        open={open}
        onClose={handleClose}
        title="Manage Categories"
        maxWidth="max-w-4xl"
        ariaLabel="Manage categories"
      >
        <div className="space-y-4">
          {/* Add category */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Category</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                maxLength={CATEGORY_NAME_MAX}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. Wraps"
                className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
              >
                {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Add
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">{newName.length}/{CATEGORY_NAME_MAX} characters · New categories appear at the top</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {/* Table */}
          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden -mx-2 sm:mx-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">Order</th>
                    <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" />
                    <SortableTh label="Sort #" field="sortOrder" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" align="center" />
                    <SortableTh label="Products" field="productCount" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" align="center" />
                    <SortableTh label="Active" field="active" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" align="center" />
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {displayed.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-500 py-12">
                        {search ? 'No categories match your search' : 'No categories yet'}
                      </td>
                    </tr>
                  ) : (
                    displayed.map((cat) => {
                      const isPlaceholder = cat.name === PLACEHOLDER_CATEGORY_NAME;
                      const isEditing = editingId === cat._id;
                      const globalIdx = allOrdered.findIndex((c) => c._id === cat._id);

                      return (
                        <tr
                          key={cat._id}
                          className={`hover:bg-slate-700/20 transition ${!cat.active ? 'opacity-60' : ''}`}
                        >
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={globalIdx <= 0 || reorderMutation.isPending}
                                onClick={() => moveCategory(cat._id, -1)}
                                className="p-1 rounded bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600"
                                title="Move up"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={globalIdx >= allOrdered.length - 1 || reorderMutation.isPending}
                                onClick={() => moveCategory(cat._id, 1)}
                                className="p-1 rounded bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600"
                                title="Move down"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editName}
                                  maxLength={CATEGORY_NAME_MAX}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  className="flex-1 min-w-0 bg-[var(--pos-surface-inset)] border border-amber-500/50 text-[var(--pos-text-primary)] rounded-lg px-2 py-1 text-sm focus:outline-none"
                                />
                                <button type="button" onClick={saveEdit} className="text-green-400 hover:text-green-300">
                                  <Check size={14} />
                                </button>
                                <button type="button" onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 min-w-0">
                                <Tag size={13} className={cat.active ? 'text-amber-400 shrink-0' : 'text-slate-600 shrink-0'} />
                                <span className="font-medium text-[var(--pos-text-primary)] truncate" title={cat.name}>
                                  {cat.name}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-400 tabular-nums">{cat.sortOrder ?? 0}</td>
                          <td className="px-4 py-3 text-center text-slate-400 tabular-nums">{cat.productCount}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => updateMutation.mutate({ id: cat._id, data: { active: !cat.active } })}
                              disabled={isPlaceholder && cat.active}
                              className="inline-flex items-center gap-1 text-xs font-medium transition disabled:opacity-40"
                              title={isPlaceholder ? 'Uncategorized must stay active' : cat.active ? 'Deactivate' : 'Activate'}
                            >
                              {cat.active ? (
                                <ToggleRight size={18} className="text-green-400" />
                              ) : (
                                <ToggleLeft size={18} className="text-slate-500" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(cat)}
                                  className="p-1.5 rounded text-slate-500 hover:text-[var(--pos-text-primary)] transition"
                                  title="Rename"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {!isPlaceholder && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(cat)}
                                  className="p-1.5 rounded text-slate-500 hover:text-red-400 transition"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CenteredModal>

      {deleteTarget && (
        <DeleteCategoryDialog
          category={deleteTarget}
          productCount={productCounts[deleteTarget.name] || 0}
          onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </>
  );
}
