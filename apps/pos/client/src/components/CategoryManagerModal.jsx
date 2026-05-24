import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Tag, Check, X,
  Search, GripVertical, Loader2, AlertTriangle,
} from 'lucide-react';
import api from '../api/axios';
import CenteredModal from './CenteredModal';
import ConfirmDialog from './ConfirmDialog';
import SortableTh from './SortableTh';
import { useListSort } from '../hooks/useListSort';
import { useDragReorder, reorderByDrag } from '../hooks/useDragReorder';
import {
  PLACEHOLDER_CATEGORY_NAME,
  isHiddenFromCategoryManager,
} from '../constants/categories';

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

export default function CategoryManagerModal({ open, onClose, categories, menuItems }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { sort, order, toggleSort } = useListSort('sortOrder', 'asc');

  const manageableCategories = useMemo(
    () => categories.filter((c) => !isHiddenFromCategoryManager(c.name)),
    [categories],
  );

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

  const orderedManageable = useMemo(() => {
    return [...manageableCategories].sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [manageableCategories]);

  const enriched = useMemo(
    () => orderedManageable.map((c) => ({
      ...c,
      productCount: productCounts[c.name] || 0,
    })),
    [orderedManageable, productCounts],
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

  const persistReorder = useCallback((fromId, toId) => {
    const reordered = reorderByDrag(orderedManageable, fromId, toId);
    if (!reordered) return;
    reorderMutation.mutate(reordered.map((c) => c._id));
  }, [orderedManageable, reorderMutation]);

  const { bindHandle, bindDropTarget, isOver } = useDragReorder(persistReorder);

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

  const handleClose = () => {
    setSearch('');
    setEditingId(null);
    setError('');
    setDeleteTarget(null);
    onClose();
  };

  const deleteProductCount = deleteTarget ? (productCounts[deleteTarget.name] || 0) : 0;

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
                className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Add
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">{newName.length}/{CATEGORY_NAME_MAX} characters · Drag rows to reorder</p>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
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
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-[var(--pos-surface-inset)]">
                    <th className="px-3 py-3 w-10" aria-label="Drag to reorder" />
                    <SortableTh label="Name" field="name" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" />
                    <SortableTh label="Products" field="productCount" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" align="center" />
                    <SortableTh label="Active" field="active" currentSort={sort} currentOrder={order} onSort={toggleSort} className="px-4 py-3" align="center" />
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {displayed.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500 py-12">
                        {search ? 'No categories match your search' : 'No categories yet'}
                      </td>
                    </tr>
                  ) : (
                    displayed.map((cat) => {
                      const isPlaceholder = cat.name === PLACEHOLDER_CATEGORY_NAME;
                      const isEditing = editingId === cat._id;
                      const handleDrag = bindHandle(cat._id);
                      const dropTarget = bindDropTarget(cat._id);

                      return (
                        <tr
                          key={cat._id}
                          {...dropTarget}
                          className={`hover:bg-slate-800/40 transition ${!cat.active ? 'opacity-60' : ''} ${isOver(cat._id) ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40' : ''}`}
                        >
                          <td className="px-3 py-3 text-slate-500 cursor-grab active:cursor-grabbing" {...handleDrag}>
                            <GripVertical size={16} />
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"?`
            : ''
        }
        confirmLabel="Delete Category"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
      >
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-400 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              {deleteProductCount > 0
                ? `${deleteProductCount} product${deleteProductCount !== 1 ? 's' : ''} will be moved to "${PLACEHOLDER_CATEGORY_NAME}".`
                : 'No products are linked to this category.'}
              {' '}The category will be permanently removed.
            </span>
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
