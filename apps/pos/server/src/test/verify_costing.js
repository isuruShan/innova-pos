'use strict';

require('dotenv').config({ path: `${__dirname}/../../.env` });
const mongoose = require('mongoose');
const { loadSecretsEnvOrExit } = require('@innovapos/runtime-env');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

const Inventory = require('../models/Inventory');
const GoodsReceipt = require('../models/GoodsReceipt');
const { recalculateInventoryCosts } = require('../utils/costCalculation');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function run() {
  await loadSecretsEnvOrExit();
  const MONGO_URI = getMongoConnectionString();
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to database.');

  const tenantId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();
  const supplierId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const scope = { tenantId, storeId };

  console.log('\n--- 1. Set up inventory items ---');
  const invItem = await Inventory.create({
    ...scope,
    itemName: 'Test Ingredient A',
    unit: 'kg',
    quantity: 15,
    minThreshold: 5,
  });
  console.log(`Created inventory item ${invItem.itemName} (ID: ${invItem._id}) with initial quantity: 15`);

  // Assert initially all costs are 0
  assert(invItem.lastCost === 0, 'Initial lastCost is 0');
  assert(invItem.wacCost === 0, 'Initial wacCost is 0');
  assert(invItem.fifoCost === 0, 'Initial fifoCost is 0');
  assert(invItem.lifoCost === 0, 'Initial lifoCost is 0');

  console.log('\n--- 2. Add some goods receipt notes (GRNs) ---');

  // Receipt 1 (Oldest): 10 kg @ $10.00
  const grn1 = await GoodsReceipt.create({
    ...scope,
    receiptNumber: `GRN-TEST-1-${Date.now()}`,
    type: 'receipt',
    supplierId,
    status: 'confirmed',
    createdBy: userId,
    confirmedAt: new Date(Date.now() - 3600000 * 3), // 3 hours ago
    items: [
      {
        inventoryItemId: invItem._id,
        itemName: invItem.itemName,
        unit: invItem.unit,
        orderedQty: 10,
        receivedQty: 10,
        acceptedQty: 10,
        unitPrice: 10.00,
      }
    ]
  });

  // Receipt 2: 10 kg @ $20.00
  const grn2 = await GoodsReceipt.create({
    ...scope,
    receiptNumber: `GRN-TEST-2-${Date.now()}`,
    type: 'receipt',
    supplierId,
    status: 'confirmed',
    createdBy: userId,
    confirmedAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
    items: [
      {
        inventoryItemId: invItem._id,
        itemName: invItem.itemName,
        unit: invItem.unit,
        orderedQty: 10,
        receivedQty: 10,
        acceptedQty: 10,
        unitPrice: 20.00,
      }
    ]
  });

  // Receipt 3 (Newest): 10 kg @ $30.00
  const grn3 = await GoodsReceipt.create({
    ...scope,
    receiptNumber: `GRN-TEST-3-${Date.now()}`,
    type: 'receipt',
    supplierId,
    status: 'confirmed',
    createdBy: userId,
    confirmedAt: new Date(Date.now() - 3600000 * 1), // 1 hour ago
    items: [
      {
        inventoryItemId: invItem._id,
        itemName: invItem.itemName,
        unit: invItem.unit,
        orderedQty: 10,
        receivedQty: 10,
        acceptedQty: 10,
        unitPrice: 30.00,
      }
    ]
  });

  console.log('Confirmed 3 goods receipts:');
  console.log(' - Oldest: 10 kg @ $10.00');
  console.log(' - Middle: 10 kg @ $20.00');
  console.log(' - Newest: 10 kg @ $30.00');

  console.log('\n--- 3. Recalculate costs (Quantity = 15) ---');
  await recalculateInventoryCosts(tenantId, storeId, invItem._id);

  let updatedItem = await Inventory.findById(invItem._id);
  console.log('Recalculated costing fields (Q = 15):');
  console.log(` - lastCost: ${updatedItem.lastCost} (Expected: 30.00)`);
  console.log(` - wacCost: ${updatedItem.wacCost} (Expected: 20.00)`);
  console.log(` - fifoCost: ${updatedItem.fifoCost} (Expected: 26.67)`);
  console.log(` - lifoCost: ${updatedItem.lifoCost} (Expected: 13.33)`);

  assert(updatedItem.lastCost === 30.00, 'lastCost is 30.00');
  assert(updatedItem.wacCost === 20.00, 'wacCost is 20.00 (Total cost: 10*10 + 10*20 + 10*30 = 600, total qty: 30, WAC = 600/30 = 20)');
  
  // FIFO (remains in stock is newest): 10 @ 30.00 + 5 @ 20.00 = 400. Average = 400 / 15 = 26.67
  assert(updatedItem.fifoCost === 26.67, 'fifoCost is 26.67');

  // LIFO (remains in stock is oldest): 10 @ 10.00 + 5 @ 20.00 = 200. Average = 200 / 15 = 13.33
  assert(updatedItem.lifoCost === 13.33, 'lifoCost is 13.33');

  console.log('\n--- 4. Update quantity and recalculate (Quantity = 5) ---');
  updatedItem.quantity = 5;
  await updatedItem.save();

  await recalculateInventoryCosts(tenantId, storeId, invItem._id);
  updatedItem = await Inventory.findById(invItem._id);

  console.log('Recalculated costing fields (Q = 5):');
  console.log(` - lastCost: ${updatedItem.lastCost} (Expected: 30.00)`);
  console.log(` - wacCost: ${updatedItem.wacCost} (Expected: 20.00)`);
  console.log(` - fifoCost: ${updatedItem.fifoCost} (Expected: 30.00)`);
  console.log(` - lifoCost: ${updatedItem.lifoCost} (Expected: 10.00)`);

  // FIFO (remains in stock is newest): 5 @ 30.00 = 150. Average = 150 / 5 = 30
  assert(updatedItem.fifoCost === 30.00, 'fifoCost is 30.00 for Q = 5');

  // LIFO (remains in stock is oldest): 5 @ 10.00 = 50. Average = 50 / 5 = 10
  assert(updatedItem.lifoCost === 10.00, 'lifoCost is 10.00 for Q = 5');

  console.log('\n--- 5. Clean up test records ---');
  await Inventory.deleteMany(scope);
  await GoodsReceipt.deleteMany(scope);
  console.log('Cleaned up test data.');

  await mongoose.disconnect();
  console.log('Disconnected.');
  console.log('All costing verification checks passed successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
