require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Promotion = require('../apps/pos/server/src/models/Promotion');
const LoyaltyReward = require('../apps/pos/server/src/models/LoyaltyReward');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const pendingPromos = await Promotion.find({ approvalStatus: 'pending' });
  const pendingRewards = await LoyaltyReward.find({ approvalStatus: 'pending' });

  console.log(`Pending Promotions: ${pendingPromos.length}`);
  console.log(`Pending Loyalty Rewards: ${pendingRewards.length}`);

  if (pendingPromos.length > 0) {
    console.log("First pending promo:", JSON.stringify(pendingPromos[0], null, 2));
  }
  if (pendingRewards.length > 0) {
    console.log("First pending reward:", JSON.stringify(pendingRewards[0], null, 2));
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
