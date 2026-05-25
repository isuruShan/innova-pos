require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Order = require('apps/pos/server/src/models/Order');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const count = await Order.countDocuments();
  console.log("Total Orders:", count);
  const recent = await Order.findOne().sort({ createdAt: -1 });
  console.log("Most recent order:", recent?.createdAt);
  process.exit(0);
}
check().catch(console.error);
