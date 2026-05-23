'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Mock Object Storage so we don't need real Azure Storage credentials for testing
const objectStorage = require('@innovapos/object-storage');
const originalUploadObject = objectStorage.uploadObject;
let uploadMockCalled = [];

objectStorage.uploadObject = async (buffer, key, mimeType) => {
  uploadMockCalled.push({ key, mimeType, size: buffer.length });
  console.log(`[Mock Azure Storage] Successfully uploaded raw buffer to Key: "${key}" (mime: ${mimeType}, size: ${buffer.length} bytes)`);
  return key;
};

const Tenant = require('../models/Tenant');
const Order = require('../models/Order');
const { initializeArchiveDb, getOrderArchiveModel } = require('../lib/archiveDb');
const { archiveOldOrders } = require('../jobs/orderArchival');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/innovapos';

async function run() {
  console.log(`Connecting to Hot DB: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Hot DB Connected.');

  // Initialize Archive Db connection and retrieve model
  const { OrderArchive } = initializeArchiveDb();

  // Ensure test tenant exists
  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'test-business',
      businessName: 'Test Business POS',
      status: 'active',
      subscriptionStatus: 'active',
      countryIso: 'LK',
    });
    console.log(`Created test tenant: ${tenant.businessName}`);
  }

  // Clear existing test orders for clean runs
  await Order.deleteMany({ tenantId: tenant._id });
  await OrderArchive.deleteMany({ tenantId: tenant._id });
  console.log('Cleared existing test orders.');

  // Create mock orders
  const oldCutoffDate = new Date();
  oldCutoffDate.setDate(oldCutoffDate.getDate() - 100); // 100 days ago

  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

  console.log('Seeding test orders...');
  
  // 1. Old completed order (SHOULD be archived)
  const order1 = await Order.create({
    tenantId: tenant._id,
    orderNumber: 1001,
    orderType: 'dine-in',
    status: 'completed',
    totalAmount: 1500,
    createdAt: oldCutoffDate,
    updatedAt: oldCutoffDate,
  });

  // 2. Old cancelled order (SHOULD be archived)
  const order2 = await Order.create({
    tenantId: tenant._id,
    orderNumber: 1002,
    orderType: 'takeaway',
    status: 'cancelled',
    totalAmount: 450,
    createdAt: oldCutoffDate,
    updatedAt: oldCutoffDate,
  });

  // 3. Old pending order (SHOULD NOT be archived - only completed/cancelled are archived)
  const order3 = await Order.create({
    tenantId: tenant._id,
    orderNumber: 1003,
    orderType: 'dine-in',
    status: 'pending',
    totalAmount: 900,
    createdAt: oldCutoffDate,
    updatedAt: oldCutoffDate,
  });

  // 4. Recent completed order (SHOULD NOT be archived - too fresh)
  const order4 = await Order.create({
    tenantId: tenant._id,
    orderNumber: 1004,
    orderType: 'dine-in',
    status: 'completed',
    totalAmount: 2200,
    createdAt: recentDate,
    updatedAt: recentDate,
  });

  console.log('Seeded 4 orders.');

  // Set archival environment retention configuration
  process.env.ORDER_ARCHIVAL_RETENTION_DAYS = '90';

  // Run the archival worker
  console.log('\n--- Running archiveOldOrders worker ---');
  const result = await archiveOldOrders(console);
  console.log('Worker Result:', result);
  console.log('--- Archival execution finished ---\n');

  // Verify Hot database states
  const hotCompletedOld = await Order.findOne({ _id: { $in: [order1._id, order2._id] } });
  const hotPendingOld = await Order.findById(order3._id);
  const hotCompletedRecent = await Order.findById(order4._id);

  console.log('--- Hot DB Verification ---');
  console.log(`Old completed/cancelled orders deleted: ${hotCompletedOld === null ? 'PASS' : 'FAIL'}`);
  console.log(`Old pending order still in Hot DB: ${hotPendingOld !== null ? 'PASS' : 'FAIL'}`);
  console.log(`Recent completed order still in Hot DB: ${hotCompletedRecent !== null ? 'PASS' : 'FAIL'}`);

  // Verify Cold database states
  const coldCount = await OrderArchive.countDocuments({ tenantId: tenant._id });
  const coldOrder1 = await OrderArchive.findById(order1._id);
  const coldOrder2 = await OrderArchive.findById(order2._id);

  console.log('\n--- Cold DB Verification ---');
  console.log(`Total orders in Cold DB: ${coldCount} (Expected: 2) -> ${coldCount === 2 ? 'PASS' : 'FAIL'}`);
  console.log(`Order 1 present in Cold DB: ${coldOrder1 !== null ? 'PASS' : 'FAIL'}`);
  console.log(`Order 2 present in Cold DB: ${coldOrder2 !== null ? 'PASS' : 'FAIL'}`);

  // Verify Azure Mock uploads
  console.log('\n--- Azure Blob Storage Verification ---');
  console.log(`Azure Uploads count: ${uploadMockCalled.length} (Expected: 1 or more) -> ${uploadMockCalled.length >= 1 ? 'PASS' : 'FAIL'}`);
  if (uploadMockCalled.length > 0) {
    console.log(`Azure Blob Key structure: "${uploadMockCalled[0].key}"`);
    console.log(`Azure Blob Key starts with "archives/orders/": ${uploadMockCalled[0].key.startsWith('archives/orders/') ? 'PASS' : 'FAIL'}`);
  }

  // Restore mock
  objectStorage.uploadObject = originalUploadObject;

  // Clean up
  await Order.deleteMany({ tenantId: tenant._id });
  await OrderArchive.deleteMany({ tenantId: tenant._id });
  console.log('\nCleared test orders from databases.');

  await mongoose.disconnect();
  // Close the connection established in initializeArchiveDb
  const { connection } = initializeArchiveDb();
  await connection.close();
  console.log('Disconnected.');
}

run().catch((err) => {
  console.error('Test Execution failed:', err);
  mongoose.disconnect();
});
