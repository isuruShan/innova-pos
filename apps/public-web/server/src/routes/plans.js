const express = require('express');
const { sendRouteError } = require('@innovapos/shared-middleware');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { planAudienceFromRequest } = require('../utils/planAudienceFromRequest');

const router = express.Router();

const PLAN_SELECT =
  'name code billingCycle amount currency durationDays description featureLines isDefault planAudience ' +
  'planTagShow planTagText planTagTextColor planTagBgMode planTagSolidColor planTagGradFrom planTagGradTo planTagGradAngle ' +
  'planCardBgMode planCardSolidColor planCardGradFrom planCardGradTo planCardGradAngle planCardUseLightText';

// GET /plans/public/audience — detect local vs international from visitor IP (VPN-friendly)
router.get('/public/audience', async (req, res) => {
  try {
    const { audience, countryCode } = planAudienceFromRequest(req, req.query.audience);
    res.json({ audience, countryCode });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /plans/public — regional catalogue; audience from query or server geo
router.get('/public', async (req, res) => {
  try {
    const { audience } = planAudienceFromRequest(req, req.query.audience);
    const filter = { isActive: true, isPublic: true, planAudience: audience };
    const plans = await SubscriptionPlan.find(filter)
      .sort({ isDefault: -1, durationDays: 1, createdAt: 1 })
      .select(PLAN_SELECT)
      .lean();
    res.json(plans);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
