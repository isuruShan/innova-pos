'use strict';

const express = require('express');
const {
  getOrderVolumeAnalytics,
  getTopItemsAnalytics,
  getAnlyStatus,
} = require('@innovapos/analytics-core');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore } = require('../middleware/storeScope');

const router = express.Router();

const readRoles = ['manager', 'merchant_admin'];

router.get(
  '/status',
  protect,
  authorize(...readRoles),
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
  authorize(...readRoles),
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
  authorize(...readRoles),
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

module.exports = router;
