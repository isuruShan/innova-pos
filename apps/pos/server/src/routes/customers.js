const express = require('express');
const Customer = require('../models/Customer');
const LoyaltyTier = require('../models/LoyaltyTier');
const { getEffectiveTier, tierFromPoints } = require('../lib/loyaltyTier');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { emitAudit } = require('@innovapos/shared-middleware');

const router = express.Router();

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function normalizeEmail(s) {
  return String(s || '').trim().toLowerCase();
}

/** Match existing customer by normalized email or mobile digits (cross-format). */
async function findExistingCustomerByContact(tenantId, emailNorm, mobileRaw) {
  if (emailNorm) {
    const byEmail = await Customer.findOne({ tenantId, email: emailNorm });
    if (byEmail) return byEmail;
  }
  if (mobileRaw) {
    const byMobileExact = await Customer.findOne({ tenantId, mobile: mobileRaw });
    if (byMobileExact) return byMobileExact;
  }
  const md = digitsOnly(mobileRaw);
  const or = [];
  if (md.length >= 8) or.push({ mobileDigits: md });
  if (or.length) {
    const c = await Customer.findOne({ tenantId, $or: or });
    if (c) return c;
  }
  if (md.length >= 8) {
    const loose = await Customer.find({
      tenantId,
      mobile: { $nin: ['', null] },
      $or: [{ mobileDigits: { $exists: false } }, { mobileDigits: '' }, { mobileDigits: null }],
    })
      .limit(400)
      .lean();
    const hit = loose.find((x) => digitsOnly(x.mobile) === md);
    if (hit) return Customer.findById(hit._id);
  }
  return null;
}

router.get('/', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
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

router.post('/:id/points', protect, authorize('manager', 'merchant_admin'), tenantScope, async (req, res) => {
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

    const actorLabel = req.user.name || req.user.email || 'Staff';
    const customerLabel = prev.name?.trim() || 'Customer';
    const noteStr = note != null && String(note).trim() ? String(note).trim() : '';

    const notifyOpts =
      req.user.role === 'merchant_admin' ? { excludeUserId: req.user.id } : {};

    await notifyMerchantAdmins(
      req.tenantId,
      {
        type: 'loyalty_points_adjusted',
        title: 'Loyalty points updated',
        body: `${actorLabel} set ${customerLabel} from ${oldPts} to ${nextPts} points.${noteStr ? ` Note: ${noteStr}` : ''}`,
        meta: { resourceType: 'customer', resourceId: String(prev._id) },
      },
      notifyOpts,
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

router.get('/:id', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
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

router.post('/', protect, authorize('cashier', 'manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const mobileRaw = req.body.mobile != null ? String(req.body.mobile).trim() : '';
    const emailNorm = normalizeEmail(req.body.email);

    if (!name && !mobileRaw && !emailNorm) {
      return res.status(400).json({ message: 'Provide at least a name, mobile, or email' });
    }

    const existing = await findExistingCustomerByContact(req.tenantId, emailNorm, mobileRaw);
    if (existing) {
      const obj = existing.toObject();
      return res.status(200).json({ ...obj, reused: true });
    }

    const raw = { ...req.body };
    delete raw.lifetimePoints;
    delete raw.retentionStatus;
    delete raw.loyaltyTierOverrideLevel;
    delete raw.lastLoyaltyActivityAt;
    delete raw.tenantId;
    const body = {
      ...raw,
      name,
      mobile: mobileRaw,
      email: emailNorm,
      tenantId: req.tenantId,
      storeId: null,
      createdBy: req.user.id,
      lastLoyaltyActivityAt: new Date(),
    };
    const c = await Customer.create(body);
    res.status(201).json({ ...c.toObject(), reused: false });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const patch = { ...req.body, updatedBy: req.user.id };
    delete patch.lifetimePoints;
    delete patch.tenantId;
    if (req.user.role === 'manager') {
      delete patch.retentionStatus;
      delete patch.loyaltyTierOverrideLevel;
      delete patch.lastLoyaltyActivityAt;
    }
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

router.delete('/:id', protect, authorize('manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const c = await Customer.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
