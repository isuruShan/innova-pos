'use strict';

const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Promotion = require('../models/Promotion');
const LoyaltyReward = require('../models/LoyaltyReward');

const PLACEHOLDER_CATEGORY_NAME = 'Uncategorized';
const COMBO_CATEGORY_NAME = 'Combos';

const SYSTEM_CATEGORY_NAMES = new Set([PLACEHOLDER_CATEGORY_NAME, COMBO_CATEGORY_NAME]);

function isSystemCategoryName(name) {
  return SYSTEM_CATEGORY_NAMES.has(String(name || '').trim());
}

function buildItemStoreFilter(storeId) {
  if (!storeId) return { storeId: null };
  return { storeId };
}

function buildScopedStoreFilter(storeId) {
  if (!storeId) return {};
  return { storeId };
}

async function ensureSystemCategory({ tenantId, storeId, userId, name, sortOrder }) {
  const filter = { tenantId, ...buildItemStoreFilter(storeId), name };
  let category = await Category.findOne(filter);
  if (category) return category;

  category = await Category.create({
    tenantId,
    storeId: storeId || null,
    name,
    active: true,
    sortOrder,
    createdBy: userId || null,
  });
  return category;
}

async function ensurePlaceholderCategory({ tenantId, storeId, userId }) {
  const maxDoc = await Category.findOne({ tenantId, ...buildItemStoreFilter(storeId) })
    .sort({ sortOrder: -1 })
    .select('sortOrder')
    .lean();

  return ensureSystemCategory({
    tenantId,
    storeId,
    userId,
    name: PLACEHOLDER_CATEGORY_NAME,
    sortOrder: (maxDoc?.sortOrder ?? 0) + 1,
  });
}

async function ensureComboCategory({ tenantId, storeId, userId }) {
  const minDoc = await Category.findOne({ tenantId, ...buildItemStoreFilter(storeId) })
    .sort({ sortOrder: 1 })
    .select('sortOrder')
    .lean();

  return ensureSystemCategory({
    tenantId,
    storeId,
    userId,
    name: COMBO_CATEGORY_NAME,
    sortOrder: (minDoc?.sortOrder ?? 0) - 1,
  });
}

async function ensureStoreSystemCategories({ tenantId, storeId, userId }) {
  await ensureComboCategory({ tenantId, storeId, userId });
  await ensurePlaceholderCategory({ tenantId, storeId, userId });
}

async function replaceCategoryNameInArrayField(Model, filter, field, oldName, newName) {
  const docs = await Model.find({ ...filter, [field]: oldName }).select(field).lean();
  if (!docs.length) return;

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          [field]: (doc[field] || []).map((entry) => (entry === oldName ? newName : entry)),
        },
      },
    },
  }));

  await Model.bulkWrite(ops);
}

async function cascadeCategoryRename({ tenantId, storeId, oldName, newName, userId }) {
  if (!oldName || !newName || oldName === newName) return;
  if (isSystemCategoryName(oldName)) {
    const err = new Error('System categories cannot be renamed');
    err.status = 400;
    throw err;
  }

  const itemFilter = { tenantId, category: oldName, ...buildItemStoreFilter(storeId) };
  const scopeFilter = { tenantId, ...buildScopedStoreFilter(storeId) };

  await MenuItem.updateMany(itemFilter, { $set: { category: newName, updatedBy: userId } });
  await replaceCategoryNameInArrayField(Promotion, scopeFilter, 'applicableCategories', oldName, newName);
  await replaceCategoryNameInArrayField(LoyaltyReward, scopeFilter, 'applicableCategories', oldName, newName);
}

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
  COMBO_CATEGORY_NAME,
  SYSTEM_CATEGORY_NAMES,
  isSystemCategoryName,
  ensurePlaceholderCategory,
  ensureComboCategory,
  ensureStoreSystemCategories,
  cascadeCategoryRename,
  reassignMenuItemsFromCategory,
  buildItemStoreFilter,
};
