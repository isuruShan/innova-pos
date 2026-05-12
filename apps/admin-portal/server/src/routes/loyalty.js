const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const LoyaltyTier = require('../models/LoyaltyTier');
const LoyaltyReward = require('../models/LoyaltyReward');
const LoyaltyProgramConfig = require('../models/LoyaltyProgramConfig');
const { getEffectiveTier, tierFromPoints, lowestTier } = require('../lib/loyaltyTier');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { createNotification, notifyMerchantAdmins } = require('../lib/notificationHelpers');

const router = express.Router();

router.get('/config', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    let cfg = await LoyaltyProgramConfig.findOne({ tenantId: req.tenantId }).lean();
    if (!cfg) {
      cfg = {
        tenantId: req.tenantId,
        spendPerEarnBlock: 100,
        pointsPerEarnBlock: 1,
        isEnabled: true,
        pointsRetentionDays: null,
      };
    }
    res.json(cfg);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/config', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { spendPerEarnBlock, pointsPerEarnBlock, isEnabled, pointsRetentionDays } = req.body;
    const patch = {
      tenantId: req.tenantId,
      updatedBy: req.user.id,
      ...(spendPerEarnBlock != null ? { spendPerEarnBlock: Number(spendPerEarnBlock) } : {}),
      ...(pointsPerEarnBlock != null ? { pointsPerEarnBlock: Number(pointsPerEarnBlock) } : {}),
      ...(typeof isEnabled === 'boolean' ? { isEnabled } : {}),
    };
    if (pointsRetentionDays !== undefined) {
      const raw = pointsRetentionDays === null || pointsRetentionDays === ''
        ? null
        : Number(pointsRetentionDays);
      patch.pointsRetentionDays = raw === null || Number.isNaN(raw) ? null : Math.max(0, raw);
    }
    const cfg = await LoyaltyProgramConfig.findOneAndUpdate(
      { tenantId: req.tenantId },
      patch,
      { new: true, upsert: true, runValidators: true },
    );
    res.json(cfg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/retention/sync', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const cfg = await LoyaltyProgramConfig.findOne({ tenantId: req.tenantId }).lean();
    const days = cfg?.pointsRetentionDays;
    if (!days || days <= 0) return res.json({ flagged: 0 });

    const cutoff = new Date(Date.now() - days * 86400000);
    const result = await Customer.updateMany(
      {
        tenantId: req.tenantId,
        retentionStatus: 'ok',
        $or: [
          { lastLoyaltyActivityAt: { $lt: cutoff } },
          { lastLoyaltyActivityAt: null, createdAt: { $lt: cutoff } },
        ],
      },
      { retentionStatus: 'pending_review' },
    );

    if (result.modifiedCount > 0) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'loyalty_retention_review',
        title: 'Loyalty retention reviews needed',
        body: `${result.modifiedCount} customer(s) passed the inactivity period and need your decision on points and tier.`,
        meta: {},
      });
    }

    res.json({ flagged: result.modifiedCount });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/retention/pending', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const rows = await Customer.find({ tenantId: req.tenantId, retentionStatus: 'pending_review' })
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();
    const tiers = await LoyaltyTier.find({ tenantId: req.tenantId }).sort({ minLifetimePoints: 1 }).lean();
    const low = lowestTier(tiers);
    const enriched = rows.map((c) => ({
      ...c,
      effectiveTier: getEffectiveTier(c, tiers),
      pointsTier: tierFromPoints(c.lifetimePoints || 0, tiers),
      lowestTier: low,
    }));
    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/retention/:customerId/resolve', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { pointsAction, tierAction } = req.body || {};
    if (!['reset', 'keep'].includes(pointsAction) || !['computed', 'force_bottom'].includes(tierAction)) {
      return res.status(400).json({ message: 'pointsAction (reset|keep) and tierAction (computed|force_bottom) are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.customerId)) {
      return res.status(400).json({ message: 'Invalid customer id' });
    }

    const tiers = await LoyaltyTier.find({ tenantId: req.tenantId }).sort({ level: 1 }).lean();
    const low = lowestTier(tiers);

    const set = {
      retentionStatus: 'ok',
      lastLoyaltyActivityAt: new Date(),
    };

    if (pointsAction === 'reset') {
      set.lifetimePoints = 0;
      set.loyaltyTierOverrideLevel = null;
    } else if (tierAction === 'force_bottom' && low) {
      set.loyaltyTierOverrideLevel = low.level;
    } else {
      set.loyaltyTierOverrideLevel = null;
    }

    const doc = await Customer.findOneAndUpdate(
      { _id: req.params.customerId, tenantId: req.tenantId, retentionStatus: 'pending_review' },
      { $set: set },
      { new: true, runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: 'Customer not pending review or not found' });

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/tiers', protect, authorize('manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const tiers = await LoyaltyTier.find({ tenantId: req.tenantId }).sort({ minLifetimePoints: 1, level: 1 });
    res.json(tiers);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/tiers', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const t = await LoyaltyTier.create({
      ...req.body,
      tenantId: req.tenantId,
      createdBy: req.user.id,
    });
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/tiers/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const t = await LoyaltyTier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true },
    );
    if (!t) return res.status(404).json({ message: 'Tier not found' });
    res.json(t);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/tiers/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const t = await LoyaltyTier.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!t) return res.status(404).json({ message: 'Tier not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/rewards', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.pending === 'true') {
      filter.approvalStatus = 'pending';
    } else if (req.query.approvalStatus) {
      filter.approvalStatus = req.query.approvalStatus;
    }
    if (req.query.storeId === 'tenant' || req.query.storeId === 'null') {
      filter.storeId = null;
    } else if (req.query.storeId && mongoose.Types.ObjectId.isValid(req.query.storeId)) {
      filter.storeId = req.query.storeId;
    }
    if (req.query.search && String(req.query.search).trim()) {
      const q = new RegExp(String(req.query.search).trim(), 'i');
      filter.$or = [{ name: q }, { description: q }];
    }
    const rows = await LoyaltyReward.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(rows);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/rewards', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const body = { ...req.body };
    const scope = body.scope === 'tenant' ? 'tenant' : 'store';
    delete body.scope;
    delete body.approvalStatus;
    delete body.approvedBy;
    delete body.approvedAt;
    delete body.tenantId;

    let storeId = null;
    if (scope === 'tenant') {
      storeId = null;
      delete body.storeId;
    } else if (body.storeId && mongoose.Types.ObjectId.isValid(String(body.storeId))) {
      storeId = body.storeId;
      delete body.storeId;
    } else {
      storeId = await resolveWriteStoreId(req);
      if (!storeId) return res.status(400).json({ message: 'Select a store or choose tenant-wide reward' });
    }

    const doc = await LoyaltyReward.create({
      ...body,
      tenantId: req.tenantId,
      storeId,
      approvalStatus: 'approved',
      active: body.active !== false,
      approvedBy: req.user.id,
      approvedAt: new Date(),
      createdBy: req.user.id,
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/rewards/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const existing = await LoyaltyReward.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!existing) return res.status(404).json({ message: 'Reward not found' });

    const patch = { ...req.body, updatedBy: req.user.id };
    delete patch.approvedBy;
    delete patch.approvedAt;
    delete patch.tenantId;
    if (patch.scope === 'tenant') {
      patch.storeId = null;
    }
    delete patch.scope;

    const doc = await LoyaltyReward.findByIdAndUpdate(existing._id, patch, { new: true, runValidators: true });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/rewards/:id/approve', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const doc = await LoyaltyReward.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        approvalStatus: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectionReason: '',
        active: req.body.active !== false,
        updatedBy: req.user.id,
      },
      { new: true },
    );
    if (!doc) return res.status(404).json({ message: 'Reward not found' });

    if (doc.createdBy) {
      await createNotification(req.tenantId, doc.createdBy, {
        type: 'reward_approved',
        title: 'Reward approved',
        body: `Your loyalty reward "${doc.name}" was approved.`,
        meta: { resourceType: 'loyalty_reward', resourceId: String(doc._id) },
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/rewards/:id/reject', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const reason = String(req.body.rejectionReason || '').trim() || 'No reason provided';
    const doc = await LoyaltyReward.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        approvalStatus: 'rejected',
        rejectionReason: reason,
        active: false,
        updatedBy: req.user.id,
      },
      { new: true },
    );
    if (!doc) return res.status(404).json({ message: 'Reward not found' });

    if (doc.createdBy) {
      await createNotification(req.tenantId, doc.createdBy, {
        type: 'reward_rejected',
        title: 'Reward not approved',
        body: `"${doc.name}" was rejected: ${reason}`,
        meta: { resourceType: 'loyalty_reward', resourceId: String(doc._id) },
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/rewards/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const doc = await LoyaltyReward.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!doc) return res.status(404).json({ message: 'Reward not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
