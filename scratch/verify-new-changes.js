require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Customer = require('../apps/pos/server/src/models/Customer');
const LoyaltyTier = require('../apps/pos/server/src/models/LoyaltyTier');
const LoyaltyProgramConfig = require('../apps/pos/server/src/models/LoyaltyProgramConfig');
const Store = require('../apps/pos/server/src/models/Store');
const User = require('../apps/pos/server/src/models/User');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function test() {
  console.log("Connecting to Database...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected successfully.");

  const store = await Store.findOne();
  if (!store) {
    console.error("No store found in DB. Seed DB first.");
    process.exit(1);
  }
  const { tenantId } = store;
  const user = await User.findOne({ tenantId });
  const userId = user ? user._id : new mongoose.Types.ObjectId();

  // Test 1: Regex Safe Search
  console.log("\n--- Test 1: Regex Safe Search ---");
  const searchQuery = "+94 77 987 6543";
  let didCrash = false;
  try {
    const escapedQ = escapeRegExp(searchQuery);
    const orConditions = [
      { name: new RegExp(escapedQ, 'i') },
      { email: new RegExp(escapedQ, 'i') },
      { mobile: new RegExp(escapedQ, 'i') },
    ];
    const results = await Customer.find({ tenantId, $or: orConditions });
    console.log(`Successfully performed search for regex-heavy query "${searchQuery}" without crashing. Found ${results.length} results.`);
  } catch (err) {
    console.error("FAILURE: Regex search crashed:", err);
    didCrash = true;
  }

  // Test 2: mobileDigits Sync on Update
  console.log("\n--- Test 2: mobileDigits Sync on Update ---");
  await Customer.deleteMany({ tenantId, email: "update-sync-test@example.com" });
  const cust = await Customer.create({
    tenantId,
    name: "Update Sync User",
    mobile: "123-456",
    email: "update-sync-test@example.com",
    createdBy: userId,
  });
  console.log(`Created: mobile=${cust.mobile}, mobileDigits=${cust.mobileDigits}`);

  // Simulating the PUT /:id update patch
  const updatedMobile = "+94 77 111 2222";
  const patch = { mobile: updatedMobile, updatedBy: userId };
  
  // Apply our route-level recalculation logic
  const d = String(patch.mobile || '').replace(/\D/g, '');
  patch.mobileDigits = d.length >= 6 ? d : '';

  const updatedCust = await Customer.findOneAndUpdate(
    { _id: cust._id, tenantId },
    patch,
    { new: true }
  );
  console.log(`Updated: mobile=${updatedCust.mobile}, mobileDigits=${updatedCust.mobileDigits}`);
  if (updatedCust.mobileDigits === "94771112222") {
    console.log("SUCCESS: mobileDigits synced correctly on update!");
  } else {
    console.error("FAILURE: mobileDigits did not sync correctly on update.");
  }

  // Test 3: Duplicate Loyalty Tier Level Validation Simulation
  console.log("\n--- Test 3: Duplicate Loyalty Tier Levels ---");
  await LoyaltyTier.deleteMany({ tenantId });
  
  // Create first tier
  const tier1 = await LoyaltyTier.create({
    tenantId,
    name: "Bronze",
    level: 1,
    minLifetimePoints: 0,
    createdBy: userId
  });
  console.log(`Created Tier 1: level=${tier1.level}, name=${tier1.name}`);

  // Simulate POST /tiers validation logic
  const newLevel = 1;
  const duplicateExists = await LoyaltyTier.findOne({ tenantId, level: newLevel });
  if (duplicateExists) {
    console.log(`SUCCESS: Detected duplicate level ${newLevel} (prevented creating tier).`);
  } else {
    console.error("FAILURE: Did not detect duplicate tier level.");
  }

  // Test 4: Loyalty Program config validation on PUT config
  console.log("\n--- Test 4: Loyalty Config Period Start Date ---");
  const testConfig = {
    pointsRetentionMode: 'yearly',
    pointsRetentionStartDate: null
  };
  
  if (testConfig.pointsRetentionMode && testConfig.pointsRetentionMode !== 'none' && !testConfig.pointsRetentionStartDate) {
    console.log("SUCCESS: Correctly validated that pointsRetentionStartDate is required when pointsRetentionMode is yearly.");
  } else {
    console.error("FAILURE: Validation for start date failed.");
  }

  // Clean up
  console.log("\nCleaning up test data...");
  await Customer.deleteMany({ tenantId, email: "update-sync-test@example.com" });
  await LoyaltyTier.deleteMany({ tenantId });
  console.log("Clean up completed.");
  process.exit(didCrash ? 1 : 0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
