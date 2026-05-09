const express = require('express');
const MenuItem = require('../models/MenuItem');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { emitAudit } = require('@innovapos/shared-middleware');

const router = express.Router();

router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const items = await MenuItem.find({ tenantId: req.tenantId }).sort({ category: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const item = await MenuItem.create({
      ...req.body,
      tenantId: req.tenantId,
      createdBy: req.user.id,
    });
    await emitAudit({ req, action: 'MENU_ITEM_CREATED', resource: 'MenuItem', resourceId: item._id });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    await emitAudit({ req, action: 'MENU_ITEM_UPDATED', resource: 'MenuItem', resourceId: item._id });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    await emitAudit({ req, action: 'MENU_ITEM_DELETED', resource: 'MenuItem', resourceId: req.params.id });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
