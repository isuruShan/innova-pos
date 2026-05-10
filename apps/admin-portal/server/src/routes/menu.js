const express = require('express');
const MenuItem = require('../models/MenuItem');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

/** Read-only menu for promotion builder in admin portal */
router.get('/', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const items = await MenuItem.find({ tenantId: req.tenantId, ...buildStoreFilter(req) }).sort({ category: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
