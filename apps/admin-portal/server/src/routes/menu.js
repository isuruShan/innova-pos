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

router.put('/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!item) return res.status(404).json({ message: 'Menu item not found' });

    const updates = req.body;
    for (const key of Object.keys(updates)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = item;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = updates[key];
        item.markModified(parts[0]);
      } else {
        item[key] = updates[key];
      }
    }

    await item.save();
    res.json(item);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
