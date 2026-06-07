const express = require('express');
const Promotion = require('../models/Promotion');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { createNotification, notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    const isAdmin = req.user.role === 'merchant_admin' || req.user.role === 'superadmin';
    if (req.query.pending === 'true' && isAdmin) {
      // Merchant admins see pending promotions for the whole tenant
    } else if (req.storeId) {
      filter.$or = [{ storeId: req.storeId }, { storeId: null }];
    } else {
      Object.assign(filter, buildStoreFilter(req));
    }
    if (req.query.active === 'true') {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setUTCHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setUTCHours(23, 59, 59, 999);

      filter.active = true;
      filter.startDate = { $lte: endOfToday };
      filter.endDate = { $gte: startOfToday };
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
    const sort = parseSortQuery(req, {
      name: 'name',
      createdAt: 'createdAt',
      endDate: 'endDate',
      status: 'active',
    }, { createdAt: -1 });
    const promotions = await Promotion.find(filter)
      .sort(sort)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('changeHistory.changedBy', 'name email');
    res.json(promotions);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'merchant_admin' || req.user.role === 'superadmin';
    const scope = isAdmin
      ? {}
      : (req.storeId != null
          ? { $or: [{ storeId: req.storeId }, { storeId: null }] }
          : buildStoreFilter(req));
    const p = await Promotion.findOne({ _id: req.params.id, tenantId: req.tenantId, ...scope });
    if (!p) return res.status(404).json({ message: 'Promotion not found' });
    res.json(p);
  } catch (err) {
    sendRouteError(res, err, { req });
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

    const changeHistory = [{
      changedBy: req.user.id,
      changedAt: new Date(),
      action: 'created',
      previousValues: {},
      newValues: body,
      reason: 'Initial creation',
    }];

    const promo = await Promotion.create({
      ...body,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
      changeHistory,
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
    const isAdmin = req.user.role === 'merchant_admin' || req.user.role === 'superadmin';
    const existing = await Promotion.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...(isAdmin ? {} : buildStoreFilter(req)),
    });
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    const body = { ...req.body };
    delete body.approvalStatus;
    delete body.approvedBy;
    delete body.approvedAt;
    delete body.tenantId;

    // Track changes
    const previousValues = existing.toObject();
    delete previousValues.changeHistory;
    delete previousValues._id;
    delete previousValues.__v;
    delete previousValues.createdAt;
    delete previousValues.updatedAt;

    const changeEntry = {
      changedBy: req.user.id,
      changedAt: new Date(),
      action: 'updated',
      previousValues,
      newValues: body,
      reason: 'Manager update',
    };

    let patch = { 
      ...body, 
      updatedBy: req.user.id,
      $push: { changeHistory: changeEntry },
    };

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
    const existing = await Promotion.findOne(
      { _id: req.params.id, tenantId: req.tenantId }
    );
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    const changeEntry = {
      changedBy: req.user.id,
      changedAt: new Date(),
      action: 'approved',
      previousValues: { approvalStatus: existing.approvalStatus },
      newValues: { approvalStatus: 'approved', active: req.body.active !== false },
      reason: 'Admin approval',
    };

    const promo = await Promotion.findByIdAndUpdate(
      existing._id,
      {
        approvalStatus: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectionReason: '',
        active: req.body.active !== false,
        updatedBy: req.user.id,
        $push: { changeHistory: changeEntry },
      },
      { new: true },
    );

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
    const existing = await Promotion.findOne(
      { _id: req.params.id, tenantId: req.tenantId }
    );
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    const changeEntry = {
      changedBy: req.user.id,
      changedAt: new Date(),
      action: 'rejected',
      previousValues: { approvalStatus: existing.approvalStatus },
      newValues: { approvalStatus: 'rejected', active: false },
      reason,
    };

    const promo = await Promotion.findByIdAndUpdate(
      existing._id,
      {
        approvalStatus: 'rejected',
        rejectionReason: reason,
        active: false,
        updatedBy: req.user.id,
        $push: { changeHistory: changeEntry },
      },
      { new: true },
    );

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
    const isAdmin = req.user.role === 'merchant_admin' || req.user.role === 'superadmin';
    const promo = await Promotion.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...(isAdmin ? {} : buildStoreFilter(req)),
    });
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
