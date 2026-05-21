const Tenant = require('../models/Tenant');
const { createLogger } = require('@innovapos/logger');
const logger = createLogger('addon-trial-expiration');
const { KNOWN_ENTITLEMENT_KEYS } = require('@innovapos/paid-addons');

/**
 * Deactivate expired add-on trials across all tenants.
 * This job should run nightly (e.g., 3 AM local time).
 * 
 * Auto-deactivates add-ons where:
 * - Trial has expired (trialEndsAt < now)
 * - Add-on is still active
 * - No paid subscription exists (period not set or activatedAt is same as trialActivatedAt)
 */
async function deactivateExpiredTrials() {
  try {
    const now = new Date();
    
    logger.info('[Trial Expiration] Starting deactivation of expired trials', {
      currentTime: now.toISOString(),
    });

    // Find all tenants with active add-ons
    const tenants = await Tenant.find({
      $or: KNOWN_ENTITLEMENT_KEYS.map((key) => ({
        [`paidAddons.${key}.active`]: true,
        [`paidAddons.${key}.trialEndsAt`]: { $exists: true, $ne: null, $lt: now },
      })),
    });

    logger.info(`[Trial Expiration] Found ${tenants.length} tenants with potentially expired trials`);

    let deactivatedCount = 0;

    for (const tenant of tenants) {
      let modified = false;

      for (const entitlementKey of KNOWN_ENTITLEMENT_KEYS) {
        const addon = tenant.paidAddons?.[entitlementKey];
        
        if (!addon || !addon.active) continue;
        if (!addon.trialEndsAt) continue;
        
        const trialEnd = new Date(addon.trialEndsAt);
        if (trialEnd > now) continue; // Trial still active

        // Check if they have a paid subscription
        // If activatedAt is different from trialActivatedAt, they've paid
        const hasPaidSubscription = 
          addon.periodEndsAt && 
          addon.activatedAt && 
          addon.trialActivatedAt && 
          addon.activatedAt.getTime() !== addon.trialActivatedAt.getTime();

        if (hasPaidSubscription) {
          logger.info(`[Trial Expiration] Skipping ${entitlementKey} for tenant ${tenant.businessName} - has paid subscription`);
          continue;
        }

        // Deactivate the trial
        tenant.paidAddons[entitlementKey].active = false;
        modified = true;
        deactivatedCount++;

        logger.info(`[Trial Expiration] Deactivated ${entitlementKey} trial for tenant ${tenant.businessName}`, {
          tenantId: tenant._id,
          trialEnd: trialEnd.toISOString(),
        });
      }

      if (modified) {
        await tenant.save();
      }
    }

    logger.info('[Trial Expiration] Completed successfully', {
      tenantsProcessed: tenants.length,
      trialsDeactivated: deactivatedCount,
    });

    return { success: true, deactivatedCount };
  } catch (error) {
    logger.error('[Trial Expiration] Failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { deactivateExpiredTrials };
