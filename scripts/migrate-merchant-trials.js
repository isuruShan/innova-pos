/**
 * Migration: Migrate existing merchants on a trial to 14 days
 * 
 * Sets trialEndsAt for all trial tenants to exactly 14 days from their createdAt date.
 * 
 * Usage:
 *   node ./scripts/migrate-merchant-trials.js
 */

require('dotenv').config({ path: `${__dirname}/../apps/pos/server/.env` });
const mongoose = require('mongoose');
const { getMongoConnectionString } = require('../packages/mongo-connection');

const MONGO_URI = getMongoConnectionString({
  fallback: 'mongodb://127.0.0.1:27017/pos_fastfood',
});

const tenantSchema = new mongoose.Schema(
  {
    subscriptionStatus: String,
    trialEndsAt: Date,
  },
  { timestamps: true }
);

async function run() {
  console.log(`Connecting to database...`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const Tenant = mongoose.model('Tenant', tenantSchema);
  const trialTenants = await Tenant.find({ subscriptionStatus: 'trial' });

  console.log(`Found ${trialTenants.length} tenants currently on trial.`);

  let updatedCount = 0;
  for (const tenant of trialTenants) {
    const approvalDate = tenant.createdAt;
    if (!approvalDate) {
      console.log(`Skipping tenant ${tenant._id} - no createdAt date found.`);
      continue;
    }

    const newTrialEnd = new Date(approvalDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const oldTrialEndStr = tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : 'N/A';

    console.log(`Updating tenant ${tenant._id}:`);
    console.log(`  Created/Approved At: ${approvalDate.toISOString()}`);
    console.log(`  Old trialEndsAt:     ${oldTrialEndStr}`);
    console.log(`  New trialEndsAt:     ${newTrialEnd.toISOString()}`);

    tenant.trialEndsAt = newTrialEnd;
    await tenant.save();
    updatedCount++;
  }

  console.log(`\nSuccessfully updated ${updatedCount} tenants.`);
  await mongoose.connection.close();
  console.log('Database connection closed.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
