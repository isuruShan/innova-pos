require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Promotion = require('./apps/admin-portal/server/src/models/Promotion');
  const count = await Promotion.countDocuments();
  console.log("Total Promotions:", count);
  
  const promos = await Promotion.find({});
  promos.forEach((p, idx) => {
    console.log(`${idx + 1}. Name: ${p.name}, Active: ${p.active}, Status: ${p.approvalStatus}, Tenant: ${p.tenantId}, Store: ${p.storeId}`);
  });
  
  process.exit(0);
}
check().catch(console.error);
