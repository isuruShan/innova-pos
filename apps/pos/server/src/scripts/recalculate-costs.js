'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { loadSecretsEnvOrExit } = require('@innovapos/runtime-env');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const Inventory = require('../models/Inventory');
const { recalculateInventoryCosts } = require('../utils/costCalculation');

async function run() {
  console.log('--- Starting Recalculation of Inventory Costs ---');
  
  try {
    // 1. Load Secrets & Env
    await loadSecretsEnvOrExit();
    
    // 2. Connect to MongoDB
    const mongoUri = getMongoConnectionString();
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // 3. Fetch all inventory items
    const items = await Inventory.find({}).lean();
    console.log(`Found ${items.length} inventory items in total.`);

    if (items.length === 0) {
      console.log('No inventory items to process.');
      await mongoose.disconnect();
      return;
    }

    // 4. Group items by tenantId and storeId to minimize DB query overhead
    const groups = {};
    for (const item of items) {
      const tenantKey = String(item.tenantId);
      const storeKey = item.storeId ? String(item.storeId) : 'none';
      const groupKey = `${tenantKey}_${storeKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          tenantId: item.tenantId,
          storeId: item.storeId || null,
          itemIds: [],
        };
      }
      groups[groupKey].itemIds.push(String(item._id));
    }

    console.log(`Grouped items into ${Object.keys(groups).length} unique tenant-store contexts.`);

    // 5. Run recalculation for each context
    let processedCount = 0;
    for (const key of Object.keys(groups)) {
      const { tenantId, storeId, itemIds } = groups[key];
      console.log(`Processing Group (Tenant: ${tenantId}, Store: ${storeId || 'N/A'}) with ${itemIds.length} items...`);
      
      await recalculateInventoryCosts(tenantId, storeId, itemIds);
      processedCount += itemIds.length;
      console.log(`Completed Group. Progress: ${processedCount}/${items.length} items.`);
    }

    console.log('--- All inventory costs recalculated successfully ---');
  } catch (error) {
    console.error('Error running recalculate-costs script:', error);
  } finally {
    // 6. Close Connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
