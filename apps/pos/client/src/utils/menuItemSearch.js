/** Filter menu items by name, category, or description. */
export function filterMenuItems(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const name = item.name?.toLowerCase() || '';
    const category = item.category?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    return name.includes(q) || category.includes(q) || description.includes(q);
  });
}

export function compareSortValues(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return dir;
  if (b == null) return -dir;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, undefined, { sensitivity: 'base' }) * dir;
  }
  if (a < b) return -dir;
  if (a > b) return dir;
  return 0;
}
