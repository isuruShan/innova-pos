const express = require('express');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { authenticateJWT, authorize, emitAudit } = require('@innovapos/shared-middleware');
const { tenantPlanAudience } = require('../utils/planAudience');

const router = express.Router();

// GET /tenants — list all tenants (superadmin only)
router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
        .lean(),
      Tenant.countDocuments(filter),
    ]);

    // Attach admin count per tenant
    const tenantIds = tenants.map(t => t._id);
    const adminUsers = await User.find({
      tenantId: { $in: tenantIds },
      role: 'merchant_admin',
      isActive: true,
    }).select('tenantId name email').lean();

    const adminMap = {};
    adminUsers.forEach(u => {
      const k = u.tenantId.toString();
      if (!adminMap[k]) adminMap[k] = [];
      adminMap[k].push({ name: u.name, email: u.email });
    });

    res.json({
      tenants: tenants.map(t => ({ ...t, admins: adminMap[t._id.toString()] || [] })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /tenants/:id — single tenant with subscription info
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    // Merchant admins can only view their own tenant
    if (req.user.role !== 'superadmin' && String(req.user.tenantId) !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const tenant = await Tenant.findById(req.params.id)
      .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
      .lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const latestSub = await Subscription.findOne({ tenantId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ...tenant, latestSubscription: latestSub || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /tenants/:id/plan — assign/change tenant plan (superadmin)
router.put('/:id/plan', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { planId, planLocked } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
    if (!plan) return res.status(400).json({ message: 'Selected plan is not active or does not exist' });

    const wantAudience = tenantPlanAudience(tenant.countryIso);
    if (plan.planAudience && plan.planAudience !== wantAudience) {
      return res.status(400).json({ message: 'This plan is not available for this merchant region' });
    }

    tenant.assignedPlanId = plan._id;
    tenant.planLocked = planLocked !== undefined ? Boolean(planLocked) : tenant.planLocked;
    tenant.assignedAt = new Date();
    tenant.assignedBy = req.user.id;
    tenant.updatedBy = req.user.id;
    await tenant.save();

    await emitAudit({
      req,
      action: 'TENANT_PLAN_ASSIGNED',
      resource: 'Tenant',
      resourceId: tenant._id,
      changes: { after: { assignedPlanId: plan._id, planLocked: tenant.planLocked } },
    });

    const populated = await Tenant.findById(tenant._id)
      .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
      .lean();
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /tenants/:id/plan-lock — lock/unlock plan override for merchant admin
router.put('/:id/plan-lock', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { planLocked } = req.body;
    if (planLocked === undefined) return res.status(400).json({ message: 'planLocked is required' });
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { planLocked: Boolean(planLocked), updatedBy: req.user.id },
      { new: true }
    ).populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    await emitAudit({
      req,
      action: 'TENANT_PLAN_LOCK_CHANGED',
      resource: 'Tenant',
      resourceId: tenant._id,
      changes: { after: { planLocked: tenant.planLocked } },
    });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /tenants/:id/status — suspend / activate (superadmin)
router.put('/:id/status', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { status, updatedBy: req.user.id },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    await emitAudit({
      req,
      action: 'TENANT_STATUS_CHANGED',
      resource: 'Tenant',
      resourceId: tenant._id,
      changes: { after: { status } },
    });

    res.json(tenant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
