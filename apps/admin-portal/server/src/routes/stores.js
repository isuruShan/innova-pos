const express = require('express');
const Store = require('../models/Store');
const User = require('../models/User');
const { authenticateJWT, authorize, tenantScope, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');
const { getStoreCreateQuote } = require('../lib/storeCreateQuote');
const { createDefaultStoreForTenant } = require('../lib/storePurchase');
const { permanentlyDeleteStore } = require('../lib/storeDelete');

const router = express.Router();

const STORE_SORT_FIELDS = {
  name: 'name',
  code: 'code',
  createdAt: 'createdAt',
  status: 'isActive',
};

const resolveTenantId = (req, tenantIdFromBody) => (
  req.user.role === 'superadmin' ? (tenantIdFromBody || req.query.tenantId || req.tenantId) : req.tenantId
);

const normalizePaymentMethods = (methods) => {
  const list = Array.isArray(methods) ? methods : [];
  const cleaned = [...new Set(list.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean))];
  if (!cleaned.includes('cash')) cleaned.unshift('cash');
  return cleaned.length ? cleaned : ['cash'];
};

/** Merchant admins manage every store on their tenant; staff are limited to assigned stores. */
const assignedStoreFilter = async (req, tenantId) => {
  if (req.user.role === 'superadmin' || req.user.role === 'merchant_admin') return {};
  const requester = await User.findOne({ _id: req.user.id, tenantId }).select('storeIds');
  const storeIds = (requester?.storeIds || []).map((id) => String(id)).filter(Boolean);
  if (!storeIds.length) return { _id: { $in: [] } };
  return { _id: { $in: storeIds } };
};

function serializeStore(doc) {
  const plain = doc?.toObject ? doc.toObject() : doc;
  const id = String(plain._id);
  return { ...plain, _id: id, id };
}

