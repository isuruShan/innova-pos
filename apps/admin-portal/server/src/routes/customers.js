const express = require('express');
const Customer = require('../models/Customer');
const LoyaltyTier = require('../models/LoyaltyTier');
const { getEffectiveTier, tierFromPoints } = require('../lib/loyaltyTier');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { emitAudit } = require('@innovapos/shared-middleware');

const router = express.Router();

router.get('/', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    const { search } = req.query;
    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { mobile: new RegExp(q, 'i') },
      ];
    }
    const rows = await Customer.find(filter).sort({ updatedAt: -1 }).limit(500);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/points', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { lifetimePoints, note } = req.body || {};
    const nextPts = Math.max(0, Number(lifetimePoints));
    if (lifetimePoints === undefined || lifetimePoints === null || Number.isNaN(nextPts)) {
      return res.status(400).json({ message: 'lifetimePoints (number ≥ 0) is required' });
    }

    const prev = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!prev) return res.status(404).json({ message: 'Customer not found' });
    const oldPts = prev.lifetimePoints ?? 0;

    const doc = await Customer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        lifetimePoints: nextPts,
        updatedBy: req.user.id,
        lastLoyaltyActivityAt: new Date(),
        retentionStatus: 'ok',
      },
      { new: true, runValidators: true },
    );

    const actorLabel = req.user.name || req.user.email || 'Admin';
    const customerLabel = prev.name?.trim() || 'Customer';
    const noteStr = note != null && String(note).trim() ? String(note).trim() : '';

    await notifyMerchantAdmins(
      req.tenantId,
      {
        type: 'loyalty_points_adjusted',
        title: 'Loyalty points updated',
        body: `${actorLabel} set ${customerLabel} from ${oldPts} to ${nextPts} points.${noteStr ? ` Note: ${noteStr}` : ''}`,
        meta: { resourceType: 'customer', resourceId: String(prev._id) },
      },
      { excludeUserId: req.user.id },
    );

    emitAudit({
      req,
      action: 'LOYALTY_POINTS_ADJUSTED',
      resource: 'Customer',
      resourceId: doc._id,
      changes: { oldPoints: oldPts, newPoints: nextPts, note: noteStr || null },
    });

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const c = await Customer.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    if (req.query.loyalty === '1') {
      const tiers = await LoyaltyTier.find({ tenantId: req.tenantId }).sort({ minLifetimePoints: 1 }).lean();
      const obj = c.toObject();
      return res.json({
        ...obj,
        loyalty: {
          effectiveTier: getEffectiveTier(obj, tiers),
          pointsTier: tierFromPoints(obj.lifetimePoints || 0, tiers),
        },
      });
    }
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const raw = { ...req.body };
    delete raw.lifetimePoints;
    delete raw.retentionStatus;
    delete raw.loyaltyTierOverrideLevel;
    delete raw.lastLoyaltyActivityAt;
    const body = {
      ...raw,
      tenantId: req.tenantId,
      storeId: null,
      createdBy: req.user.id,
      lastLoyaltyActivityAt: new Date(),
    };
    const c = await Customer.create(body);
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const patch = { ...req.body, updatedBy: req.user.id };
    delete patch.lifetimePoints;
    delete patch.tenantId;
    const c = await Customer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      patch,
      { new: true, runValidators: true },
    );
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const c = await Customer.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
