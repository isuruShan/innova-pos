const express = require('express');
const Tenant = require('../models/Tenant');
const { authenticateJWT, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

/**
 * POST /api/subscription/dismiss-expiry-warning
 * Records that the current user has dismissed the expiry warning banner
 */
router.post('/dismiss-expiry-warning', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'No tenant context found'
      });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Add user to the dismissedBy array if not already present
    const alreadyDismissed = tenant.subscription?.expiryWarningDismissedBy?.some(
      entry => String(entry.userId) === String(userId)
    );

    if (!alreadyDismissed) {
      if (!tenant.subscription) {
        tenant.subscription = {};
      }
      if (!tenant.subscription.expiryWarningDismissedBy) {
        tenant.subscription.expiryWarningDismissedBy = [];
      }
      
      tenant.subscription.expiryWarningDismissedBy.push({
        userId,
        dismissedAt: new Date()
      });

      await tenant.save();
    }

    res.json({
      success: true,
      message: 'Warning dismissed successfully'
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
