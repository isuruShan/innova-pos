const express = require('express');
const mongoose = require('mongoose');
const CashierSession = require('../models/CashierSession');
const User = require('../models/User');
const { authenticateJWT, authorize, tenantScope } = require('@innovapos/shared-middleware');

const router = express.Router();

const resolveTenantId = (req) => (
  req.user.role === 'superadmin' ? (req.query.tenantId || null) : req.tenantId
);

/**
 * List cashier sessions for reporting.
 * - Superadmin: required query ?tenantId=
 * - Merchant admin: tenant from token; scoped to assigned stores (empty storeIds = no rows)
 */
router.get('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        message: req.user.role === 'superadmin'
          ? 'tenantId query parameter is required'
          : 'No tenant context',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      return res.status(400).json({ message: 'Invalid tenantId' });
    }

    const { from, until, status, storeId: storeIdQuery } = req.query;
    const filter = { tenantId };

    if (status) {
      const st = status.split(',').map((s) => s.trim()).filter(Boolean);
      filter.status = st.length === 1 ? st[0] : { $in: st };
    }

    if (from || until) {
      filter.openedAt = {};
      if (from) filter.openedAt.$gte = new Date(from);
      if (until) filter.openedAt.$lte = new Date(until);
    }

    const rawStore = req.headers['x-store-id'] || storeIdQuery;
    if (rawStore && rawStore !== 'all') {
      filter.storeId = rawStore;
    }

    if (req.user.role === 'superadmin') {
      const sessions = await CashierSession.find(filter)
        .populate('cashierId', 'name email role')
        .populate('storeId', 'name code')
        .sort({ closedAt: -1, openedAt: -1 })
        .limit(400)
        .lean();
      return res.json(sessions);
    }

    const requester = await User.findOne({ _id: req.user.id, tenantId }).select('storeIds');
    const allowed = (requester?.storeIds || []).map((id) => String(id));

    if (!allowed.length) {
      return res.json([]);
    }

    if (filter.storeId) {
      if (!allowed.includes(String(filter.storeId))) {
        return res.status(403).json({ message: 'Access denied for selected store' });
      }
    } else {
      filter.storeId = { $in: allowed };
    }

    const sessions = await CashierSession.find(filter)
      .populate('cashierId', 'name email role')
      .populate('storeId', 'name code')
      .sort({ closedAt: -1, openedAt: -1 })
      .limit(400)
      .lean();

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
