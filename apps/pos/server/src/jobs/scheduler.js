const cron = require('node-cron');
const logger = require('@innovapos/logger');
const { cleanupOldNotifications } = require('./cleanupNotifications');

/**
 * Initialize all scheduled jobs for the POS server.
 * Jobs run in the local timezone of the server.
 */
function initializeScheduledJobs() {
  // Cleanup old notifications daily at 2:00 AM
  // Cron expression: '0 2 * * *' = minute 0, hour 2, every day
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Scheduler] Running notification cleanup job');
    try {
      const result = await cleanupOldNotifications();
      logger.info('[Scheduler] Notification cleanup completed', result);
    } catch (error) {
      logger.error('[Scheduler] Notification cleanup failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info('[Scheduler] Scheduled jobs initialized', {
    jobs: [
      { name: 'Notification Cleanup', schedule: '0 2 * * *', description: 'Delete notifications older than 30 days' },
    ],
  });
}

module.exports = { initializeScheduledJobs };
