const express = require('express');
const Notification = require('../models/Notification');
const { protect, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/unread-count', protect, tenantScope, async (req, res) => {
  try {
    const n = await Notification.countDocuments({
      tenantId: req.tenantId,
      userId: req.user.id,
      readAt: null,
    });
    res.json({ count: n });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const items = await Notification.find({ tenantId: req.tenantId, userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
