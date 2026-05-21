const cron = require('node-cron');
const { deactivateExpiredTrials } = require('./expireAddonTrials');

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

  logger.info('[Scheduler] Scheduled jobs initialized', {
    jobs: [
      { name: 'Add-on Trial Expiration', schedule: '0 3 * * *', description: 'Deactivate add-ons with expired trials' },
    ],
  });
}

module.exports = { initializeScheduledJobs };
