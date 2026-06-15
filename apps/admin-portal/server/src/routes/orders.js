const express = require('express');
const Order = require('../models/Order');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

router.get('/', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = {
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.since || req.query.until) {
      filter.createdAt = {};
      if (req.query.since) filter.createdAt.$gte = new Date(req.query.since);
      if (req.query.until) filter.createdAt.$lte = new Date(req.query.until);
    }
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit, 10) || 10000));
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('customerId', 'name mobile email')
      .lean();
    res.json(orders);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
