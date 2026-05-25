require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = require('./apps/pos/server/src/models/Order');
  const User = require('./apps/pos/server/src/models/User');
  const Store = require('./apps/pos/server/src/models/Store');
  
  const orderTenants = await Order.distinct('tenantId');
  console.log("Distinct Tenant IDs in Orders:", orderTenants);
  
  const userTenants = await User.distinct('tenantId');
  console.log("Distinct Tenant IDs in Users:", userTenants);
  
  const storeTenants = await Store.distinct('tenantId');
  console.log("Distinct Tenant IDs in Stores:", storeTenants);
  
  const users = await User.find({}, 'name email role tenantId storeIds');
  console.log("Users:");
  users.forEach(u => console.log(`- ${u.name} (${u.email}): Role: ${u.role}, Tenant: ${u.tenantId}, Stores: ${u.storeIds}`));
  
  process.exit(0);
}
check().catch(console.error);
