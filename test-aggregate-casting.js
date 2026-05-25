require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = require('./apps/pos/server/src/models/Order');
  const sample = await Order.findOne({ status: 'completed' });
  if (!sample) {
    console.log("No completed orders to test.");
    process.exit(0);
  }
  
  console.log("Sample Order IDs:");
  console.log("tenantId:", typeof sample.tenantId, sample.tenantId);
  console.log("storeId:", typeof sample.storeId, sample.storeId);
  
  const tenantStr = sample.tenantId.toString();
  const storeStr = sample.storeId.toString();
  
  // Test 1: Aggregate with String IDs
  const resStrings = await Order.aggregate([
    {
      $match: {
        tenantId: tenantStr,
        storeId: storeStr,
        status: 'completed'
      }
    }
  ]);
  console.log("Result with String IDs:", resStrings.length);
  
  // Test 2: Aggregate with ObjectId instances
  const resObjects = await Order.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantStr),
        storeId: new mongoose.Types.ObjectId(storeStr),
        status: 'completed'
      }
    }
  ]);
  console.log("Result with ObjectId instances:", resObjects.length);
  
  process.exit(0);
}
test().catch(console.error);
