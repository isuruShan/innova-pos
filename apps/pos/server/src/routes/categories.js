const express = require('express');
const Category = require('../models/Category');
const { attachFreshCategoryUrls } = require('../utils/menuItemImageUrls');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { parseSortQuery } = require('../lib/listPagination');
const { getNextTopSortOrder, applyReorder } = require('../lib/sortOrderHelpers');
const {
  PLACEHOLDER_CATEGORY_NAME,
  COMBO_CATEGORY_NAME,
  isSystemCategoryName,
  cascadeCategoryRename,
  reassignMenuItemsFromCategory,
  buildItemStoreFilter,
  ensureStoreSystemCategories,
} = require('../lib/categoryHelpers');

const router = express.Router();

const CATEGORY_SORT_FIELDS = {
  name: 'name',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  active: 'active',
};

const DEFAULT_CATEGORY_SORT = { sortOrder: 1, name: 1 };


router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId || (await resolveWriteStoreId(req));
    if (storeId) {
      await ensureStoreSystemCategories({
        tenantId: req.tenantId,
        storeId,
        userId: req.user?.id,
      });
    }

    const { all } = req.query;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    if (all !== 'true') filter.active = true;
    const sort = parseSortQuery(req, CATEGORY_SORT_FIELDS, DEFAULT_CATEGORY_SORT);
    const categories = await Category.find(filter).sort(sort);
    const enriched = await attachFreshCategoryUrls(categories);
    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.patch('/reorder', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { ids } = req.body;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const count = await applyReorder(Category, filter, ids, req.user.id);
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
    const enriched = await attachFreshCategoryUrls(categories);
    res.json({ message: 'Category order updated', count, categories: enriched });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, sortOrder: requestedSortOrder, imageUrl, imageKey } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });
    if (isSystemCategoryName(name)) {
      return res.status(400).json({ message: 'That category name is reserved by the system' });
    }
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for category creation' });

    const scopeFilter = { tenantId: req.tenantId, ...buildItemStoreFilter(storeId) };
    const sortOrder = requestedSortOrder !== undefined && requestedSortOrder !== null
      ? Number(requestedSortOrder) || 0
      : await getNextTopSortOrder(Category, scopeFilter);

    const category = await Category.create({
      name: name.trim(),
      sortOrder,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
      imageUrl: imageUrl || null,
      imageKey: imageKey || null,
    });
    const enriched = (await attachFreshCategoryUrls([category]))[0];
    res.status(201).json(enriched);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, active, sortOrder, imageUrl, imageKey } = req.body;
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };
    const existing = await Category.findOne(filter);
    if (!existing) return res.status(404).json({ message: 'Category not found' });

    const oldName = existing.name;
    if (isSystemCategoryName(oldName)) {
      if (name !== undefined && name.trim() !== oldName) {
        return res.status(400).json({ message: 'System categories cannot be renamed' });
      }
      if (active === false) {
        return res.status(400).json({ message: 'System categories must stay active' });
      }
    }

    const update = { updatedBy: req.user.id };
    if (name !== undefined) update.name = name.trim();
    if (active !== undefined) update.active = active;
    if (sortOrder !== undefined) update.sortOrder = sortOrder;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (imageKey !== undefined) update.imageKey = imageKey;

    const category = await Category.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (name !== undefined && update.name !== oldName) {
      await cascadeCategoryRename({
        tenantId: req.tenantId,
        storeId: category.storeId,
        oldName,
        newName: category.name,
        userId: req.user.id,
      });
    }
    const enriched = (await attachFreshCategoryUrls([category]))[0];
    res.json(enriched);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category name already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };
    const category = await Category.findOne(filter);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    if (isSystemCategoryName(category.name)) {
      return res.status(400).json({ message: 'System categories cannot be deleted' });
    }

    const { reassignedCount, placeholderCategory } = await reassignMenuItemsFromCategory({
      tenantId: req.tenantId,
      storeId: category.storeId,
      categoryName: category.name,
      userId: req.user.id,
    });

    await Category.findOneAndDelete({ _id: category._id });
    res.json({
      message: reassignedCount > 0
        ? `${reassignedCount} product(s) moved to "${placeholderCategory}" and category deleted`
        : 'Category deleted',
      reassignedCount,
      placeholderCategory,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
