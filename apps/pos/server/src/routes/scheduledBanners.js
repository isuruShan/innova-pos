const express = require('express');
const ScheduledBanner = require('../models/ScheduledBanner');
const Tenant = require('../models/Tenant');
const { authenticateJWT, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

// GET /api/scheduled-banners/active — get active banners for current user's tenant (authenticated)
router.get('/active', authenticateJWT, async (req, res) => {
  try {
    const { platform } = req.query;
    if (!platform) {
      return res.status(400).json({ message: 'platform query parameter is required' });
    }

    // Only display banners to trial tenants
    if (req.user.tenantId) {
      const tenant = await Tenant.findById(req.user.tenantId).lean();
      const isTrial = tenant && tenant.status === 'active' && tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date() <= new Date(tenant.trialEndsAt);
      if (!isTrial) {
        return res.json([]);
      }
    }

    const now = new Date();
    const banners = await ScheduledBanner.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      platforms: platform,
      userTypes: req.user.role,
    }).lean();

    res.json(banners);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
