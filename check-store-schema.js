require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Store = require('./apps/pos/server/src/models/Store');
  const store = await Store.findOne();
  console.log("Sample Store:", JSON.stringify(store, null, 2));
  process.exit(0);
}
check().catch(console.error);
