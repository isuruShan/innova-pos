require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = require('./apps/pos/server/src/models/Order');
  const Store = require('./apps/pos/server/src/models/Store');
  
  const stores = await Store.find();
  console.log("Registered Stores in DB:");
  stores.forEach(s => console.log(`- ${s.name} (${s._id})`));
  
  const orders = await Order.find({}, 'storeId status createdAt');
  console.log("Orders in DB:");
  orders.forEach((o, index) => {
    console.log(`${index + 1}. StoreID: ${o.storeId}, Status: ${o.status}, CreatedAt: ${o.createdAt}`);
  });
  
  process.exit(0);
}
check().catch(console.error);
