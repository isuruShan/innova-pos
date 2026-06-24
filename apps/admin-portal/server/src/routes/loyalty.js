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
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireLoyalty = requirePaidAddon('loyalty');

router.use(protect, tenantScope, requireLoyalty);

router.get('/config', authorize('cashier', 'manager', 'merchant_admin'), async (req, res) => {
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

router.put('/config', authorize('merchant_admin'), async (req, res) => {
  try {
    const {
      spendPerEarnBlock,
      pointsPerEarnBlock,
      isEnabled,
      pointsRetentionMode,
      pointsRetentionStartDate,
      retentionDowngradeToLevel1,
    } = req.body;

    if (pointsRetentionMode && pointsRetentionMode !== 'none' && !pointsRetentionStartDate) {
      return res.status(400).json({ message: 'Period start date is required when points retention is enabled' });
    }

    const patch = {
      tenantId: req.tenantId,
      updatedBy: req.user.id,
      ...(spendPerEarnBlock != null ? { spendPerEarnBlock: Number(spendPerEarnBlock) } : {}),
      ...(pointsPerEarnBlock != null ? { pointsPerEarnBlock: Number(pointsPerEarnBlock) } : {}),
      ...(typeof isEnabled === 'boolean' ? { isEnabled } : {}),
    };
    if (pointsRetentionMode !== undefined) {
      const mode = ['none', 'monthly', 'quarterly', 'yearly'].includes(pointsRetentionMode)
        ? pointsRetentionMode
        : 'none';
      patch.pointsRetentionMode = mode;
      if (mode === 'none') {
        patch.pointsRetentionStartDate = null;
      }
    }
    if (pointsRetentionStartDate !== undefined) {
      patch.pointsRetentionStartDate = pointsRetentionStartDate
        ? new Date(pointsRetentionStartDate)
        : null;
    }
    if (typeof retentionDowngradeToLevel1 === 'boolean') {
      patch.retentionDowngradeToLevel1 = retentionDowngradeToLevel1;
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

router.post('/retention/sync', authorize('merchant_admin'), async (req, res) => {
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

router.get('/retention/pending', authorize('merchant_admin'), async (req, res) => {
  try {
    const baseFilter = { tenantId: req.tenantId, retentionStatus: 'pending_review' };
    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
    const total = await Customer.countDocuments(baseFilter);
    const sort = parseSortQuery(req, {
      name: 'name',
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      points: 'lifetimePoints',
    }, { updatedAt: -1 });
    const rows = await Customer.find(baseFilter).sort(sort).skip(skip).limit(limit).lean();
    const tiers = await LoyaltyTier.find({ tenantId: req.tenantId }).sort({ minLifetimePoints: 1 }).lean();
    const low = lowestTier(tiers);
    const enriched = rows.map((c) => ({
      ...c,
      effectiveTier: getEffectiveTier(c, tiers),
      pointsTier: tierFromPoints(c.lifetimePoints || 0, tiers),
      lowestTier: low,
    }));
    res.json(paginated(enriched, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/retention/:customerId/resolve', authorize('merchant_admin'), async (req, res) => {
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

    const customer = await Customer.findOne({ _id: req.params.customerId, tenantId: req.tenantId, retentionStatus: 'pending_review' });
    if (!customer) return res.status(404).json({ message: 'Customer not pending review or not found' });

    const oldPts = customer.lifetimePoints ?? 0;
    if (pointsAction === 'reset') {
      customer.lifetimePoints = 0;
      customer.loyaltyTierOverrideLevel = null;
      customer.pointsHistory.push({
        type: 'adjustment',
        points: -oldPts,
        beforePoints: oldPts,
        afterPoints: 0,
        note: 'Loyalty points reset due to inactivity (retention policy)',
        changedBy: req.user.id,
        changedByName: req.user.name || req.user.email || 'System/Admin',
        createdAt: new Date()
      });
    } else if (tierAction === 'force_bottom' && low) {
      customer.loyaltyTierOverrideLevel = low.level;
    } else {
      customer.loyaltyTierOverrideLevel = null;
    }

    customer.retentionStatus = 'ok';
    customer.lastLoyaltyActivityAt = new Date();
    await customer.save();

    res.json(customer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/tiers', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const tiers = await LoyaltyTier.find({ tenantId: req.tenantId }).sort({ minLifetimePoints: 1, level: 1 });
    res.json(tiers);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/tiers', authorize('merchant_admin'), async (req, res) => {
  try {
    const { level } = req.body;
    if (level != null) {
      const exists = await LoyaltyTier.findOne({ tenantId: req.tenantId, level: Number(level) });
      if (exists) {
        return res.status(400).json({ message: `Loyalty level ${level} already exists.` });
      }
    }
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

router.put('/tiers/:id', authorize('merchant_admin'), async (req, res) => {
  try {
    const { level } = req.body;
    if (level != null) {
      const exists = await LoyaltyTier.findOne({
        tenantId: req.tenantId,
        level: Number(level),
        _id: { $ne: req.params.id },
      });
      if (exists) {
        return res.status(400).json({ message: `Loyalty level ${level} already exists.` });
      }
    }
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

router.delete('/tiers/:id', authorize('merchant_admin'), async (req, res) => {
  try {
    const t = await LoyaltyTier.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!t) return res.status(404).json({ message: 'Tier not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/rewards', authorize('merchant_admin', 'manager'), async (req, res) => {
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
    if (req.query.active === 'true') {
      filter.active = true;
    } else if (req.query.active === 'false') {
      filter.active = false;
    }
    if (req.query.rewardType) {
      filter.rewardType = req.query.rewardType;
    }
    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
    const total = await LoyaltyReward.countDocuments(filter);
    const sort = parseSortQuery(req, {
      name: 'name',
      createdAt: 'createdAt',
      pointsCost: 'pointsCost',
      status: 'active',
    }, { createdAt: -1 });
    const rows = await LoyaltyReward.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('changeHistory.changedBy', 'name email')
      .lean();
    res.json(paginated(rows, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/rewards', authorize('merchant_admin', 'manager'), resolveSelectedStore, async (req, res) => {
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

    const isManager = req.user.role === 'manager';
    const doc = await LoyaltyReward.create({
      ...body,
      tenantId: req.tenantId,
      storeId,
      approvalStatus: isManager ? 'pending' : 'approved',
      active: isManager ? false : (body.active !== false),
      approvedBy: isManager ? null : req.user.id,
      approvedAt: isManager ? null : new Date(),
      createdBy: req.user.id,
    });

    if (isManager) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'reward_approval_requested',
        title: 'Reward approval requested',
        body: `Manager "${req.user.name || 'Manager'}" created a loyalty reward "${doc.name}" that requires your approval.`,
        meta: { resourceType: 'loyalty_reward', resourceId: String(doc._id) },
      });
    }

    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/rewards/:id', authorize('merchant_admin', 'manager'), async (req, res) => {
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

    const isManager = req.user.role === 'manager';
    if (isManager) {
      patch.approvalStatus = 'pending';
      patch.active = false;
    }

    const doc = await LoyaltyReward.findByIdAndUpdate(existing._id, patch, { new: true, runValidators: true });

    if (isManager) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'reward_approval_requested',
        title: 'Reward approval requested',
        body: `Manager "${req.user.name || 'Manager'}" edited loyalty reward "${doc.name}", requiring approval.`,
        meta: { resourceType: 'loyalty_reward', resourceId: String(doc._id) },
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/rewards/:id/approve', authorize('merchant_admin'), async (req, res) => {
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

router.post('/rewards/:id/reject', authorize('merchant_admin'), async (req, res) => {
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

router.delete('/rewards/:id', authorize('merchant_admin', 'manager'), async (req, res) => {
  try {
    const doc = await LoyaltyReward.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!doc) return res.status(404).json({ message: 'Reward not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
