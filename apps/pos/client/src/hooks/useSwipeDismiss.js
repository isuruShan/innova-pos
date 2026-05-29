import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook to support touch/mouse drag dismissal on bottom sheets.
 * Attach `bind` props to the sheet container and apply `style` inline.
 */
export default function useSwipeDismiss({ onClose, open, threshold = 80 }) {
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startY = useRef(0);

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
  }, [open]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
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
