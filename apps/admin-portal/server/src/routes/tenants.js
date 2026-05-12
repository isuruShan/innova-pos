const express = require('express');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { authenticateJWT, authorize, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { tenantPlanAudience } = require('../utils/planAudience');
const { presignObjectKey } = require('../utils/s3Runtime');
const { sendEmail } = require('../utils/mailer');
const { notifySuperAdmins } = require('../lib/notificationHelpers');

const router = express.Router();

async function attachFreshTenantLogos(tenants) {
  if (!tenants?.length) return tenants;
  const keys = [...new Set(tenants.map((t) => t.settings?.logoKey).filter(Boolean))];
  if (!keys.length) return tenants;
  const pairs = await Promise.all(keys.map(async (key) => [key, await presignObjectKey(key, 86400)]));
  const urls = Object.fromEntries(pairs.filter(([, url]) => Boolean(url)));
  return tenants.map((t) => {
    const key = t.settings?.logoKey;
    if (!key || !urls[key]) return t;
    return {
      ...t,
      settings: {
        ...(t.settings || {}),
        logoUrl: urls[key],
      },
    };
  });
}

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
    const [tenantsRaw, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
        .lean(),
      Tenant.countDocuments(filter),
    ]);
    const tenants = await attachFreshTenantLogos(tenantsRaw);

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
    sendRouteError(res, err, { req });
  }
});

// GET /tenants/:id — single tenant with subscription info
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    // Merchant admins can only view their own tenant
    if (req.user.role !== 'superadmin' && String(req.user.tenantId) !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let tenant = await Tenant.findById(req.params.id)
      .populate('assignedPlanId', 'name code amount currency billingCycle durationDays isActive')
      .lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    [tenant] = await attachFreshTenantLogos([tenant]);

    const latestSub = await Subscription.findOne({ tenantId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ...tenant, latestSubscription: latestSub || null });
  } catch (err) {
    sendRouteError(res, err, { req });
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
    sendRouteError(res, err, { req });
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
    sendRouteError(res, err, { req });
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
    sendRouteError(res, err, { req });
  }
});

// POST /tenants/:id/temporary-activation/request — merchant requests a one-day override
router.post('/:id/temporary-activation/request', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    if (String(req.user.tenantId) !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    // Resolve current expiry end date (trial end or latest subscription end)
    let expiryEnd = null;
    if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt) {
      expiryEnd = tenant.trialEndsAt;
    } else {
      const latest = await Subscription.findOne({ tenantId: tenant._id }).sort({ endDate: -1 }).lean();
      expiryEnd = latest?.endDate || null;
    }

    if (!expiryEnd) return res.status(400).json({ message: 'No subscription expiry found' });

    const now = new Date();
    if (now <= expiryEnd) return res.status(400).json({ message: 'Subscription has not expired yet' });

    if (tenant.temporaryActivationUsedForEndDate && tenant.temporaryActivationUsedForEndDate.getTime() === expiryEnd.getTime()) {
      return res.status(400).json({ message: 'One-day activation already used for this expiry' });
    }

    // If already requested for the same expiry, return idempotently.
    if (
      tenant.temporaryActivationRequestedAt &&
      tenant.temporaryActivationExpiryEndDate &&
      tenant.temporaryActivationExpiryEndDate.getTime() === expiryEnd.getTime()
    ) {
      return res.json({ message: 'Activation already requested', tenant });
    }

    tenant.temporaryActivationRequestedAt = now;
    tenant.temporaryActivationRequestedBy = req.user.id;
    tenant.temporaryActivationExpiryEndDate = expiryEnd;
    await tenant.save();

    // Notify all superadmins (email + in-app notification).
    const superAdmins = await User.find({ role: 'superadmin', isActive: true }).select('_id email').lean();
    if (superAdmins.length) {
      await notifySuperAdmins(tenant._id, {
        type: 'temporary_activation_requested',
        title: 'One-day activation requested',
        body: `Merchant "${tenant.businessName}" requested a one-day activation override.`,
        meta: { resourceType: 'tenant', resourceId: String(tenant._id), expiryEndDate: expiryEnd.toISOString() },
      });

      await Promise.all(
        superAdmins.map((sa) =>
          sendEmail({
            to: sa.email,
            subject: 'One-day activation request — Cafinity',
            html: `<p>Hi Super Admin,</p>
              <p><strong>One-day activation requested</strong> by a merchant.</p>
              <ul>
                <li><strong>Merchant:</strong> ${tenant.businessName}</li>
                <li><strong>Expiry ended:</strong> ${expiryEnd.toDateString()}</li>
              </ul>
              <p>Please review and activate the merchant for one day if appropriate.</p>`,
          }).catch(() => {}),
        ),
      );
    }

    await emitAudit({
      req,
      action: 'TEMPORARY_ACTIVATION_REQUESTED',
      resource: 'Tenant',
      resourceId: tenant._id,
      changes: { after: { expiryEndDate: expiryEnd } },
    });

    res.json({ message: 'Activation request submitted', tenant });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /tenants/:id/temporary-activation/activate-one-day — superadmin activates the override
router.post('/:id/temporary-activation/activate-one-day', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    if (!tenant.temporaryActivationRequestedAt || !tenant.temporaryActivationExpiryEndDate) {
      return res.status(400).json({ message: 'No activation request found' });
    }

    const expiryEnd = tenant.temporaryActivationExpiryEndDate;
    if (tenant.temporaryActivationUsedForEndDate && tenant.temporaryActivationUsedForEndDate.getTime() === expiryEnd.getTime()) {
      return res.status(400).json({ message: 'This expiry override was already used' });
    }

    const now = new Date();
    // Keep tenant in suspended mode (requirement), but allow one-day access via auth overrides.
    tenant.status = 'suspended';
    tenant.temporaryActivationUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tenant.temporaryActivationUsedForEndDate = expiryEnd;

    // Clear request fields.
    tenant.temporaryActivationRequestedAt = null;
    tenant.temporaryActivationRequestedBy = null;
    tenant.temporaryActivationExpiryEndDate = null;
    await tenant.save();

    // Email merchant admins about temporary activation.
    const merchantAdmins = await User.find({ tenantId: tenant._id, role: 'merchant_admin', isActive: true }).select('email').lean();
    await Promise.all(
      merchantAdmins.map((a) =>
        sendEmail({
          to: a.email,
          subject: 'Temporary one-day activation — Cafinity',
          html: `<p>Hi,</p>
            <p>Your merchant account has been granted a <strong>one-day activation</strong> due to subscription expiry.</p>
            <p>Until: <strong>${tenant.temporaryActivationUntil.toDateString()}</strong></p>
            <p>Please upload / pay to reactivate your subscription permanently.</p>`,
        }).catch(() => {}),
      ),
    );

    await emitAudit({
      req,
      action: 'TEMPORARY_ACTIVATION_ACTIVATED',
      resource: 'Tenant',
      resourceId: tenant._id,
      changes: { after: { temporaryActivationUntil: tenant.temporaryActivationUntil } },
    });

    res.json({ message: 'One-day activation granted', tenant });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
