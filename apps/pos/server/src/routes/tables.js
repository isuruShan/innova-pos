const express = require('express');
const mongoose = require('mongoose');
const CafeTable = require('../models/CafeTable');
const Order = require('../models/Order');
const Store = require('../models/Store');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { handleWriteError } = require('../utils/mongoErrors');

const router = express.Router();

router.get('/occupancy', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    if (!req.storeId) return res.status(400).json({ message: 'Store context required' });
    const st = await Store.findById(req.storeId).select('tableManagementEnabled').lean();
    if (!st?.tableManagementEnabled) {
      return res.json([]);
    }
    const rows = await Order.find({
      tenantId: req.tenantId,
      storeId: req.storeId,
      status: { $nin: ['completed', 'cancelled'] },
      tableId: { $ne: null },
    })
      .select('_id orderNumber tableId status')
      .lean();
    res.json(
      rows.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        tableId: o.tableId,
        status: o.status,
      })),
    );
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = req.storeId || (await resolveWriteStoreId(req));
    if (!storeId) return res.status(400).json({ message: 'Store required' });
    let tables = await CafeTable.find({ tenantId: req.tenantId, storeId })
      .sort({ sortOrder: 1, label: 1 })
      .lean();
    const missingQr = tables.filter((t) => !t.qrToken).map((t) => t._id);
    if (missingQr.length) {
      for (const id of missingQr) {
        await CafeTable.updateOne({ _id: id }, { $set: { qrToken: CafeTable.generateQrToken() } });
      }
      tables = await CafeTable.find({ tenantId: req.tenantId, storeId })
        .sort({ sortOrder: 1, label: 1 })
        .lean();
    }
    res.json(tables);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'Store required' });
    const { label, sortOrder = 0, active = true } = req.body;
    if (!label || !String(label).trim()) return res.status(400).json({ message: 'label is required' });
    const doc = await CafeTable.create({
      tenantId: req.tenantId,
      storeId,
      label: String(label).trim(),
      sortOrder: Number(sortOrder) || 0,
      active: active !== false,
      createdBy: req.user.id,
    });
    res.status(201).json(doc);
  } catch (err) {
    handleWriteError(err, res, 'Could not create table');
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'Store required' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await CafeTable.findOne({ _id: req.params.id, tenantId: req.tenantId, storeId });
    if (!doc) return res.status(404).json({ message: 'Table not found' });
    const { label, sortOrder, active } = req.body;
    if (label !== undefined) doc.label = String(label).trim();
    if (sortOrder !== undefined) doc.sortOrder = Number(sortOrder) || 0;
    if (active !== undefined) doc.active = !!active;
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(doc);
  } catch (err) {
    handleWriteError(err, res, 'Could not update table');
  }
});

router.post(
  '/:id/regenerate-qr',
  protect,
  authorize('manager', 'merchant_admin', 'superadmin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const storeId = await resolveWriteStoreId(req);
      if (!storeId) return res.status(400).json({ message: 'Store required' });
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
      const doc = await CafeTable.findOne({ _id: req.params.id, tenantId: req.tenantId, storeId });
      if (!doc) return res.status(404).json({ message: 'Table not found' });
      doc.qrToken = CafeTable.generateQrToken();
      doc.updatedBy = req.user.id;
      await doc.save();
      res.json(doc);
    } catch (err) {
      handleWriteError(err, res, 'Could not regenerate QR');
    }
  },
);

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'Store required' });
    const doc = await CafeTable.findOne({ _id: req.params.id, tenantId: req.tenantId, storeId });
    if (!doc) return res.status(404).json({ message: 'Table not found' });
    const inUse = await Order.exists({
      tenantId: req.tenantId,
      storeId,
      tableId: doc._id,
      status: { $nin: ['completed', 'cancelled'] },
    });
    if (inUse) return res.status(400).json({ message: 'Table is currently assigned to an active order' });
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
