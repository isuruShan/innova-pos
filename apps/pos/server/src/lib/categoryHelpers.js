'use strict';

const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Promotion = require('../models/Promotion');
const LoyaltyReward = require('../models/LoyaltyReward');

const PLACEHOLDER_CATEGORY_NAME = 'Uncategorized';

function buildItemStoreFilter(storeId) {
  if (!storeId) return { storeId: null };
  return { storeId };
}

function buildScopedStoreFilter(storeId) {
  if (!storeId) return {};
  return { storeId };
}

async function ensurePlaceholderCategory({ tenantId, storeId, userId }) {
  const filter = { tenantId, ...buildItemStoreFilter(storeId), name: PLACEHOLDER_CATEGORY_NAME };
  let category = await Category.findOne(filter);
  if (category) return category;

  const maxDoc = await Category.findOne({ tenantId, ...buildItemStoreFilter(storeId) })
    .sort({ sortOrder: -1 })
    .select('sortOrder')
    .lean();

  category = await Category.create({
    tenantId,
    storeId: storeId || null,
    name: PLACEHOLDER_CATEGORY_NAME,
    active: true,
    sortOrder: (maxDoc?.sortOrder ?? 0) + 1,
    createdBy: userId || null,
  });
  return category;
}

async function replaceCategoryNameInArrayField(Model, filter, field, oldName, newName) {
  await Model.updateMany(
    { ...filter, [field]: oldName },
    [{
      $set: {
        [field]: {
          $map: {
            input: `$${field}`,
            as: 'entry',
            in: { $cond: [{ $eq: ['$$entry', oldName] }, newName, '$$entry'] },
          },
        },
      },
    }],
  );
}

/**
 * When a category is renamed, keep denormalized category strings in sync.
 */
async function cascadeCategoryRename({ tenantId, storeId, oldName, newName, userId }) {
  if (!oldName || !newName || oldName === newName) return;

  const itemFilter = { tenantId, category: oldName, ...buildItemStoreFilter(storeId) };
  const scopeFilter = { tenantId, ...buildScopedStoreFilter(storeId) };

  await MenuItem.updateMany(itemFilter, { $set: { category: newName, updatedBy: userId } });
  await replaceCategoryNameInArrayField(Promotion, scopeFilter, 'applicableCategories', oldName, newName);
  await replaceCategoryNameInArrayField(LoyaltyReward, scopeFilter, 'applicableCategories', oldName, newName);
}

/**
 * Move menu items to the placeholder category before deleting a category document.
 */
async function reassignMenuItemsFromCategory({ tenantId, storeId, categoryName, userId }) {
  const placeholder = await ensurePlaceholderCategory({ tenantId, storeId, userId });
  const itemFilter = { tenantId, category: categoryName, ...buildItemStoreFilter(storeId) };
  const result = await MenuItem.updateMany(itemFilter, {
    $set: { category: placeholder.name, updatedBy: userId },
  });
  return { reassignedCount: result.modifiedCount, placeholderCategory: placeholder.name };
}

module.exports = {
  PLACEHOLDER_CATEGORY_NAME,
  ensurePlaceholderCategory,
  cascadeCategoryRename,
  reassignMenuItemsFromCategory,
  buildItemStoreFilter,
};
