const express = require('express');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { authenticateJWT, authorize, emitAudit } = require('@innovapos/shared-middleware');

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
      Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
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

    const tenant = await Tenant.findById(req.params.id).lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const latestSub = await Subscription.findOne({ tenantId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ...tenant, latestSubscription: latestSub || null });
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
