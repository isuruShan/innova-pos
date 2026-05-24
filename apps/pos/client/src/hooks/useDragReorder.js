import { useCallback, useRef, useState } from 'react';

/** Reorder an array by moving one item to another item's index. */
export function reorderByDrag(items, fromId, toId, idKey = '_id') {
  const fromIdx = items.findIndex((item) => String(item[idKey]) === String(fromId));
  const toIdx = items.findIndex((item) => String(item[idKey]) === String(toId));
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

/**
 * HTML5 drag-and-drop reordering with a dedicated drag handle.
 * @param {(fromId: string, toId: string) => void} onReorder
 */
export function useDragReorder(onReorder) {
  const dragIdRef = useRef(null);
  const [overId, setOverId] = useState(null);

  const finishDrag = useCallback(() => {
    dragIdRef.current = null;
    setOverId(null);
  }, []);

  const bindHandle = useCallback((id) => ({
    draggable: true,
    onDragStart: (e) => {
      dragIdRef.current = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(id));
    },
    onDragEnd: finishDrag,
  }), [finishDrag]);

  const bindDropTarget = useCallback((id) => ({
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOverId(id);
    },
    onDragLeave: () => setOverId((prev) => (prev === id ? null : prev)),
    onDrop: (e) => {
      e.preventDefault();
      const from = dragIdRef.current || e.dataTransfer.getData('text/plain');
      finishDrag();
      if (from && String(from) !== String(id)) onReorder(from, id);
    },
  }), [finishDrag, onReorder]);

  const isOver = useCallback((id) => overId === id, [overId]);

  return { bindHandle, bindDropTarget, isOver };
}
