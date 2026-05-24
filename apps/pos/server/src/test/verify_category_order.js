'use strict';

require('dotenv').config({ path: `${__dirname}/../../.env` });
const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Promotion = require('../models/Promotion');
const LoyaltyReward = require('../models/LoyaltyReward');
const { getNextTopSortOrder, applyReorder } = require('../lib/sortOrderHelpers');
const {
  PLACEHOLDER_CATEGORY_NAME,
  cascadeCategoryRename,
  reassignMenuItemsFromCategory,
  ensurePlaceholderCategory,
} = require('../lib/categoryHelpers');

const MONGO_URI = getMongoConnectionString({
  fallback: 'mongodb://127.0.0.1:27017/pos_fastfood',
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function run() {
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to database.');

  const tenantId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const scope = { tenantId, storeId };

  console.log('\n--- 1. New-at-top sortOrder ---');
  await Category.deleteMany(scope);
  await MenuItem.deleteMany(scope);

  const first = await Category.create({ ...scope, name: 'Alpha', sortOrder: 5 });
  const topSort = await getNextTopSortOrder(Category, scope);
  assert(topSort === 4, 'Next top sortOrder is min - 1');
  const second = await Category.create({ ...scope, name: 'Beta', sortOrder: topSort });
  assert(second.sortOrder === 4, 'New category placed at top');

  console.log('\n--- 2. Reorder categories ---');
  await applyReorder(Category, scope, [second._id, first._id], userId);
  const ordered = await Category.find(scope).sort({ sortOrder: 1 }).select('name sortOrder').lean();
  assert(ordered[0].name === 'Beta' && ordered[1].name === 'Alpha', 'Reorder updates sortOrder');

  console.log('\n--- 3. Menu item sortOrder within category ---');
  await MenuItem.create({ ...scope, name: 'Item A', category: 'Alpha', price: 1, sortOrder: 10 });
  await MenuItem.create({ ...scope, name: 'Item B', category: 'Alpha', price: 2, sortOrder: 20 });
  const itemScope = { ...scope, category: 'Alpha' };
  const nextItemSort = await getNextTopSortOrder(MenuItem, itemScope);
  assert(nextItemSort === 9, 'Menu item next top sort within category');

  console.log('\n--- 4. Category rename cascade ---');
  await MenuItem.updateMany(itemScope, { $set: { category: 'Alpha' } });
  await Promotion.create({
    tenantId,
    storeId,
    name: 'Promo',
    type: 'flatDiscount',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    applicableCategories: ['Alpha'],
    discountAmount: 1,
  });
  await LoyaltyReward.create({
    tenantId,
    storeId,
    name: 'Reward',
    applicableCategories: ['Alpha'],
    active: true,
    approvalStatus: 'approved',
  });

  await cascadeCategoryRename({
    tenantId,
    storeId,
    oldName: 'Alpha',
    newName: 'Alpha Renamed',
    userId,
  });
  const renamedItems = await MenuItem.countDocuments({ ...scope, category: 'Alpha Renamed' });
  assert(renamedItems === 2, 'Menu items renamed with category');
  const promo = await Promotion.findOne({ tenantId, applicableCategories: 'Alpha Renamed' });
  assert(!!promo, 'Promotion applicableCategories updated');
  const reward = await LoyaltyReward.findOne({ tenantId, applicableCategories: 'Alpha Renamed' });
  assert(!!reward, 'Loyalty reward applicableCategories updated');

  console.log('\n--- 5. Delete category reassignment ---');
  await Category.create({ ...scope, name: 'To Delete', sortOrder: 50 });
  await MenuItem.create({ ...scope, name: 'Orphan', category: 'To Delete', price: 3, sortOrder: 0 });

  const { reassignedCount, placeholderCategory } = await reassignMenuItemsFromCategory({
    tenantId,
    storeId,
    categoryName: 'To Delete',
    userId,
  });
  assert(reassignedCount === 1, 'One item reassigned on delete prep');
  assert(placeholderCategory === PLACEHOLDER_CATEGORY_NAME, 'Placeholder category name is Uncategorized');

  const placeholder = await ensurePlaceholderCategory({ tenantId, storeId, userId });
  assert(placeholder.name === PLACEHOLDER_CATEGORY_NAME, 'Placeholder category exists');

  console.log('\nAll category/order tests passed.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
