const express = require('express');
const MenuItem = require('../models/MenuItem');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

const MENU_SORT_FIELDS = {
  name: 'name',
  category: 'category',
  price: 'price',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
};

const DEFAULT_MENU_SORT = { category: 1, sortOrder: 1, name: 1 };

/** Read-only menu for promotion builder in admin portal */
router.get('/', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const sort = parseSortQuery(req, MENU_SORT_FIELDS, DEFAULT_MENU_SORT);
    const items = await MenuItem.find(filter).sort(sort);
    res.json(items);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
