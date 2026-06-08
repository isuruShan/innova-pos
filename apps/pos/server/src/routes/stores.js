const express = require('express');
const Store = require('../models/Store');
const User = require('../models/User');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');

const router = express.Router();

const normalizePaymentMethods = (methods) => {
  const list = Array.isArray(methods) ? methods : [];
  const cleaned = [...new Set(list.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean))];
  if (!cleaned.includes('cash')) cleaned.unshift('cash');
  return cleaned.length ? cleaned : ['cash'];
};

router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    const requester = await User.findOne({ _id: req.user.id, tenantId }).select('storeIds');
    const userStoreIds = Array.isArray(requester?.storeIds) ? requester.storeIds.map(String) : [];
    // Empty assignment list = access all active stores in tenant (cashiers often omitted from storeIds)
    const filter =
      userStoreIds.length > 0
        ? { tenantId, isActive: true, _id: { $in: userStoreIds } }
        : { tenantId, isActive: true };

    const stores = await Store.find(filter).sort({ isDefault: -1, name: 1 });
    res.json(stores);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const requester = await User.findOne({ _id: req.user.id, tenantId }).select('storeIds');
    const userStoreIds = Array.isArray(requester?.storeIds) ? requester.storeIds.map(String) : [];
    const store = await Store.findOne({ _id: req.params.id, tenantId, isActive: true });
    if (!store) return res.status(404).json({ message: 'Store not found' });
    if (!userStoreIds.includes(String(store._id))) return res.status(403).json({ message: 'Access denied for selected store' });

    const { name, code, address, phone, paymentMethods, isActive, tableManagementEnabled, guestWaiterCallCooldownSeconds, posMenuLayout, posMenuCols, cashDenominations } = req.body;
    if (name !== undefined) store.name = String(name).trim();
    if (code !== undefined) store.code = String(code).trim().toUpperCase();
    if (address !== undefined) {
      if (typeof address === 'object' && address !== null) {
        store.address = {
          street1: String(address.street1 || '').trim(),
          street2: String(address.street2 || '').trim(),
          city: String(address.city || '').trim(),
          state: String(address.state || '').trim(),
          postalCode: String(address.postalCode || '').trim(),
          country: String(address.country || '').trim(),
        };
      } else {
        store.address = {
          street1: String(address || '').trim(),
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        };
      }
    }
    if (phone !== undefined) store.phone = String(phone).trim();
    if (paymentMethods !== undefined) store.paymentMethods = normalizePaymentMethods(paymentMethods);
    if (tableManagementEnabled !== undefined && req.user.role !== 'cashier') {
      store.tableManagementEnabled = Boolean(tableManagementEnabled);
    }
    if (guestWaiterCallCooldownSeconds !== undefined && req.user.role !== 'cashier') {
      const n = parseInt(guestWaiterCallCooldownSeconds, 10);
      if (Number.isFinite(n)) store.guestWaiterCallCooldownSeconds = Math.min(3600, Math.max(30, n));
    }
    if (posMenuLayout !== undefined && req.user.role !== 'cashier') {
      if (['default', 'compact'].includes(posMenuLayout)) store.posMenuLayout = posMenuLayout;
    }
    if (posMenuCols !== undefined && req.user.role !== 'cashier') {
      const cols = parseInt(posMenuCols, 10);
      if ([4, 5, 6].includes(cols)) store.posMenuCols = cols;
    }
    if (cashDenominations !== undefined && req.user.role !== 'cashier') {
      if (Array.isArray(cashDenominations)) {
        store.cashDenominations = cashDenominations.map(Number).filter(n => !isNaN(n) && n > 0);
      } else if (cashDenominations === null) {
        store.cashDenominations = null;
      }
    }
    if (isActive !== undefined && req.user.role !== 'manager') {
      const nextActive = Boolean(isActive);
      if (req.user.role === 'superadmin') {
        store.isActive = nextActive;
        if (!nextActive) store.deactivatedBySuperadmin = true;
        else store.deactivatedBySuperadmin = false;
      } else if (req.user.role === 'merchant_admin') {
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
    res.json(store);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
