'use strict';

const express = require('express');
const Tenant = require('../models/Tenant');
const { isLoyaltyEffective, isQrOrderingEffective } = require('@innovapos/paid-addons');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');

const router = express.Router();

/** Effective paid add-ons for the signed-in tenant (POS UI gating). */
router.get(
  '/paid-addons',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  async (req, res) => {
    try {
      const tenant = await Tenant.findById(req.tenantId).select('paidAddons').lean();
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      const paidAddons = tenant.paidAddons || {};
      res.json({
        loyalty: isLoyaltyEffective(paidAddons),
        qrOrdering: isQrOrderingEffective(paidAddons),
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

module.exports = router;
