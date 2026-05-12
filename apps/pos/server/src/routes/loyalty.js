const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const LoyaltyTier = require('../models/LoyaltyTier');
const LoyaltyReward = require('../models/LoyaltyReward');
const LoyaltyProgramConfig = require('../models/LoyaltyProgramConfig');
const { getEffectiveTier, tierFromPoints, lowestTier } = require('../lib/loyaltyTier');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { createNotification, notifyMerchantAdmins } = require('../lib/notificationHelpers');

const router = express.Router();

// ─── Program config (merchant admin) ───────────────────────────────────────────

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

// ─── Points retention (merchant admin) ───────────────────────────────────────

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

// ─── Tiers ───────────────────────────────────────────────────────────────────

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

// ─── Rewards ─────────────────────────────────────────────────────────────────

router.get('/rewards', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.storeId) {
      filter.$or = [{ storeId: req.storeId }, { storeId: null }];
    }
    if (req.query.pending === 'true') filter.approvalStatus = 'pending';
    const rows = await LoyaltyReward.find(filter).sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/rewards', protect, authorize('manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store selected' });

    const isManager = req.user.role === 'manager';
    const approvalStatus = isManager ? 'pending' : 'approved';
    const active = !isManager && req.body.active !== false;

    const body = { ...req.body };
    delete body.approvalStatus;
    delete body.approvedBy;
    delete body.approvedAt;
    delete body.tenantId;

    const doc = await LoyaltyReward.create({
      ...body,
      tenantId: req.tenantId,
      storeId,
      approvalStatus,
      active: active && approvalStatus === 'approved',
      createdBy: req.user.id,
      ...(approvalStatus === 'approved' ? { approvedBy: req.user.id, approvedAt: new Date() } : {}),
    });

    if (isManager) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'reward_pending',
        title: 'Loyalty reward pending approval',
        body: `"${doc.name}" (${doc.pointsCost} pts) was submitted for approval.`,
        meta: { resourceType: 'loyalty_reward', resourceId: String(doc._id) },
      });
    }

    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/rewards/:id', protect, authorize('manager', 'merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const existing = await LoyaltyReward.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    if (!existing) return res.status(404).json({ message: 'Reward not found' });

    const patch = { ...req.body, updatedBy: req.user.id };
    delete patch.approvedBy;
    delete patch.approvedAt;
    delete patch.tenantId;

    if (req.user.role === 'manager') {
      patch.approvalStatus = 'pending';
      patch.active = false;
      patch.approvedBy = null;
      patch.approvedAt = null;
      await notifyMerchantAdmins(req.tenantId, {
        type: 'reward_pending',
        title: 'Loyalty reward updated — needs approval',
        body: `"${patch.name || existing.name}" was edited and needs approval again.`,
        meta: { resourceType: 'loyalty_reward', resourceId: String(existing._id) },
      });
    }

    const doc = await LoyaltyReward.findByIdAndUpdate(existing._id, patch, { new: true, runValidators: true });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/rewards/:id/approve', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const doc = await LoyaltyReward.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
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

router.post('/rewards/:id/reject', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const reason = String(req.body.rejectionReason || '').trim() || 'No reason provided';
    const doc = await LoyaltyReward.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
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

module.exports = router;
