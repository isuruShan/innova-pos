'use strict';

const LoyaltyProgramConfig = require('../models/LoyaltyProgramConfig');
const Customer = require('../models/Customer');
const { getRetentionPeriodEnd } = require('./loyaltyRetentionPeriod');
const { lowestTier } = require('./loyaltyTier');

async function processLoyaltyRetentionPeriods(logger) {
  const configs = await LoyaltyProgramConfig.find({
    pointsRetentionMode: { $in: ['monthly', 'quarterly', 'yearly'] },
    pointsRetentionStartDate: { $ne: null },
    isEnabled: true,
  });

  const now = new Date();
  for (const cfg of configs) {
    const end = getRetentionPeriodEnd(cfg.pointsRetentionStartDate, cfg.pointsRetentionMode);
    if (!end || now < end) continue;

    const lastEnd = cfg.pointsRetentionLastProcessedEnd
      ? new Date(cfg.pointsRetentionLastProcessedEnd).getTime()
      : 0;
    if (lastEnd >= end.getTime()) continue;

    const patch = { loyaltyPoints: 0, retentionStatus: 'ok' };
    if (cfg.retentionDowngradeToLevel1) {
      const tier = await lowestTier(cfg.tenantId);
      if (tier) patch.loyaltyTierId = tier._id;
    }

    const result = await Customer.updateMany(
      { tenantId: cfg.tenantId, loyaltyPoints: { $gt: 0 } },
      { $set: patch },
    );

    cfg.pointsRetentionLastProcessedEnd = end;
    cfg.pointsRetentionStartDate = end;
    await cfg.save();

    if (logger && result.modifiedCount > 0) {
      logger.info('Loyalty retention period processed', {
        tenantId: String(cfg.tenantId),
        customersUpdated: result.modifiedCount,
        periodEnd: end.toISOString(),
      });
    }
  }
}

module.exports = { processLoyaltyRetentionPeriods };
