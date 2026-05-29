import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Traverse upward from el to find the nearest scrollable ancestor.
 * Returns null if none found within maxLevels.
 */
function findScrollableParent(el, maxLevels = 12) {
  let node = el;
  for (let i = 0; i < maxLevels && node && node !== document.body; i++) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Hook to support touch/mouse drag dismissal on bottom sheets.
 * Swipe-to-close is suppressed when the sheet's scrollable content
 * has not been scrolled back to the top yet — the native scroll
 * handles the downward movement first.
 *
 * Attach `bind` props to the sheet container and apply `style` inline.
 */
export default function useSwipeDismiss({ onClose, open, threshold = 80 }) {
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startY = useRef(0);
  // true when the gesture started with scrollable content already at the top
  const canDismiss = useRef(true);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      isDragging.current = false;
    }
  }, [open]);

  /* ─── Touch handlers ─── */
  const handleTouchStart = useCallback((e) => {
    if (!open) return;
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    // Only allow sheet drag when the nearest scrollable ancestor is at the very top
    const scrollEl = findScrollableParent(e.target);
    canDismiss.current = !scrollEl || scrollEl.scrollTop <= 0;
  }, [open]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      if (!canDismiss.current) return; // content not at top — let native scroll handle it
      // Prevent page scroll while dragging the sheet
      e.preventDefault();
      setDragOffset(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragOffset((current) => {
      if (current > threshold) {
        onClose?.();
      }
      return 0;
    });
  }, [threshold, onClose]);

  /* ─── Mouse handlers (desktop drag) ─── */
  const handleMouseDown = useCallback((e) => {
    if (!open) return;
    // Don't intercept interactive elements
    const tag = e.target.tagName.toLowerCase();
    if (
      tag === 'input' ||
      tag === 'button' ||
      tag === 'select' ||
      tag === 'textarea' ||
      e.target.closest('button, input, select, textarea, a')
    ) return;

    // Don't intercept if the mouse started inside scrollable content that is scrolled down
    const scrollEl = findScrollableParent(e.target);
    if (scrollEl && scrollEl.scrollTop > 0) return;

    isDragging.current = true;
    startY.current = e.clientY;

    const onMouseMove = (ev) => {
      if (!isDragging.current) return;
      const delta = ev.clientY - startY.current;
      if (delta > 0) setDragOffset(delta);
    };

    const onMouseUp = (ev) => {
      isDragging.current = false;
      const delta = ev.clientY - startY.current;
      setDragOffset(0);
      if (delta > threshold) onClose?.();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [open, threshold, onClose]);

  const style = dragOffset > 0
    ? { transform: `translateY(${dragOffset}px)`, transition: 'none', willChange: 'transform' }
    : { transform: 'translateY(0)', transition: 'transform 0.25s cubic-bezier(0.32,0.72,0,1)' };

  const bind = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    style,
  };

  return { style, bind, dragOffset };
}

