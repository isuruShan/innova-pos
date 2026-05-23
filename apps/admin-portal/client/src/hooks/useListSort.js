import { useCallback, useState } from 'react';

/**
 * Shared sort state for paginated list views.
 * @param {string} defaultField
 * @param {'asc'|'desc'} [defaultOrder]
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
