const express = require('express');
const Category = require('../models/Category');
const { protect, authorize, tenantScope } = require('../middleware/auth');
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
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