router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 50, maxLimit: 200 });
    const baseFilter = {
      tenantId,
      ...(await assignedStoreFilter(req, tenantId)),
    };

    const search = String(req.query.search || req.query.q || '').trim();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      baseFilter.$or = [{ name: re }, { code: re }, { address: re }];
    }

    const statusQ = String(req.query.status || '').trim().toLowerCase();
    if (statusQ === 'active') baseFilter.isActive = true;
    else if (statusQ === 'inactive') baseFilter.isActive = false;

    const total = await Store.countDocuments(baseFilter);
    const sort = parseSortQuery(req, STORE_SORT_FIELDS, { isActive: -1, isDefault: -1, name: 1 });
    const stores = await Store.find(baseFilter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(paginated(stores.map(serializeStore), total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/** Quote for creating another store (prorated); first store is free. */
router.get(
  '/create-quote',
  authenticateJWT,
  authorize('merchant_admin'),
  tenantScope,
  async (req, res) => {
    try {
      const quote = await getStoreCreateQuote(req.tenantId);
      if (quote.error) return res.status(400).json({ message: quote.error });
      res.json(quote);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

/** First included store — no payment. */
router.post(
  '/create-included',
  authenticateJWT,
  authorize('merchant_admin'),
  tenantScope,
  async (req, res) => {
    try {
      const quote = await getStoreCreateQuote(req.tenantId);
      if (quote.requiresPayment) {
        return res.status(400).json({ message: 'Payment is required for this store. Use the purchase flow.' });
      }
      const store = await createDefaultStoreForTenant(req.tenantId, req.user.id);
      await emitAudit({ req, action: 'STORE_CREATED', resource: 'Store', resourceId: store._id });
      res.status(201).json(serializeStore(store));
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

/** Super admin only — direct create with custom fields. */
router.post('/', authenticateJWT, authorize('superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, code, address, phone, paymentMethods, tenantId: tenantIdFromBody } = req.body;
    const tenantId = resolveTenantId(req, tenantIdFromBody);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    if (!name?.trim() || !code?.trim()) return res.status(400).json({ message: 'name and code are required' });

    const existing = await Store.findOne({ tenantId, code: code.trim().toUpperCase() });
    if (existing) return res.status(400).json({ message: 'Store code already exists' });

    const hasDefault = await Store.exists({ tenantId, isDefault: true, isActive: true });
    const store = await Store.create({
      tenantId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      paymentMethods: normalizePaymentMethods(paymentMethods),
      isDefault: !hasDefault,
      isActive: true,
      deactivatedBySuperadmin: false,
      createdBy: req.user.id,
    });

    const { syncMerchantAdminStoreIds } = require('../lib/storePurchase');
    await syncMerchantAdminStoreIds(tenantId, req.user.id);

    await emitAudit({ req, action: 'STORE_CREATED', resource: 'Store', resourceId: store._id });
    res.status(201).json(serializeStore(store));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    const storeId = String(req.params.id || '').trim();
    if (!storeId) return res.status(400).json({ message: 'Store id is required' });

    const store = await Store.findOne({
      _id: storeId,
      tenantId,
      ...(await assignedStoreFilter(req, tenantId)),
    }).lean();
    if (!store) return res.status(404).json({ message: 'Store not found' });
    res.json(serializeStore(store));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const storeId = String(req.params.id || '').trim();
    if (!storeId) return res.status(400).json({ message: 'Store id is required' });

    const { tenantId: tenantIdHint, ...body } = req.body;
    const tenantId = resolveTenantId(req, tenantIdHint);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    const store = await Store.findOne({
      _id: storeId,
      tenantId,
      ...(await assignedStoreFilter(req, tenantId)),
    });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    const { name, code, address, phone, paymentMethods, isActive, tableManagementEnabled, guestWaiterCallCooldownSeconds } = body;
    if (name !== undefined) store.name = name.trim();
    if (code !== undefined) store.code = code.trim().toUpperCase();
    if (address !== undefined) store.address = address.trim();
    if (phone !== undefined) store.phone = phone.trim();
    if (paymentMethods !== undefined) store.paymentMethods = normalizePaymentMethods(paymentMethods);
    if (tableManagementEnabled !== undefined) store.tableManagementEnabled = Boolean(tableManagementEnabled);
    if (guestWaiterCallCooldownSeconds !== undefined) {
      const n = parseInt(guestWaiterCallCooldownSeconds, 10);
      if (Number.isFinite(n)) store.guestWaiterCallCooldownSeconds = Math.min(3600, Math.max(30, n));
    }
    if (isActive !== undefined) {
      const nextActive = Boolean(isActive);
      if (req.user.role === 'superadmin') {
        store.isActive = nextActive;
        if (!nextActive) store.deactivatedBySuperadmin = true;
        else store.deactivatedBySuperadmin = false;
      } else {
        if (nextActive && store.deactivatedBySuperadmin) {
          return res.status(403).json({
            message: 'This store was disabled by a superadmin. Only a superadmin can activate it again.',
          });
        }
        store.isActive = nextActive;
      }
    }
    store.updatedBy = req.user.id;

    await store.save();
    await emitAudit({ req, action: 'STORE_UPDATED', resource: 'Store', resourceId: store._id });
    res.json(serializeStore(store));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id/default', authenticateJWT, authorize('superadmin'), tenantScope, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const store = await Store.findOne({ _id: req.params.id, tenantId, isActive: true });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    await Store.updateMany({ tenantId }, { $set: { isDefault: false } });
    store.isDefault = true;
    store.updatedBy = req.user.id;
    await store.save();

    await emitAudit({ req, action: 'STORE_DEFAULT_CHANGED', resource: 'Store', resourceId: store._id });
    res.json(store);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const storeId = String(req.params.id || '').trim();
    if (!storeId) return res.status(400).json({ message: 'Store id is required' });

    const tenantId = resolveTenantId(req, req.body?.tenantId);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    const store = await Store.findOne({
      _id: storeId,
      tenantId,
      ...(await assignedStoreFilter(req, tenantId)),
    });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    const result = await permanentlyDeleteStore({
      tenantId,
      storeId,
      deletedBy: req.user.id,
    });

    await emitAudit({ req, action: 'STORE_DELETED', resource: 'Store', resourceId: storeId });
    res.json({
      message: `Store "${result.name}" permanently deleted. Subscription billing will reflect the change on your next cycle.`,
      ...result,
    });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ message: err.message });
  }
});

module.exports = router;
