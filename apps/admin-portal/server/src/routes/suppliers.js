const express = require('express');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

const checkSupplierWriteAccess = async (req, res, next) => {
  try {
    const storeId = req.storeId || (await resolveWriteStoreId(req));
    if (!storeId) return next();

    const Store = require('../models/Store');
    const store = await Store.findById(storeId);
    if (store && store.replenishmentModel === 'central_kitchen') {
      const User = require('../models/User');
      const requester = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select('role');
      if (requester && ['manager'].includes(requester.role)) {
        return res.status(403).json({
          message: 'Direct supplier modifications are disabled for stores under Central Kitchen replenishment.'
        });
      }
    }
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin', 'purchasing_officer', 'inventory_clerk'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const sort = parseSortQuery(req, { name: 'name', createdAt: 'createdAt' }, { name: 1 });
    const suppliers = await Supplier.find({ tenantId: req.tenantId, ...buildStoreFilter(req) }).sort(sort).lean();
    const ids = suppliers.map(s => s._id);
    const items = await Inventory.find({ tenantId: req.tenantId, suppliers: { $in: ids }, ...buildStoreFilter(req) }, 'suppliers').lean();
    const countMap = {};
    items.forEach(item => {
      item.suppliers.forEach(sid => {
        const key = sid.toString();
        countMap[key] = (countMap[key] || 0) + 1;
      });
    });
    res.json(suppliers.map(s => ({ ...s, itemCount: countMap[s._id.toString()] || 0 })));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin', 'purchasing_officer', 'inventory_clerk'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    const items = await Inventory.find(
      { tenantId: req.tenantId, suppliers: req.params.id, ...buildStoreFilter(req) },
      'itemName unit quantity minThreshold'
    );
    res.json({ ...supplier.toObject(), items });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin', 'purchasing_officer'), tenantScope, resolveSelectedStore, checkSupplierWriteAccess, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for supplier creation' });
    const supplier = await Supplier.create({ ...req.body, tenantId: req.tenantId, storeId, createdBy: req.user.id });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin', 'purchasing_officer'), tenantScope, resolveSelectedStore, checkSupplierWriteAccess, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin', 'purchasing_officer'), tenantScope, resolveSelectedStore, checkSupplierWriteAccess, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    await Inventory.updateMany(
      { tenantId: req.tenantId, suppliers: req.params.id, ...buildStoreFilter(req) },
      { $pull: { suppliers: req.params.id } }
    );
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
