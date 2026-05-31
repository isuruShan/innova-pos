const Settings = require('../models/Settings');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const { archiveToCloud } = require('../lib/s3Archiver');
const mongoose = require('mongoose');

/**
 * Hourly Cron Job.
 * Scans all stores/tenants. Calculates local time.
 * If local time is midnight (hour 00:xx), archives the completed local day's stock sale/consumption movements,
 * writes summary, and purges the old granular sale logs.
 */
async function runDailyArchivalForTimezoneStores(logger) {
  logger.info('[DailyArchiver] Starting hourly timezone check for daily stock movement archival...');
  try {
    // 1. Get all settings records with store timezone info
    const allSettings = await Settings.find({ storeId: { $ne: null } }).populate('storeId').lean();

    const nowUtc = new Date();

    for (const setting of allSettings) {
      const timezone = setting.timezone || 'Asia/Colombo';
      
      // Calculate local time for this store's timezone
      const localTimeStr = nowUtc.toLocaleString('en-US', { timeZone: timezone });
      const localDate = new Date(localTimeStr);
      const localHour = localDate.getHours();

      // We run archival at local midnight (hour 0)
      if (localHour === 0) {
        logger.info(`[DailyArchiver] Store ${setting.storeId?._name || setting.storeId} in timezone ${timezone} is currently at midnight. Processing archival...`);
        
        await archiveStoreStockMovementsForPreviousDay(setting.tenantId, setting.storeId._id || setting.storeId, localDate, timezone, logger);
      }
    }
  } catch (error) {
    logger.error('[DailyArchiver] Failed during daily stock archival task', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Aggregates, uploads, aggregates locally, and deletes granular sale/consumption records.
 */
async function archiveStoreStockMovementsForPreviousDay(tenantId, storeId, localDateNow, timezone, logger) {
  try {
    // Determine the previous calendar day in the local timezone
    const prevDayDate = new Date(localDateNow.getTime() - 24 * 60 * 60 * 1000);
    const year = prevDayDate.getFullYear();
    const month = String(prevDayDate.getMonth() + 1).padStart(2, '0');
    const day = String(prevDayDate.getDate()).padStart(2, '0');
    
    // Construct boundaries in local time
    const startStr = `${year}-${month}-${day}T00:00:00.000`;
    const endStr = `${year}-${month}-${day}T23:59:59.999`;

    // Convert local boundaries to UTC dates using timezone formatter
    const getUtcDate = (dateTimeStr) => {
      // Create formatter that parses timezone to parts
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
      });
      
      const date = new Date(dateTimeStr);
      // We want to find the UTC time such that its local representation in `timezone` is `date`.
      // Let's find the timezone offset in minutes at the given date.
      const parts = formatter.formatToParts(date);
      const partVal = (type) => parseInt(parts.find(p => p.type === type).value, 10);
      
      const utcTarget = Date.UTC(
        partVal('year'),
        partVal('month') - 1,
        partVal('day'),
        partVal('hour') === 24 ? 0 : partVal('hour'),
        partVal('minute'),
        partVal('second')
      );
      
      const offsetMs = date.getTime() - utcTarget;
      return new Date(date.getTime() + offsetMs);
    };

    const fromDateUtc = getUtcDate(startStr);
    const toDateUtc = getUtcDate(endStr);

    logger.info(`[DailyArchiver] Archiving date ${year}-${month}-${day} (UTC: ${fromDateUtc.toISOString()} - ${toDateUtc.toISOString()}) for store ${storeId}`);

    // Query all granular sale/consumption stock movements
    const movements = await StockMovement.find({
      tenantId,
      storeId,
      type: { $in: ['sale', 'consumption'] },
      createdAt: { $gte: fromDateUtc, $lte: toDateUtc },
    }).lean();

    logger.info(`[DailyArchiver] Found ${movements.length} granular sale/consumption movements to archive.`);

    if (movements.length === 0) {
      logger.info(`[DailyArchiver] No sale or consumption stock movements found to archive for store ${storeId} on date ${year}-${month}-${day}.`);
      return;
    }

    // 1. Archive granular data to Cloud Storage / Local Fallback
    const archivePayload = JSON.stringify({
      meta: {
        tenantId,
        storeId,
        date: `${year}-${month}-${day}`,
        archivedAt: new Date().toISOString(),
        totalMovements: movements.length,
      },
      movements,
    }, null, 2);

    const fileName = `archive/stock_movements_${storeId}_${year}-${month}-${day}.json`;
    await archiveToCloud(fileName, archivePayload, logger);

    // 2. Perform Local Stock Summary Aggregation (group by inventory item)
    const itemSummaries = {};
    for (const mov of movements) {
      const invId = mov.inventoryItemId.toString();
      if (!itemSummaries[invId]) {
        itemSummaries[invId] = {
          totalQty: 0,
          inventoryItemId: mov.inventoryItemId,
          createdBy: mov.createdBy,
        };
      }
      itemSummaries[invId].totalQty += mov.quantity; // Sum quantity changes (note: consumption/sales are usually negative quantities)
    }

    // 3. Purge granular records from MongoDB before writing the summaries
    // This ensures we do not accidentally delete the newly logged aggregated summary movements
    const purgeResult = await StockMovement.deleteMany({
      tenantId,
      storeId,
      type: { $in: ['sale', 'consumption'] },
      reason: { $ne: 'consumption' }, // Exclude archived summary movements if we ran it before
      createdAt: { $gte: fromDateUtc, $lte: toDateUtc },
    });

    logger.info(`[DailyArchiver] Purged ${purgeResult.deletedCount} granular movements. Inserting summaries for ${Object.keys(itemSummaries).length} items...`);

    // 4. Insert aggregated summaries
    for (const invId in itemSummaries) {
      const summary = itemSummaries[invId];
      
      // Fetch latest item info to determine previousQty/newQty for absolute accuracy
      const currentItem = await Inventory.findById(invId).lean();
      const currentQty = currentItem ? currentItem.quantity : 0;

      try {
        const createdSummary = await StockMovement.create({
          tenantId,
          storeId,
          inventoryItemId: invId,
          type: 'consumption',
          quantity: Math.round(summary.totalQty * 100) / 100,
          previousQty: currentQty,
          newQty: currentQty, // Keeping currentQty since this represents past changes already reflected
          reason: 'consumption',
          notes: `Archived summary for ${year}-${month}-${day}. Includes ${movements.filter(m => m.inventoryItemId.toString() === invId).length} granular movements.`,
          createdBy: summary.createdBy || new mongoose.Types.ObjectId(),
        });
        logger.info(`[DailyArchiver] Created summary consumption movement: ${createdSummary._id}`);
      } catch (err) {
        logger.error(`[DailyArchiver] Failed to create summary stock movement for item ${invId}`, {
          error: err.message,
          validationErrors: err.errors,
        });
        throw err;
      }
    }

    logger.info(`[DailyArchiver] Archival complete for store ${storeId}.`);

  } catch (err) {
    logger.error(`[DailyArchiver] Error archiving stock movements for store ${storeId}`, {
      error: err.message,
      stack: err.stack,
    });
  }
}

module.exports = { runDailyArchivalForTimezoneStores, archiveStoreStockMovementsForPreviousDay };
