require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const MenuItem = require('./apps/pos/server/src/models/MenuItem');
  
  const tenants = await MenuItem.distinct('tenantId');
  console.log("Distinct Tenant IDs in MenuItems:", tenants);
  
  const count = await MenuItem.countDocuments();
  console.log("Total Menu Items:", count);
  
  process.exit(0);
}
check().catch(console.error);
