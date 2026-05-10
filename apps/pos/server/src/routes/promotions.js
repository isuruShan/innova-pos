const express = require('express');
const Promotion = require('../models/Promotion');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { createNotification, notifyMerchantAdmins } = require('../lib/notificationHelpers');

const router = express.Router();

router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.storeId) {
      filter.$or = [{ storeId: req.storeId }, { storeId: null }];
    } else {
      Object.assign(filter, buildStoreFilter(req));
    }
    if (req.query.active === 'true') {
      const now = new Date();
      filter.active = true;
      filter.startDate = { $lte: now };
      filter.endDate = { $gte: now };
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
        },
      ];
    }
    if (req.query.pending === 'true') {
      filter.approvalStatus = 'pending';
    }
    const promotions = await Promotion.find(filter).sort({ createdAt: -1 });
    res.json(promotions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const scope =
      req.storeId != null
        ? { $or: [{ storeId: req.storeId }, { storeId: null }] }
        : buildStoreFilter(req);
    const p = await Promotion.findOne({ _id: req.params.id, tenantId: req.tenantId, ...scope });
    if (!p) return res.status(404).json({ message: 'Promotion not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for promotion creation' });

    const isManager = req.user.role === 'manager';
    const body = { ...req.body };
    delete body.approvalStatus;
    delete body.approvedBy;
    delete body.approvedAt;

    const promo = await Promotion.create({
      ...body,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
      ...(isManager
        ? { approvalStatus: 'pending', active: false }
        : { approvalStatus: 'approved', approvedBy: req.user.id, approvedAt: new Date() }),
    });

    if (isManager) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'promotion_pending',
        title: 'Promotion pending approval',
        body: `"${promo.name}" was submitted for approval.`,
        meta: { resourceType: 'promotion', resourceId: String(promo._id) },
      });
    }

    res.status(201).json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const existing = await Promotion.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    const body = { ...req.body };
    delete body.approvalStatus;
    delete body.approvedBy;
    delete body.approvedAt;
    delete body.tenantId;

    let patch = { ...body, updatedBy: req.user.id };

    if (req.user.role === 'manager') {
      patch.approvalStatus = 'pending';
      patch.active = false;
      patch.approvedBy = null;
      patch.approvedAt = null;
      await notifyMerchantAdmins(req.tenantId, {
        type: 'promotion_pending',
        title: 'Promotion updated — needs approval',
        body: `"${patch.name || existing.name}" was edited and needs approval again.`,
        meta: { resourceType: 'promotion', resourceId: String(existing._id) },
      });
    }

    const promo = await Promotion.findByIdAndUpdate(existing._id, patch, { new: true, runValidators: true });
    res.json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/approve', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
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
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });

    if (promo.createdBy) {
      await createNotification(req.tenantId, promo.createdBy, {
        type: 'promotion_approved',
        title: 'Promotion approved',
        body: `Your promotion "${promo.name}" was approved.`,
        meta: { resourceType: 'promotion', resourceId: String(promo._id) },
      });
    }

    res.json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/reject', protect, authorize('merchant_admin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const reason = String(req.body.rejectionReason || '').trim() || 'No reason provided';
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      {
        approvalStatus: 'rejected',
        rejectionReason: reason,
        active: false,
        updatedBy: req.user.id,
      },
      { new: true },
    );
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });

    if (promo.createdBy) {
      await createNotification(req.tenantId, promo.createdBy, {
        type: 'promotion_rejected',
        title: 'Promotion not approved',
        body: `"${promo.name}" was rejected: ${reason}`,
        meta: { resourceType: 'promotion', resourceId: String(promo._id) },
      });
    }

    res.json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const promo = await Promotion.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) });
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
