require('dotenv').config();
const { runDailyArchivalForTimezoneStores, archiveStoreStockMovementsForPreviousDay } = require('../jobs/dailyStockArchiver');
const Settings = require('../models/Settings');
const Store = require('../models/Store');
const StockMovement = require('../models/StockMovement');
const connectDB = require('../config/db');
const mongoose = require('mongoose');

// Mock logger
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
};

async function runTest() {
  console.log('Connecting to database...');
  await connectDB(logger);

  try {
    // 1. Fetch store settings
    let testSetting;
    const settings = await Settings.find({ storeId: "6a1ab2602fb63853e86f208b" }).limit(1).lean();
    if (settings.length === 0) {
      // Create settings for the right store
      const created = await Settings.create({
        tenantId: "69fe41e17f4fedba632136a8",
        storeId: "6a1ab2602fb63853e86f208b",
        timezone: "Asia/Colombo"
      });
      testSetting = created.toObject();
    } else {
      testSetting = settings[0];
    }
    console.log(`Running test archival for tenant: ${testSetting.tenantId}, store: ${testSetting.storeId}`);

    // Create a mock stock sale movement for "yesterday"
    const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: testSetting.timezone }));
    const prevDay = new Date(nowLocal.getTime() - 24 * 60 * 60 * 1000);
    
    // Create detailed movement
    const mockMovement = await StockMovement.create({
      tenantId: testSetting.tenantId,
      storeId: testSetting.storeId,
      inventoryItemId: new mongoose.Types.ObjectId(), // dummy item
      type: 'sale',
      quantity: -5,
      previousQty: 10,
      newQty: 5,
      reason: 'sale',
      createdBy: new mongoose.Types.ObjectId(),
      createdAt: prevDay, // Set to yesterday
    });

    console.log('Created dummy sale movement:', mockMovement._id);

    // Run archival manually for this store
    await archiveStoreStockMovementsForPreviousDay(
      testSetting.tenantId,
      testSetting.storeId,
      nowLocal, // simulate "now" in local time
      testSetting.timezone,
      logger
    );

    // Verify detailed movement was purged
    const checkPurged = await StockMovement.findById(mockMovement._id);
    if (!checkPurged) {
      console.log('SUCCESS: Granular movement successfully purged.');
    } else {
      console.error('ERROR: Granular movement still exists!');
    }

    // Verify summary movement was created
    const checkSummary = await StockMovement.findOne({
      tenantId: testSetting.tenantId,
      storeId: testSetting.storeId,
      type: 'consumption',
      reason: 'consumption',
      notes: new RegExp(`Archived summary for`),
    });

    if (checkSummary) {
      console.log('SUCCESS: Summary consumption movement logged:', checkSummary.notes);
    } else {
      console.error('ERROR: No summary movement found!');
    }

  } catch (err) {
    console.error('Test run failed with error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('DB connection closed.');
  }
}

runTest();
