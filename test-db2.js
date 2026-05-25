require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = require('./apps/pos/server/src/models/Order');
  const count = await Order.countDocuments();
  console.log("Total Orders:", count);
  const recent = await Order.findOne().sort({ createdAt: -1 });
  console.log("Most recent order date:", recent?.createdAt);
  process.exit(0);
}
test().catch(console.error);
