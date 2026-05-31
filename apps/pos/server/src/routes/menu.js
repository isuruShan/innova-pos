const express = require('express');
const MenuItem = require('../models/MenuItem');
const {
  attachFreshMenuImageUrls,
  normalizeMenuItemImages,
} = require('../utils/menuItemImageUrls');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { roundMoney2 } = require('../utils/orderHelpers');
const { parseSortQuery } = require('../lib/listPagination');
const { getNextTopSortOrder, applyReorder } = require('../lib/sortOrderHelpers');
const { buildItemStoreFilter, COMBO_CATEGORY_NAME, ensureComboCategory } = require('../lib/categoryHelpers');

function sanitizeMenuPayload(body) {
  if (!body || typeof body !== 'object') return body;
  const next = { ...body };
  if (next.price !== undefined && next.price !== null) {
    next.price = roundMoney2(next.price);
  }
  if (Array.isArray(next.variants)) {
    next.variants = next.variants.map((v) => {
      const nextV = { ...v };
      if (nextV.price !== undefined && nextV.price !== null) {
        nextV.price = roundMoney2(nextV.price);
      }
      return nextV;
    });
  }
  return next;
}

const router = express.Router();

const MENU_SORT_FIELDS = {
  name: 'name',
  category: 'category',
  price: 'price',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
};

const DEFAULT_MENU_SORT = { category: 1, sortOrder: 1, name: 1 };

async function resolveItemCategory(req, body, storeId) {
  const payload = sanitizeMenuPayload(body);
  if (payload.isCombo) {
    await ensureComboCategory({ tenantId: req.tenantId, storeId, userId: req.user.id });
    return COMBO_CATEGORY_NAME;
  }
  const category = body.category?.trim();
  if (!category) {
    const err = new Error('Category is required');
    err.status = 400;
    throw err;
  }
  return category;
}

router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const sort = parseSortQuery(req, MENU_SORT_FIELDS, DEFAULT_MENU_SORT);
    const items = await MenuItem.find(filter).sort(sort).lean();
    const enriched = await attachFreshMenuImageUrls(items);
    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.patch('/reorder', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { ids, category } = req.body;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    if (category !== undefined && category !== null && String(category).trim()) {
      filter.category = String(category).trim();
    }
    const count = await applyReorder(MenuItem, filter, ids, req.user.id);
    const items = await MenuItem.find(filter).sort(DEFAULT_MENU_SORT).lean();
    const enriched = await attachFreshMenuImageUrls(items);
    res.json({ message: 'Menu order updated', count, items: enriched });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for menu item creation' });

    const { images, image, imageKey } = normalizeMenuItemImages(req.body);
    const payload = sanitizeMenuPayload(req.body);
    const category = await resolveItemCategory(req, req.body, storeId);
    payload.category = category;

    const itemScope = {
      tenantId: req.tenantId,
      ...buildItemStoreFilter(storeId),
      category,
    };
    const sortOrder = payload.sortOrder !== undefined && payload.sortOrder !== null
      ? Number(payload.sortOrder) || 0
      : await getNextTopSortOrder(MenuItem, itemScope);

    const item = await MenuItem.create({
      ...payload,
      sortOrder,
      images,
      image,
      imageKey,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
    });

    // Create ingredient links if passed during creation
    if (req.body.ingredients && Array.isArray(req.body.ingredients)) {
      const IngredientLink = require('../models/IngredientLink');
      const Inventory = require('../models/Inventory');
      for (const ing of req.body.ingredients) {
        const { inventoryItemId, quantity, unit, variantId } = ing;
        if (inventoryItemId && typeof quantity === 'number') {
          const invItem = await Inventory.findOne({
            _id: inventoryItemId,
            tenantId: req.tenantId,
            storeId,
          });
          if (invItem) {
            await IngredientLink.create({
              tenantId: req.tenantId,
              storeId,
              menuItemId: item._id,
              variantId: variantId || null,
              inventoryItemId,
              quantity,
              unit: unit || invItem.unit,
              createdBy: req.user.id,
            });
          }
        }
      }
    }

    await emitAudit({ req, action: 'MENU_ITEM_CREATED', resource: 'MenuItem', resourceId: item._id });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const existing = await MenuItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    if (!existing) return res.status(404).json({ message: 'Menu item not found' });

    const storeId = existing.storeId || (await resolveWriteStoreId(req));
    const update = { ...sanitizeMenuPayload(req.body), updatedBy: req.user.id };

    if (req.body.isCombo !== undefined || req.body.category !== undefined) {
      const isCombo = req.body.isCombo !== undefined ? !!req.body.isCombo : existing.isCombo;
      update.isCombo = isCombo;
      update.category = await resolveItemCategory(req, { ...req.body, isCombo }, storeId);
    }
    const hasImageData = req.body?.images !== undefined || req.body?.image !== undefined || req.body?.imageKey !== undefined;
    if (hasImageData) {
      const { images, image, imageKey } = normalizeMenuItemImages(req.body);
      update.images = images;
      update.image = image;
      update.imageKey = imageKey;
    }
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    await emitAudit({ req, action: 'MENU_ITEM_UPDATED', resource: 'MenuItem', resourceId: item._id });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    await emitAudit({ req, action: 'MENU_ITEM_DELETED', resource: 'MenuItem', resourceId: req.params.id });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
