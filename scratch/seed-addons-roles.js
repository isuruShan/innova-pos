require('dotenv').config({ path: 'apps/admin-portal/server/.env' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB:", process.env.MONGO_URI);

  const { ensureDefaultPaidAddons } = require('../apps/admin-portal/server/src/lib/addonBilling');
  const { ensureDefaultUserLicensePricing } = require('../apps/admin-portal/server/src/lib/userLicensePricing');

  console.log("Seeding default paid add-ons...");
  await ensureDefaultPaidAddons();

  console.log("Seeding default user license pricing...");
  await ensureDefaultUserLicensePricing();

  console.log("Database seeded successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
