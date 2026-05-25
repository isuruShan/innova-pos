require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = require('./apps/pos/server/src/models/Order');
  const count = await Order.countDocuments();
  console.log("Total Orders:", count);
  
  const statuses = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  console.log("Order Statuses in Database:", statuses);
  
  const sampleOrder = await Order.findOne();
  console.log("Sample Order:", JSON.stringify(sampleOrder, null, 2));

  process.exit(0);
}
test().catch(console.error);
