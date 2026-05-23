import { useCallback, useState } from 'react';

/**
 * Shared sort state for list views in the POS manager UI.
 */
export function useListSort(defaultField = 'createdAt', defaultOrder = 'desc') {
  const [sort, setSort] = useState(defaultField);
  const [order, setOrder] = useState(defaultOrder);

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev === field) {
        setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setOrder('asc');
      return field;
    });
  }, []);

  const sortParams = { sort, order };

  return { sort, order, toggleSort, sortParams, setSort, setOrder };
}
