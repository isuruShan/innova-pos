/** Filter menu items by name, category, or description. */
export function filterMenuItems(items, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return items || [];
  return (items || []).filter((item) => {
    const name = item.name?.toLowerCase() || '';
    const category = item.category?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    return name.includes(q) || category.includes(q) || description.includes(q);
  });
}

/** Map category name → sortOrder for display ordering. */
export function buildCategorySortMap(categoryRows) {
  const m = new Map();
  (categoryRows || []).forEach((c) => {
    if (c.active === false) return;
    m.set(c.name, c.sortOrder ?? 0);
  });
  return m;
}

/** Category tabs: API order first, then any orphan categories from menu items.
 * Filters to only show categories that have active (available) products.
 * Excludes "Uncategorized" from the list.
 */
export function buildCategoryTabs(categoryRows, menuItems, { includeInactive = false, excludeUncategorized = true } = {}) {
  // Get categories that have at least one active/available product
  const activeItems = (menuItems || []).filter(item => item.available !== false);
  const categoriesWithActiveProducts = new Set(activeItems.map(item => item.category).filter(Boolean));
  
  const fromApi = (categoryRows || [])
    .filter((c) => includeInactive || c.active !== false)
    .filter((c) => categoriesWithActiveProducts.has(c.name)) // Only include if has active products
    .filter((c) => !excludeUncategorized || (c.name?.toLowerCase() !== 'uncategorized')) // Exclude Uncategorized
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || ''))
    .map((c) => c.name);
  
  // Extras: orphan categories from menu items (also only if they have active products)
  const extras = [...new Set(activeItems.map((i) => i.category))]
    .filter((c) => c && !fromApi.includes(c))
    .filter((c) => !excludeUncategorized || c.toLowerCase() !== 'uncategorized')
    .sort();
  
  return ['All', ...fromApi, ...extras];
}

/**
 * Scope items by category tab. When search is active, search across all categories.
 */
export function scopeMenuItemsByCategory(items, activeCategory, menuSearch) {
  const searching = (menuSearch || '').trim().length > 0;
  const list = searching || activeCategory === 'All'
    ? (items || [])
    : (items || []).filter((i) => i.category === activeCategory);
  return filterMenuItems(list, menuSearch);
}

/**
 * Sort menu items for display: category sortOrder (when viewing All or global search),
 * then item sortOrder, then name.
 */
export function sortMenuItemsForDisplay(items, { activeCategory, categorySortMap, menuSearch = '' }) {
  const useCategoryOrder = (menuSearch || '').trim().length > 0 || activeCategory === 'All';
  return [...(items || [])].sort((a, b) => {
    if (useCategoryOrder && categorySortMap) {
      const catA = categorySortMap.get(a.category) ?? 9999;
      const catB = categorySortMap.get(b.category) ?? 9999;
      if (catA !== catB) return catA - catB;
      
      const catA_name = a.category || '';
      const catB_name = b.category || '';
      if (catA_name !== catB_name) return catA_name.localeCompare(catB_name);
    }
    const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (byOrder !== 0) return byOrder;
    
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    if (dateA !== dateB) return dateB - dateA;
    
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });
}

export function resolveMenuDisplayItems(items, { activeCategory, menuSearch, categorySortMap }) {
  const scoped = scopeMenuItemsByCategory(items, activeCategory, menuSearch);
  return sortMenuItemsForDisplay(scoped, { activeCategory, categorySortMap, menuSearch });
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
