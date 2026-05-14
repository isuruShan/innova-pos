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

function sanitizeMenuPayload(body) {
  if (!body || typeof body !== 'object') return body;
  const next = { ...body };
  if (next.price !== undefined && next.price !== null) {
    next.price = roundMoney2(next.price);
  }
  return next;
}

const router = express.Router();

router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const items = await MenuItem.find({ tenantId: req.tenantId, ...buildStoreFilter(req) })
      .sort({ category: 1, name: 1 })
      .lean();
    const enriched = await attachFreshMenuImageUrls(items);
    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for menu item creation' });
    const { images, image, imageKey } = normalizeMenuItemImages(req.body);
    const item = await MenuItem.create({
      ...sanitizeMenuPayload(req.body),
      images,
      image,
      imageKey,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
    });
    await emitAudit({ req, action: 'MENU_ITEM_CREATED', resource: 'MenuItem', resourceId: item._id });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { images, image, imageKey } = normalizeMenuItemImages(req.body);
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      { ...sanitizeMenuPayload(req.body), images, image, imageKey, updatedBy: req.user.id },
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
