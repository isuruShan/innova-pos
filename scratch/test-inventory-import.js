require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Inventory = require('../apps/pos/server/src/models/Inventory');
const StockMovement = require('../apps/pos/server/src/models/StockMovement');
const Store = require('../apps/pos/server/src/models/Store');
const User = require('../apps/pos/server/src/models/User');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find a real store
  const store = await Store.findOne();
  if (!store) {
    console.error('No store found in DB');
    process.exit(1);
  }

  // Find a user
  const user = await User.findOne();
  if (!user) {
    console.error('No user found in DB');
    process.exit(1);
  }

  const tenantId = store.tenantId;
  const storeId = store._id;
  const userId = user._id;

  const testItemName = 'Test Import Stock Item - ' + Date.now();
  const initialQty = 75;

  console.log(`Simulating POST /inventory with initial stock quantity: ${initialQty}`);

  // Create the inventory item simulating the route logic
  const item = await Inventory.create({
    tenantId,
    storeId,
    itemName: testItemName,
    unit: 'kg',
    quantity: initialQty,
    minThreshold: 5,
    createdBy: userId
  });

  console.log(`Created inventory item ID: ${item._id}, name: "${item.itemName}", quantity: ${item.quantity}`);

  // Create StockMovement if initialQty > 0 (as implemented in routes/inventory.js)
  if (initialQty > 0) {
    await StockMovement.create({
      tenantId,
      storeId,
      inventoryItemId: item._id,
      type: 'opening',
      quantity: initialQty,
      previousQty: 0,
      newQty: initialQty,
      reason: 'opening_balance',
      notes: 'Initial stock on item creation/import',
      createdBy: userId
    });
    console.log('Logged stock movement opening balance record.');
  }

  // Assertions
  // 1. Verify item in DB has quantity = 75
  const itemInDb = await Inventory.findById(item._id);
  if (itemInDb.quantity !== 75) {
    console.error(`FAIL: expected item quantity to be 75, got ${itemInDb.quantity}`);
  } else {
    console.log('PASS: item quantity in DB is correctly 75');
  }

  // 2. Verify stock movement was created
  const movement = await StockMovement.findOne({ inventoryItemId: item._id });
  if (!movement) {
    console.error('FAIL: expected StockMovement to be created, but none found');
  } else {
    console.log('PASS: StockMovement record found');
    if (movement.type !== 'opening') {
      console.error(`FAIL: expected movement type to be 'opening', got '${movement.type}'`);
    } else {
      console.log("PASS: movement type is 'opening'");
    }
    if (movement.reason !== 'opening_balance') {
      console.error(`FAIL: expected movement reason to be 'opening_balance', got '${movement.reason}'`);
    } else {
      console.log("PASS: movement reason is 'opening_balance'");
    }
    if (movement.quantity !== 75) {
      console.error(`FAIL: expected movement quantity to be 75, got ${movement.quantity}`);
    } else {
      console.log('PASS: movement quantity is correctly 75');
    }
  }

  // Cleanup
  await Inventory.deleteOne({ _id: item._id });
  await StockMovement.deleteMany({ inventoryItemId: item._id });
  console.log('Cleaned up test data');

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
