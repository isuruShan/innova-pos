require('dotenv').config({ path: 'apps/admin-portal/server/.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB:", process.env.MONGO_URI);

  const Tenant = require('../apps/admin-portal/server/src/models/Tenant');
  const PaidAddonDefinition = require('../apps/admin-portal/server/src/models/PaidAddonDefinition');

  const addons = await PaidAddonDefinition.find({});
  console.log("Paid Addon Definitions:");
  addons.forEach(a => {
    console.log(`- Code: ${a.code}, Name: ${a.name}, IsActive: ${a.isActive}`);
  });

  const tenants = await Tenant.find({});
  console.log("\nTenants and their Modifier Groups Status:");
  tenants.forEach(t => {
    console.log(`- Tenant: ${t.name || t.companyName || 'N/A'} (${t._id})`);
    console.log(`  Modifier Groups Status:`, JSON.stringify(t.paidAddons?.modifierGroups || t.paidAddons?.modifier_groups || {}, null, 2));
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
