'use strict';

const express = require('express');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore } = require('../middleware/storeScope');
const {
  getOrderVolumeAnalytics,
  getTopItemsAnalytics,
  getAnlyStatus,
} = require('../lib/anlyQueries');
const { runAnlySync, getAnlyConfig } = require('../jobs/anlySync');

const router = express.Router();

router.get(
  '/status',
  protect,
  authorize('merchant_admin'),
  tenantScope,
  async (req, res) => {
    try {
      const status = await getAnlyStatus(req.tenantId);
      res.json(status);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

router.get(
  '/order-volume',
  protect,
  authorize('merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const result = await getOrderVolumeAnalytics(
        req.tenantId,
        req.storeId || null,
        req.query.from,
        req.query.to,
      );
      if (result.error) return res.status(400).json({ message: result.error });
      res.json(result);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

router.get(
  '/top-items',
  protect,
  authorize('merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const sort = req.query.sort === 'revenue' ? 'revenue' : 'qty';
      const result = await getTopItemsAnalytics(
        req.tenantId,
        req.storeId || null,
        req.query.from,
        req.query.to,
        limit,
        sort,
      );
      if (result.error) return res.status(400).json({ message: result.error });
      res.json(result);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

router.post(
  '/sync/run',
  protect,
  authorize('superadmin'),
  async (req, res) => {
    try {
      const logger = req.app?.locals?.logger;
      const out = await runAnlySync(logger);
      res.json({ ok: true, ...out, config: getAnlyConfig() });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

module.exports = router;
