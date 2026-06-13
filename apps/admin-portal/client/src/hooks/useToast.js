import { useCallback, useRef, useState } from 'react';

/**
 * Simple auto-dismiss toast for POS manager surfaces.
 */
export function useToast(defaultMs = 4500) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message, variant = 'error') => {
    if (!message) return;
    setToast({ message, variant });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), defaultMs);
  }, [defaultMs]);

  return { toast, showToast, clearToast };
}

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}
