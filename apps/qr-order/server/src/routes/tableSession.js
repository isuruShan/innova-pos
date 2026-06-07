const express = require('express');
const mongoose = require('mongoose');
const { sendRouteError } = require('@innovapos/shared-middleware');
const paths = require('../posPaths');

const { attachFreshMenuImageUrls } = require(paths.menuItemImageUrls);

const CafeTable = require(paths.models.CafeTable);
const Store = require(paths.models.Store);
const MenuItem = require(paths.models.MenuItem);
const Category = require(paths.models.Category);
const Order = require(paths.models.Order);
const TenantSettings = require(paths.models.TenantSettings);
const { enrichItems, recalculateOrderMoney, appendItemsToOrder } = require(paths.orderHelpers);
const { notifyCashiersTableWaiterCall, notifyCashiersQrOrderChange } = require(paths.notificationHelpers);

const router = express.Router();

function parseObjectIds(tenantId, storeId, tableId) {
  if (
    !mongoose.Types.ObjectId.isValid(String(tenantId)) ||
    !mongoose.Types.ObjectId.isValid(String(storeId)) ||
    !mongoose.Types.ObjectId.isValid(String(tableId))
  ) {
    return null;
  }
  return {
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    storeId: new mongoose.Types.ObjectId(String(storeId)),
    tableId: new mongoose.Types.ObjectId(String(tableId)),
  };
}

async function loadTableSession(tenantId, storeId, tableId) {
  const ids = parseObjectIds(tenantId, storeId, tableId);
  if (!ids) return { error: { status: 400, message: 'Invalid table link.' } };

  const tbl = await CafeTable.findOne({
    _id: ids.tableId,
    tenantId: ids.tenantId,
    storeId: ids.storeId,
    active: { $ne: false },
  }).lean();
  if (!tbl) return { error: { status: 404, message: 'Table not found or inactive.' } };

  const store = await Store.findOne({ _id: ids.storeId, tenantId: ids.tenantId })
    .select('name tableManagementEnabled guestWaiterCallCooldownSeconds')
    .lean();
  if (!store) return { error: { status: 404, message: 'Store not found.' } };
  if (!store.tableManagementEnabled) {
    return { error: { status: 403, message: 'Table ordering is not available for this venue right now.' } };
  }

  const tenantRow = await mongoose.connection.collection('tenants').findOne(
    { _id: ids.tenantId },
    { projection: { paidAddons: 1 } },
  );
  const qr = tenantRow?.paidAddons?.qrOrdering;
  const qrAddonActive =
    Boolean(qr?.active) &&
    (!qr?.periodEndsAt || new Date() < new Date(qr.periodEndsAt));
  if (!qrAddonActive) {
    return {
      error: {
        status: 402,
        message:
          'QR Ordering is not active for this business yet. Please ask the venue to enable it from their admin add-ons page.',
      },
    };
  }

  return { ids, tbl, store };
}

