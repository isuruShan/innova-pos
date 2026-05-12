const express = require('express');
const Store = require('../models/Store');
const User = require('../models/User');
const { authenticateJWT, authorize, tenantScope, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

const resolveTenantId = (req, tenantIdFromBody) => (
  req.user.role === 'superadmin' ? (tenantIdFromBody || req.query.tenantId || req.tenantId) : req.tenantId
);

const normalizePaymentMethods = (methods) => {
  const list = Array.isArray(methods) ? methods : [];
  const cleaned = [...new Set(list.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean))];
  if (!cleaned.includes('cash')) cleaned.unshift('cash');
  return cleaned.length ? cleaned : ['cash'];
};

const assignedStoreFilter = async (req, tenantId) => {
  if (req.user.role === 'superadmin') return {};
  const requester = await User.findOne({ _id: req.user.id, tenantId }).select('storeIds');
  const storeIds = Array.isArray(requester?.storeIds) ? requester.storeIds : [];
  if (!storeIds.length) return { _id: { $in: [] } };
  return { _id: { $in: storeIds } };
};

router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    const stores = await Store.find({
      tenantId,
      ...(await assignedStoreFilter(req, tenantId)),
    }).sort({ isActive: -1, isDefault: -1, name: 1 });
    res.json(stores);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

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

    // Auto-assign new stores only to merchant admins.
    const merchantAdmins = await User.find({ tenantId, role: 'merchant_admin', isActive: true }).select('_id storeIds defaultStoreId');
    for (const tenantUser of merchantAdmins) {
      const nextStoreIds = new Set((tenantUser.storeIds || []).map((sid) => String(sid)));
      nextStoreIds.add(String(store._id));
      tenantUser.storeIds = [...nextStoreIds];
      if (!tenantUser.defaultStoreId) tenantUser.defaultStoreId = store._id;
      tenantUser.updatedBy = req.user.id;
      // eslint-disable-next-line no-await-in-loop
      await tenantUser.save();
    }

    await emitAudit({ req, action: 'STORE_CREATED', resource: 'Store', resourceId: store._id });
    res.status(201).json(store);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { tenantId: tenantIdHint, ...body } = req.body;
    const tenantId = resolveTenantId(req, tenantIdHint);
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });
    const store = await Store.findOne({
      _id: req.params.id,
      tenantId,
      ...(await assignedStoreFilter(req, tenantId)),
    });
    if (!store) return res.status(404).json({ message: 'Store not found' });

    const { name, code, address, phone, paymentMethods, isActive, tableManagementEnabled } = body;
    if (name !== undefined) store.name = name.trim();
    if (code !== undefined) store.code = code.trim().toUpperCase();
    if (address !== undefined) store.address = address.trim();
    if (phone !== undefined) store.phone = phone.trim();
    if (paymentMethods !== undefined) store.paymentMethods = normalizePaymentMethods(paymentMethods);
    if (tableManagementEnabled !== undefined) store.tableManagementEnabled = Boolean(tableManagementEnabled);
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
    res.json(store);
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

module.exports = router;
