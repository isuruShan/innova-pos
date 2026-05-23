const cron = require('node-cron');
const { deactivateExpiredTrials } = require('./expireAddonTrials');
const { archiveOldOrders } = require('./orderArchival');

/**
 * Initialize all scheduled jobs for the Admin Portal server.
 * Jobs run in the local timezone of the server.
 * @param {object} logger - Winston logger instance
 */
function initializeScheduledJobs(logger) {
  // Deactivate expired add-on trials daily at 3:00 AM
  // Cron expression: '0 3 * * *' = minute 0, hour 3, every day
  cron.schedule('0 3 * * *', async () => {
    logger.info('[Scheduler] Running add-on trial expiration job');
    try {
      const result = await deactivateExpiredTrials();
      logger.info('[Scheduler] Add-on trial expiration completed', result);
    } catch (error) {
      logger.error('[Scheduler] Add-on trial expiration failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  // Archive old completed/cancelled orders daily at 4:00 AM
  // Cron expression: '0 4 * * *' = minute 0, hour 4, every day
  cron.schedule('0 4 * * *', async () => {
    logger.info('[Scheduler] Running order archival database scaling job');
    try {
      const result = await archiveOldOrders(logger);
      logger.info('[Scheduler] Order archival database scaling job completed', result);
    } catch (error) {
      logger.error('[Scheduler] Order archival database scaling job failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info('[Scheduler] Scheduled jobs initialized', {
    jobs: [
      { name: 'Add-on Trial Expiration', schedule: '0 3 * * *', description: 'Deactivate add-ons with expired trials' },
      { name: 'Order Details Archival', schedule: '0 4 * * *', description: 'Archive completed/cancelled orders older than 90 days to Cold DB and Azure Blob Storage' },
    ],
  });
}

module.exports = { initializeScheduledJobs };
