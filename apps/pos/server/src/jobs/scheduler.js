const cron = require('node-cron');
const { cleanupOldNotifications } = require('./cleanupNotifications');
const { runDailyArchivalForTimezoneStores } = require('./dailyStockArchiver');
const { processScheduledOrders } = require('./orderScheduler');

/**
 * Initialize all scheduled jobs for the POS server.
 * Jobs run in the local timezone of the server.
 * @param {object} logger - Winston logger instance
 */
function initializeScheduledJobs(logger) {
  // Process scheduled orders every minute
  // Cron expression: '*/1 * * * *' = every minute
  cron.schedule('*/1 * * * *', async () => {
    logger.info('[Scheduler] Checking for scheduled orders due for activation');
    try {
      await processScheduledOrders(logger);
    } catch (error) {
      logger.error('[Scheduler] Scheduled order activation failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

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

  // Hourly Daily Stock Movement Archiver check
  // Cron expression: '0 * * * *' = at the start of every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('[Scheduler] Running hourly stock movement archiver check');
    try {
      await runDailyArchivalForTimezoneStores(logger);
    } catch (error) {
      logger.error('[Scheduler] Hourly stock movement archiver check failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info('[Scheduler] Scheduled jobs initialized', {
    jobs: [
      { name: 'Scheduled Order Activation', schedule: '*/1 * * * *', description: 'Activate scheduled pickup/delivery orders' },
      { name: 'Notification Cleanup', schedule: '0 2 * * *', description: 'Delete notifications older than 30 days' },
      { name: 'Stock Movement Archiver', schedule: '0 * * * *', description: 'Compress & archive stock sales data' },
    ],
  });
}

module.exports = { initializeScheduledJobs };