/** GET — menu + open order for this merchant/store/table (public). */
router.get('/:tenantId/:storeId/:tableId', async (req, res) => {
  try {
    const { tenantId, storeId, tableId } = req.params;
    const ctx = await loadTableSession(tenantId, storeId, tableId);
    if (ctx.error) return res.status(ctx.error.status).json({ message: ctx.error.message });

    const menuFilter = {
      tenantId: ctx.ids.tenantId,
      storeId: { $in: [ctx.ids.storeId, null] },
      available: true,
    };
    const menuLimit = Math.min(500, Math.max(1, parseInt(req.query.menuLimit, 10) || 120));
    const menuSkip = Math.max(0, parseInt(req.query.menuSkip, 10) || 0);

    const menuTotal = await MenuItem.countDocuments(menuFilter);
    const menuItemsRaw = await MenuItem.find(menuFilter)
      .sort({ category: 1, sortOrder: 1, name: 1 })
      .skip(menuSkip)
      .limit(menuLimit)
      .lean();

    const menuItems = await attachFreshMenuImageUrls(menuItemsRaw);

    const categoryRows = await Category.find({
      tenantId: ctx.ids.tenantId,
      storeId: { $in: [ctx.ids.storeId, null] },
      active: { $ne: false },
    })
      .sort({ sortOrder: 1, name: 1 })
      .select('name sortOrder active imageUrl imageKey')
      .lean();

    const brandingDoc = await TenantSettings.findOne({ tenantId: ctx.ids.tenantId })
      .select(
        'businessName tagline logoUrl faviconUrl primaryColor accentColor sidebarColor textColor selectionTextColor currency currencySymbol qrOrdering',
      )
      .lean();

    const branding = brandingDoc
      ? {
          businessName: brandingDoc.businessName || '',
          tagline: brandingDoc.tagline || '',
          logoUrl: brandingDoc.logoUrl || '',
          faviconUrl: brandingDoc.faviconUrl || '',
          primaryColor: brandingDoc.primaryColor || '#1a1a2e',
          accentColor: brandingDoc.accentColor || '#e94560',
          sidebarColor: brandingDoc.sidebarColor || '#16213e',
          textColor: brandingDoc.textColor || '#ffffff',
          selectionTextColor: brandingDoc.selectionTextColor || '#ffffff',
          currency: brandingDoc.currency || 'LKR',
          currencySymbol: brandingDoc.currencySymbol || 'Rs.',
          qrOrdering: brandingDoc.qrOrdering || { categoryImageFirst: true, accentColor: '' },
        }
      : null;

    const openOrder = await Order.findOne({
      tenantId: ctx.ids.tenantId,
      storeId: ctx.ids.storeId,
      tableId: ctx.ids.tableId,
      status: { $nin: ['completed', 'cancelled'] },
    }).lean();

    const cooldownMs = Math.max(30_000, (ctx.store.guestWaiterCallCooldownSeconds || 300) * 1000);
    let nextWaiterCallAt = null;
    if (ctx.tbl.lastWaiterCallAt) {
      const next = new Date(new Date(ctx.tbl.lastWaiterCallAt).getTime() + cooldownMs);
      if (next.getTime() > Date.now()) nextWaiterCallAt = next.toISOString();
    }

    res.json({
      tenantId: String(ctx.ids.tenantId),
      storeId: String(ctx.ids.storeId),
      tableId: String(ctx.ids.tableId),
      tableLabel: ctx.tbl.label,
      storeName: ctx.store.name,
      guestWaiterCallCooldownSeconds: ctx.store.guestWaiterCallCooldownSeconds || 300,
      nextWaiterCallAt,
      branding,
      categories: categoryRows.map((c) => ({
        name: c.name,
        sortOrder: c.sortOrder ?? 0,
        imageUrl: c.imageUrl || null,
      })),
      menuItems,
      menuTotal,
      menuSkip,
      menuLimit,
      order: openOrder,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/:tenantId/:storeId/:tableId/items', async (req, res) => {
  try {
    const { tenantId, storeId, tableId } = req.params;
    const { items } = req.body || {};
    if (!items?.length) return res.status(400).json({ message: 'Add at least one item to confirm.' });

    const ctx = await loadTableSession(tenantId, storeId, tableId);
    if (ctx.error) return res.status(ctx.error.status).json({ message: ctx.error.message });

    const tbl = await CafeTable.findOne({
      _id: ctx.ids.tableId,
      tenantId: ctx.ids.tenantId,
      storeId: ctx.ids.storeId,
      active: { $ne: false },
    });
    if (!tbl) return res.status(404).json({ message: 'Table not found or inactive.' });

    const store = await Store.findById(ctx.ids.storeId).lean();
    if (!store?.tableManagementEnabled) {
      return res.status(403).json({ message: 'Table ordering is not available for this venue right now.' });
    }

    let order = await Order.findOne({
      tenantId: ctx.ids.tenantId,
      storeId: ctx.ids.storeId,
      tableId: ctx.ids.tableId,
      status: { $nin: ['completed', 'cancelled'] },
    });

    let isNewOrder = false;
    if (!order) {
      isNewOrder = true;
      const enrichedItems = await enrichItems(items, ctx.ids.tenantId, ctx.ids.storeId);
      order = new Order({
        tenantId: ctx.ids.tenantId,
        storeId: ctx.ids.storeId,
        orderType: 'dine-in',
        tableNumber: tbl.label,
        tableId: tbl._id,
        reference: '',
        items: enrichedItems,
        status: 'pending',
        discountTotal: 0,
        appliedPromotions: [],
        paymentType: 'pending',
        paymentAmount: 0,
        paymentCollected: false,
        orderSource: 'qr',
      });
      await recalculateOrderMoney(order);
      await order.save();
    } else {
      await appendItemsToOrder(order, items, ctx.ids.tenantId, ctx.ids.storeId);
      if (['preparing', 'ready'].includes(order.status)) {
        order.kitchenAddsStatus = 'pending_adds';
      }
      await order.save();
    }

    try {
      const plain = order.toObject ? order.toObject({ flattenMaps: true }) : order;
      await notifyCashiersQrOrderChange({
        tenantId: ctx.ids.tenantId,
        storeId: ctx.ids.storeId,
        tableLabel: tbl.label,
        order: plain,
        changeKind: isNewOrder ? 'new_order' : 'items_added',
      });
    } catch (notifyErr) {
      console.error('[qr-order-server] notifyCashiersQrOrderChange:', notifyErr?.message || notifyErr);
    }

    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:tenantId/:storeId/:tableId/call-waiter', async (req, res) => {
  try {
    const { tenantId, storeId, tableId } = req.params;
    const ctx = await loadTableSession(tenantId, storeId, tableId);
    if (ctx.error) return res.status(ctx.error.status).json({ message: ctx.error.message });

    const tbl = await CafeTable.findOne({
      _id: ctx.ids.tableId,
      tenantId: ctx.ids.tenantId,
      storeId: ctx.ids.storeId,
      active: { $ne: false },
    });
    if (!tbl) return res.status(404).json({ message: 'Table not found or inactive.' });

    const store = await Store.findById(ctx.ids.storeId).lean();
    if (!store?.tableManagementEnabled) {
      return res.status(403).json({ message: 'Table ordering is not available for this venue right now.' });
    }

    const cooldownMs = Math.max(30_000, (store.guestWaiterCallCooldownSeconds || 300) * 1000);
    const now = Date.now();
    if (tbl.lastWaiterCallAt && now - new Date(tbl.lastWaiterCallAt).getTime() < cooldownMs) {
      const retryAt = new Date(new Date(tbl.lastWaiterCallAt).getTime() + cooldownMs).toISOString();
      return res.status(429).json({
        message: 'Please wait before calling again.',
        retryAt,
        cooldownSeconds: Math.ceil(cooldownMs / 1000),
      });
    }

    const order = await Order.findOne({
      tenantId: ctx.ids.tenantId,
      storeId: ctx.ids.storeId,
      tableId: ctx.ids.tableId,
      status: { $nin: ['completed', 'cancelled'] },
    }).lean();

    await notifyCashiersTableWaiterCall({
      tenantId: ctx.ids.tenantId,
      storeId: ctx.ids.storeId,
      tableLabel: tbl.label,
      tableId: tbl._id,
      order,
    });

    tbl.lastWaiterCallAt = new Date();
    await tbl.save();

    res.json({ ok: true });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
