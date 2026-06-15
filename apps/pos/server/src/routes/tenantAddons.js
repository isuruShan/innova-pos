'use strict';

const express = require('express');
const Tenant = require('../models/Tenant');
// Require model files to register them with mongoose to prevent SchemaNotFound error during populate
require('../models/SubscriptionPlan');
const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const { isLoyaltyEffective, isQrOrderingEffective, isTableManagementEffective, isUberEatsEffective, isDualScreenEffective, isWhatsappEffective } = require('@innovapos/paid-addons');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');

const router = express.Router();

/** Effective paid add-ons for the signed-in tenant (POS UI gating). */
router.get(
  '/paid-addons',
  protect,
  authorize('cashier', 'kitchen', 'steward', 'manager', 'merchant_admin', 'superadmin'),
  tenantScope,
  async (req, res) => {
    try {
      const tenant = await Tenant.findById(req.tenantId)
        .populate('assignedPlanId')
        .lean();
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      
      const whatsappDef = await PaidAddonDefinition.findOne({ code: 'whatsapp_integration' }).lean();
      const whatsappActiveGlobal = whatsappDef ? whatsappDef.isActive !== false : true;

      res.json({
        loyalty: isLoyaltyEffective(tenant),
        qrOrdering: isQrOrderingEffective(tenant),
        tableManagement: isTableManagementEffective(tenant),
        uberEats: isUberEatsEffective(tenant),
        dualScreen: isDualScreenEffective(tenant),
        whatsapp: whatsappActiveGlobal ? isWhatsappEffective(tenant) : false,
      });
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

module.exports = router;
