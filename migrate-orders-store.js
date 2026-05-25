require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Store = require('./apps/pos/server/src/models/Store');
  const Order = require('./apps/pos/server/src/models/Order');
  const CashierSession = require('./apps/pos/server/src/models/CashierSession');
  
  const defaultStore = await Store.findOne();
  if (!defaultStore) {
    console.error("No stores found in database. Cannot migrate.");
    process.exit(1);
  }
  
  console.log(`Default store found: ${defaultStore.name} (${defaultStore._id})`);
  
  const ordersToUpdate = await Order.countDocuments({ storeId: null });
  console.log(`Orders with storeId = null: ${ordersToUpdate}`);
  
  if (ordersToUpdate > 0) {
    const res = await Order.updateMany({ storeId: null }, { storeId: defaultStore._id });
    console.log(`Migrated ${res.modifiedCount} orders to storeId: ${defaultStore._id}`);
  }
  
  const sessionsToUpdate = await CashierSession.countDocuments({ storeId: null });
  console.log(`Cashier sessions with storeId = null: ${sessionsToUpdate}`);
  if (sessionsToUpdate > 0) {
    const res = await CashierSession.updateMany({ storeId: null }, { storeId: defaultStore._id });
    console.log(`Migrated ${res.modifiedCount} cashier sessions to storeId: ${defaultStore._id}`);
  }
  
  process.exit(0);
}
run().catch(console.error);
