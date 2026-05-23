const Order = require('../models/Order');
const { getOrderArchiveModel } = require('../lib/archiveDb');
const { uploadObject } = require('@innovapos/object-storage');

async function archiveOldOrders(logger) {
  const log = logger || console;
  
  const retentionDays = parseInt(process.env.ORDER_ARCHIVAL_RETENTION_DAYS, 10) || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  log.info(`[OrderArchival] Starting archival job for orders older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`);
  
  let OrderArchive;
  try {
    OrderArchive = getOrderArchiveModel();
  } catch (err) {
    log.error(`[OrderArchival] Failed to retrieve OrderArchive model: ${err.message}`);
    return { success: false, error: err.message };
  }

  // Find all orders older than cutoff date that are completed or cancelled
  const query = {
    createdAt: { $lt: cutoffDate },
    status: { $in: ['completed', 'cancelled'] },
  };

  const totalToArchive = await Order.countDocuments(query);
  log.info(`[OrderArchival] Found ${totalToArchive} orders to archive.`);
  
  if (totalToArchive === 0) {
    return { success: true, archived: 0 };
  }

  // Retrieve orders in batches to prevent memory bloat
  const batchSize = 500;
  let cursor = Order.find(query).batchSize(batchSize).cursor();
  let currentBatch = [];
  let processedCount = 0;

  let orderDoc;
  while ((orderDoc = await cursor.next())) {
    currentBatch.push(orderDoc.toObject());

    if (currentBatch.length >= batchSize) {
      try {
        await processArchivalBatch(currentBatch, Order, OrderArchive, log);
        processedCount += currentBatch.length;
      } catch (err) {
        log.error(`[OrderArchival] Batch archival failed: ${err.message}`);
        // Return early so next runs can retry
        return { success: false, archived: processedCount, error: err.message };
      }
      currentBatch = [];
    }
  }

  // Process remaining items in final batch
  if (currentBatch.length > 0) {
    try {
      await processArchivalBatch(currentBatch, Order, OrderArchive, log);
      processedCount += currentBatch.length;
    } catch (err) {
      log.error(`[OrderArchival] Final batch archival failed: ${err.message}`);
      return { success: false, archived: processedCount, error: err.message };
    }
  }

  log.info(`[OrderArchival] Archival job completed. Archived ${processedCount} orders.`);
  return { success: true, archived: processedCount };
}

async function processArchivalBatch(orders, OrderHot, OrderCold, log) {
  const orderIds = orders.map((o) => o._id);
  
  // Group orders by tenantId to upload separate batch files per tenant
  const tenantGroups = {};
  for (const o of orders) {
    const tid = String(o.tenantId);
    if (!tenantGroups[tid]) tenantGroups[tid] = [];
    tenantGroups[tid].push(o);
  }

  // 1. Upload to Azure Blob Storage first
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  for (const [tenantId, tenantOrders] of Object.entries(tenantGroups)) {
    // Generate a unique file path key
    // Path: archives/orders/{tenantId}/{year}/{month}/{day}-{timestamp}-orders.json
    const timestamp = Date.now();
    const blobKey = `archives/orders/${tenantId}/${year}/${month}/${day}-${timestamp}-orders.json`;
    const serialized = JSON.stringify(tenantOrders, null, 2);
    const buffer = Buffer.from(serialized, 'utf-8');

    log.info(`[OrderArchival] Uploading batch of ${tenantOrders.length} orders for tenant ${tenantId} to Azure Blob: ${blobKey}`);
    try {
      await uploadObject(buffer, blobKey, 'application/json');
    } catch (azureErr) {
      log.error(`[OrderArchival] Azure Blob Storage upload failed for tenant ${tenantId}: ${azureErr.message}`);
      throw new Error(`Azure upload failed: ${azureErr.message}`);
    }
  }

  // 2. Write to Cold database (handling potential duplicate key insertion skips)
  log.info(`[OrderArchival] Writing batch of ${orders.length} orders to Cold Database...`);
  try {
    await OrderCold.insertMany(orders, { ordered: false });
  } catch (dbErr) {
    // If it's a bulk write duplicate key error, we can ignore duplicates because it means we already wrote them previously
    if (dbErr.code === 11000 || (dbErr.writeErrors && dbErr.writeErrors.every(e => e.code === 11000))) {
      log.warn(`[OrderArchival] Duplicate keys encountered during Cold DB insert. Proceeding safely.`);
    } else {
      log.error(`[OrderArchival] Cold database write failed: ${dbErr.message}`);
      throw dbErr;
    }
  }

  // 3. Delete from Hot database
  log.info(`[OrderArchival] Deleting batch of ${orders.length} orders from Hot Database...`);
  try {
    await OrderHot.deleteMany({ _id: { $in: orderIds } });
  } catch (deleteErr) {
    log.error(`[OrderArchival] Hot database delete failed: ${deleteErr.message}`);
    throw deleteErr;
  }
}

module.exports = {
  archiveOldOrders,
};
