const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { protect, tenantScope, sendRouteError } = require('../middleware/auth');

const router = express.Router();

router.get('/unread-count', protect, tenantScope, async (req, res) => {
  try {
    const n = await Notification.countDocuments({
      tenantId: req.tenantId,
      userId: req.user.id,
      readAt: null,
      type: { $ne: 'table_waiter_call' },
    });
    res.json({ count: n });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const isBell = req.query.bell === '1' || req.query.bell === 'true';
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || (isBell ? 10 : 30)),
    );
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    const base = { tenantId: req.tenantId, userId: req.user.id };
    const parts = [];

    const typeParam = (req.query.type || '').trim();
    if (typeParam) {
      const types = typeParam.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) parts.push({ type: types[0] });
      else if (types.length > 1) parts.push({ type: { $in: types } });
    }

    const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
    if (unreadOnly) parts.push({ readAt: null });

    const sid = (req.query.storeId || '').trim();
    if (sid && mongoose.Types.ObjectId.isValid(sid)) {
      parts.push({ 'meta.storeId': sid });
    }

    if (isBell) {
      const since = new Date(Date.now() - 86400000);
      parts.push({ $or: [{ readAt: null }, { readAt: { $gte: since } }] });
      parts.push({ type: { $ne: 'table_waiter_call' } });
    }

    const filter = parts.length ? { ...base, $and: parts } : base;

    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(isBell ? 0 : skip)
      .limit(limit)
      .lean();
    res.json(items);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.patch('/:id/read', protect, tenantScope, async (req, res) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, userId: req.user.id },
      { readAt: new Date() },
      { new: true },
    );
    if (!doc) return res.status(404).json({ message: 'Notification not found' });
    res.json(doc);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/read-all', protect, tenantScope, async (req, res) => {
  try {
    await Notification.updateMany(
      { tenantId: req.tenantId, userId: req.user.id, readAt: null },
      { readAt: new Date() },
    );
    res.json({ ok: true });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
