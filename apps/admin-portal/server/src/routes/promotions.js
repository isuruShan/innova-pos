const express = require('express');
const mongoose = require('mongoose');
const Promotion = require('../models/Promotion');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { createNotification, notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

router.get('/', protect, authorize('merchant_admin', 'manager'), tenantScope, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    const now = new Date();
    await Promotion.updateMany(
      { tenantId: req.tenantId, endDate: { $lt: now }, active: true },
      { active: false },
    );
    const showAll = req.query.showAll === 'true' || req.query.status === 'all';
    const isPendingOrRejected = req.query.pending === 'true' ||
                               req.query.approvalStatus === 'pending' ||
                               req.query.approvalStatus === 'rejected';

    if (req.query.active === 'true' && !isPendingOrRejected) {
      filter.active = true;
    } else if (req.query.active === 'false') {
      filter.active = false;
    } else if (!showAll && !req.query.active && !isPendingOrRejected) {
      filter.active = true;
    }
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
    if (req.query.type) {
      filter.type = req.query.type;
    }
    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
    const total = await Promotion.countDocuments(filter);
    const sort = parseSortQuery(req, {
      name: 'name',
      createdAt: 'createdAt',
      endDate: 'endDate',
      status: 'active',
    }, { createdAt: -1 });
    const promotions = await Promotion.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('changeHistory.changedBy', 'name email');
    res.json(paginated(promotions, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/:id', protect, authorize('merchant_admin', 'manager'), tenantScope, async (req, res) => {
  try {
    const p = await Promotion.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!p) return res.status(404).json({ message: 'Promotion not found' });
    res.json(p);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/', protect, authorize('merchant_admin', 'manager'), tenantScope, resolveSelectedStore, async (req, res) => {
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
      if (!storeId) return res.status(400).json({ message: 'Select a store or create a tenant-wide promotion' });
    }

    const isManager = req.user.role === 'manager';
    const promo = await Promotion.create({
      ...body,
      tenantId: req.tenantId,
      storeId,
      createdBy: req.user.id,
      approvalStatus: isManager ? 'pending' : 'approved',
      approvedBy: isManager ? null : req.user.id,
      approvedAt: isManager ? null : new Date(),
      active: isManager ? false : (body.active !== false),
    });

    if (isManager) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'promotion_approval_requested',
        title: 'Promotion approval requested',
        body: `Manager "${req.user.name || 'Manager'}" created a promotion "${promo.name}" that requires your approval.`,
        meta: { resourceType: 'promotion', resourceId: String(promo._id) },
      });
    }

    res.status(201).json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('merchant_admin', 'manager'), tenantScope, async (req, res) => {
  try {
    const existing = await Promotion.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!existing) return res.status(404).json({ message: 'Promotion not found' });

    const body = { ...req.body };
    delete body.approvalStatus;
    delete body.approvedBy;
    delete body.approvedAt;
    delete body.tenantId;

    if (body.scope === 'tenant') {
      body.storeId = null;
    }
    delete body.scope;

    const isManager = req.user.role === 'manager';
    const updateData = { ...body, updatedBy: req.user.id };
    if (isManager) {
      updateData.approvalStatus = 'pending';
      updateData.active = false;
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }

    const promo = await Promotion.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true },
    );

    if (isManager) {
      await notifyMerchantAdmins(req.tenantId, {
        type: 'promotion_approval_requested',
        title: 'Promotion approval requested',
        body: `Manager "${req.user.name || 'Manager'}" edited promotion "${promo.name}", requiring approval.`,
        meta: { resourceType: 'promotion', resourceId: String(promo._id) },
      });
    }

    res.json(promo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/approve', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
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

router.post('/:id/reject', protect, authorize('merchant_admin'), tenantScope, async (req, res) => {
  try {
    const reason = String(req.body.rejectionReason || '').trim() || 'No reason provided';
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
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

router.delete('/:id', protect, authorize('merchant_admin', 'manager'), tenantScope, async (req, res) => {
  try {
    const promo = await Promotion.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!promo) return res.status(404).json({ message: 'Promotion not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
