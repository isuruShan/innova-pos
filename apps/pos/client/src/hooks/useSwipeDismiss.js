import { useState, useRef, useEffect } from 'react';

/**
 * Hook to support touch/mouse drag dismissal on mobile bottom sheets.
 */
export default function useSwipeDismiss({ onClose, open, threshold = 100 }) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

  const handleTouchStart = (e) => {
    if (!open || !isMobile()) return;
    // Allow dragging downwards
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const deltaY = currentY.current - startY.current;
    if (deltaY > threshold) {
      onClose();
    }
    setDragOffset(0);
  };

  const handleMouseDown = (e) => {
    if (!open || !isMobile()) return;
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'button' || tag === 'select' || tag === 'textarea' || e.target.closest('button')) {
      return;
    }
    startY.current = e.clientY;
    currentY.current = startY.current;
    setIsDragging(true);

    const handleMouseMove = (ev) => {
      currentY.current = ev.clientY;
      const deltaY = currentY.current - startY.current;
      if (deltaY > 0) {
        setDragOffset(deltaY);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const deltaY = currentY.current - startY.current;
      if (deltaY > threshold) {
        onClose();
      }
      setDragOffset(0);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  const style = isMobile() && dragOffset > 0
    ? { transform: `translateY(${dragOffset}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }
    : {};

  const bind = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
  };

  return {
    style,
    bind,
    isDragging,
    dragOffset,
  };
}
