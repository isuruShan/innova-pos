/** Filter menu items by name, category, or description (QR guest app). */
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

export function buildCategorySortMap(categories) {
  const m = new Map();
  (categories || []).forEach((c) => {
    m.set(c.name, c.sortOrder ?? 0);
  });
  return m;
}

export function buildCategoryTabs(categories, menuItems) {
  const fromApi = (categories || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map((c) => c.name)
    .filter((name) => name !== 'Uncategorized');
  const extras = [...new Set((menuItems || []).map((m) => m.category))]
    .filter((c) => c && c !== 'Uncategorized' && !fromApi.includes(c))
    .sort();
  return ['All', ...fromApi, ...extras];
}

export function scopeMenuItemsByCategory(items, activeCategory, menuSearch) {
  const searching = menuSearch.trim().length > 0;
  const list = searching || activeCategory === 'All'
    ? items
    : items.filter((m) => m.category === activeCategory);
  return filterMenuItems(list, menuSearch);
}

export function sortMenuItemsForDisplay(items, { activeCategory, categorySortMap, menuSearch = '' }) {
  const useCategoryOrder = menuSearch.trim().length > 0 || activeCategory === 'All';
  return [...items].sort((a, b) => {
    if (useCategoryOrder) {
      const catA = categorySortMap.get(a.category) ?? 9999;
      const catB = categorySortMap.get(b.category) ?? 9999;
      if (catA !== catB) return catA - catB;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
    }
    const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (byOrder !== 0) return byOrder;
    return a.name.localeCompare(b.name);
  });
}

export function resolveMenuDisplayItems(items, { activeCategory, menuSearch, categorySortMap }) {
  const scoped = scopeMenuItemsByCategory(items, activeCategory, menuSearch);
  return sortMenuItemsForDisplay(scoped, { activeCategory, categorySortMap, menuSearch });
}
