export const PLACEHOLDER_CATEGORY_NAME = 'Uncategorized';
export const COMBO_CATEGORY_NAME = 'Combos';

export const SYSTEM_CATEGORY_NAMES = new Set([
  PLACEHOLDER_CATEGORY_NAME,
  COMBO_CATEGORY_NAME,
]);

/** Hidden from the Manage Categories modal (system-managed). */
export const HIDDEN_FROM_CATEGORY_MANAGER = new Set([COMBO_CATEGORY_NAME]);

/** Not selectable when creating/editing a regular menu item. */
export function isSelectableMenuCategory(name) {
  return name && !SYSTEM_CATEGORY_NAMES.has(name);
}

export function isHiddenFromCategoryManager(name) {
  return HIDDEN_FROM_CATEGORY_MANAGER.has(name);
}
