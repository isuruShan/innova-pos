/** Normalizes list APIs that return `{ items, total, page, pages, limit }` or a legacy raw array. */
export function unwrapPagedList(data) {
  if (data == null) return { items: [], page: 1, pages: 1, total: 0, limit: 25 };
  if (Array.isArray(data)) {
    return { items: data, page: 1, pages: 1, total: data.length, limit: data.length };
  }
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    items,
    page: Number(data.page) || 1,
    pages: Number(data.pages) || 1,
    total: Number(data.total) || 0,
    limit: Number(data.limit) || 25,
  };
}
