const express = require('express');
const ModifierGroup = require('../models/ModifierGroup');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();

// Apply requirePaidAddon('modifier_groups') to all CRUD endpoints
router.use(protect, tenantScope, requirePaidAddon('modifier_groups'));

// GET all modifier groups
router.get('/', resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const groups = await ModifierGroup.find(filter).sort({ name: 1 });
    res.json(groups);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET single modifier group
router.get('/:id', resolveSelectedStore, async (req, res) => {
  try {
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };
    const group = await ModifierGroup.findOne(filter);
    if (!group) return res.status(404).json({ message: 'Modifier group not found' });
    res.json(group);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST create modifier group
router.post('/', authorize('manager', 'merchant_admin', 'superadmin'), resolveSelectedStore, async (req, res) => {
  try {
    const { name, description = '', minSelections = 0, maxSelections = null, modifiers = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Modifier group name is required' });

    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for modifier group creation' });

    const group = await ModifierGroup.create({
      tenantId: req.tenantId,
      storeId,
      name: name.trim(),
      description: description.trim(),
      minSelections: Math.max(0, Number(minSelections) || 0),
      maxSelections: maxSelections === null ? null : Math.max(0, Number(maxSelections) || 0),
      modifiers: Array.isArray(modifiers) ? modifiers.map(m => ({
        name: String(m.name || '').trim(),
        price: Math.max(0, Number(m.price) || 0),
        available: m.available !== false
      })).filter(m => m.name) : [],
      createdBy: req.user.id
    });
    res.status(201).json(group);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT update modifier group
router.put('/:id', authorize('manager', 'merchant_admin', 'superadmin'), resolveSelectedStore, async (req, res) => {
  try {
    const { name, description, minSelections, maxSelections, modifiers } = req.body;
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };
    const group = await ModifierGroup.findOne(filter);
    if (!group) return res.status(404).json({ message: 'Modifier group not found' });

    if (name !== undefined) {
      if (!name?.trim()) return res.status(400).json({ message: 'Modifier group name is required' });
      group.name = name.trim();
    }
    if (description !== undefined) group.description = (description || '').trim();
    if (minSelections !== undefined) group.minSelections = Math.max(0, Number(minSelections) || 0);
    if (maxSelections !== undefined) group.maxSelections = maxSelections === null ? null : Math.max(0, Number(maxSelections) || 0);
    if (modifiers !== undefined) {
      group.modifiers = Array.isArray(modifiers) ? modifiers.map(m => ({
        name: String(m.name || '').trim(),
        price: Math.max(0, Number(m.price) || 0),
        available: m.available !== false
      })).filter(m => m.name) : [];
    }
    group.updatedBy = req.user.id;
    await group.save();
    res.json(group);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// DELETE modifier group
router.delete('/:id', authorize('manager', 'merchant_admin', 'superadmin'), resolveSelectedStore, async (req, res) => {
  try {
    const filter = { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) };
    const group = await ModifierGroup.findOneAndDelete(filter);
    if (!group) return res.status(404).json({ message: 'Modifier group not found' });
    res.json({ message: 'Modifier group deleted successfully' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
