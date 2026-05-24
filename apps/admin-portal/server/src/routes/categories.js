const express = require('express');
const Category = require('../models/Category');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

const CATEGORY_SORT_FIELDS = {
  name: 'name',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  active: 'active',
};

const DEFAULT_CATEGORY_SORT = { sortOrder: 1, name: 1 };

router.get('/', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { all } = req.query;
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    if (all !== 'true') filter.active = true;
    const sort = parseSortQuery(req, CATEGORY_SORT_FIELDS, DEFAULT_CATEGORY_SORT);
    const categories = await Category.find(filter).sort(sort);
    res.json(categories);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
