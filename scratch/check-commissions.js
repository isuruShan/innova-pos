require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Order = require('../apps/pos/server/src/models/Order');
const FoodmarketPartner = require('../apps/pos/server/src/models/FoodmarketPartner');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const partnerCount = await FoodmarketPartner.countDocuments();
  console.log("Total Foodmarket Partners in DB:", partnerCount);

  const partners = await FoodmarketPartner.find().lean();
  partners.forEach(p => {
    console.log(`Partner: ${p.name} | ID: ${p._id} | isActive: ${p.isActive} | commissionType: ${p.commissionType} | flat: ${p.commissionFlat} | %: ${p.commissionPercentage}`);
  });

  const allOrdersCount = await Order.countDocuments();
  console.log("Total Orders in DB:", allOrdersCount);

  const ordersWithPartner = await Order.countDocuments({ foodmarketPartnerId: { $ne: null } });
  console.log("Orders with foodmarketPartnerId set (not null):", ordersWithPartner);

  const completedOrdersWithPartner = await Order.countDocuments({ 
    foodmarketPartnerId: { $ne: null },
    status: 'completed'
  });
  console.log("Completed orders with foodmarketPartnerId set:", completedOrdersWithPartner);

  const ordersWithCommission = await Order.countDocuments({ commissionAmount: { $gt: 0 } });
  console.log("Orders with commissionAmount > 0:", ordersWithCommission);

  // Print a few orders if any exist
  if (ordersWithPartner > 0) {
    const list = await Order.find({ foodmarketPartnerId: { $ne: null } }).limit(5).lean();
    list.forEach(o => {
      console.log(`Order #${o.orderNumber} | Partner ID: ${o.foodmarketPartnerId} | total: ${o.totalAmount} | commission: ${o.commissionAmount} | status: ${o.status}`);
    });
  }

  process.exit(0);
}

run().catch(console.error);
