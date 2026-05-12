const express = require('express');
const { sendRouteError } = require('@innovapos/shared-middleware');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const router = express.Router();

// GET /plans/public — optional ?audience=local|international (region-specific catalogue)
router.get('/public', async (req, res) => {
  try {
    const filter = { isActive: true, isPublic: true };
    const a = req.query.audience;
    if (a === 'local' || a === 'international') filter.planAudience = a;
    const plans = await SubscriptionPlan.find(filter)
      .sort({ isDefault: -1, durationDays: 1, createdAt: 1 })
      .select(
        'name code billingCycle amount currency durationDays description featureLines isDefault planAudience ' +
          'planTagShow planTagText planTagTextColor planTagBgMode planTagSolidColor planTagGradFrom planTagGradTo planTagGradAngle ' +
          'planCardBgMode planCardSolidColor planCardGradFrom planCardGradTo planCardGradAngle planCardUseLightText'
      )
      .lean();
    res.json(plans);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
