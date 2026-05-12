const express = require('express');
const Category = require('../models/Category');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

router.get('/', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { all } = req.query;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    if (all !== 'true') filter.active = true;
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
    res.json(categories);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
