const Notification = require('../models/Notification');
const logger = require('@innovapos/logger');

/**
 * Cleanup notifications older than 30 days across all tenants.
 * This job should run nightly (e.g., 2 AM local time).
 * 
 * Optimized approach:
 * - Single deleteMany query with indexed createdAt field
 * - Uses MongoDB TTL-like behavior but with manual cleanup for control
 * - Processes all tenants in one operation
 */
async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    logger.info('[Notification Cleanup] Starting cleanup of notifications older than 30 days', {
      cutoffDate: thirtyDaysAgo.toISOString(),
    });

    // Delete all notifications older than 30 days (across all tenants)
    // This is optimized because:
    // 1. Single query instead of per-tenant queries
    // 2. Uses createdAt index which exists in timestamps: true
    // 3. MongoDB handles the deletion efficiently
    const result = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
    });

    logger.info('[Notification Cleanup] Completed successfully', {
      deletedCount: result.deletedCount,
      cutoffDate: thirtyDaysAgo.toISOString(),
    });

    return { success: true, deletedCount: result.deletedCount };
  } catch (error) {
    logger.error('[Notification Cleanup] Failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { cleanupOldNotifications };
