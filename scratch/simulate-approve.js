require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Promotion = require('../apps/pos/server/src/models/Promotion');
const LoyaltyReward = require('../apps/pos/server/src/models/LoyaltyReward');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const promo = await Promotion.findOne({ approvalStatus: 'pending' });
  const reward = await LoyaltyReward.findOne({ approvalStatus: 'pending' });

  if (promo) {
    console.log("Found pending promo:", promo._id);
    const userId = promo.createdBy;
    const changeEntry = {
      changedBy: userId,
      changedAt: new Date(),
      action: 'approved',
      previousValues: { approvalStatus: promo.approvalStatus },
      newValues: { approvalStatus: 'approved', active: true },
      reason: 'Admin approval',
    };

    try {
      const updatedPromo = await Promotion.findByIdAndUpdate(
        promo._id,
        {
          approvalStatus: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          rejectionReason: '',
          active: true,
          updatedBy: userId,
          $push: { changeHistory: changeEntry },
        },
        { new: true, runValidators: true }
      );
      console.log("SUCCESS: Promotion approved in dry run:", updatedPromo._id);
    } catch (err) {
      console.error("ERROR approving promotion:", err);
    }
  }

  if (reward) {
    console.log("Found pending reward:", reward._id);
    const userId = reward.createdBy;
    const changeEntry = {
      changedBy: userId,
      changedAt: new Date(),
      action: 'approved',
      previousValues: { approvalStatus: reward.approvalStatus },
      newValues: { approvalStatus: 'approved', active: true },
      reason: 'Admin approval',
    };

    try {
      const updatedReward = await LoyaltyReward.findByIdAndUpdate(
        reward._id,
        {
          approvalStatus: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          rejectionReason: '',
          active: true,
          updatedBy: userId,
          $push: { changeHistory: changeEntry },
        },
        { new: true, runValidators: true }
      );
      console.log("SUCCESS: Reward approved in dry run:", updatedReward._id);
    } catch (err) {
      console.error("ERROR approving reward:", err);
    }
  }

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
