const express = require('express');
const mongoose = require('mongoose');
const CashierSession = require('../models/CashierSession');
const Order = require('../models/Order');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

function requireSelectedStore(req, res, next) {
  if (!req.storeId) {
    return res.status(400).json({ message: 'Select a store to use cashier sessions' });
  }
  next();
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Treat amounts within half cent as exact match for variance note requirement */
const VARIANCE_EPSILON = 0.005;

async function sumCashSales(tenantId, storeId, cashierId, openedAt, endDate) {
  const tid = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const sid = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const cid = typeof cashierId === 'string' ? new mongoose.Types.ObjectId(cashierId) : cashierId;

  const agg = await Order.aggregate([
    {
      $match: {
        tenantId: tid,
        storeId: sid,
        createdBy: cid,
        status: 'completed',
        paymentType: 'cash',
        createdAt: { $gte: openedAt, $lte: endDate },
      },
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  return round2(agg[0]?.total || 0);
}

function enrichSession(session, cashSalesSoFar, expectedCashInDrawer) {
  const s =
    typeof session.toObject === 'function'
      ? session.toObject()
      : { ...session };
  return {
    session: s,
    cashSalesSoFar,
    expectedCashInDrawer,
  };
}

// GET current user's open session for selected store (live expected cash)
router.get(
  '/current',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  requireSelectedStore,
  async (req, res) => {
    try {
      const session = await CashierSession.findOne({
        tenantId: req.tenantId,
        storeId: req.storeId,
        cashierId: req.user.id,
        status: 'open',
      }).lean();

      if (!session) {
        return res.json({
          session: null,
          cashSalesSoFar: 0,
          expectedCashInDrawer: null,
        });
      }

      const now = new Date();
      const openedAt = new Date(session.openedAt);
      const cashSalesSoFar = await sumCashSales(
        req.tenantId,
        req.storeId,
        req.user.id,
        openedAt,
        now
      );
      const expectedCashInDrawer = round2(session.openingCashBalance + cashSalesSoFar);

      return res.json(enrichSession(session, cashSalesSoFar, expectedCashInDrawer));
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

// POST open session
router.post(
  '/open',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  requireSelectedStore,
  async (req, res) => {
    try {
      const opening = round2(req.body.openingCashBalance);
      if (!Number.isFinite(opening) || opening < 0) {
        return res.status(400).json({ message: 'Opening cash balance must be a non-negative number' });
      }

      const existing = await CashierSession.findOne({
        tenantId: req.tenantId,
        storeId: req.storeId,
        cashierId: req.user.id,
        status: 'open',
      });
      if (existing) {
        return res.status(409).json({
          message: 'You already have an open session for this store',
          sessionId: existing._id,
        });
      }

      const session = await CashierSession.create({
        tenantId: req.tenantId,
        storeId: req.storeId,
        cashierId: req.user.id,
        openingCashBalance: opening,
      });

      const now = new Date();
      const openedAt = new Date(session.openedAt);
      const cashSalesSoFar = await sumCashSales(
        req.tenantId,
        req.storeId,
        req.user.id,
        openedAt,
        now
      );
      const expectedCashInDrawer = round2(session.openingCashBalance + cashSalesSoFar);

      res.status(201).json(enrichSession(session, cashSalesSoFar, expectedCashInDrawer));
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// POST close session
router.post(
  '/:id/close',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  requireSelectedStore,
  async (req, res) => {
    try {
      const session = await CashierSession.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
        storeId: req.storeId,
        status: 'open',
      });
      if (!session) return res.status(404).json({ message: 'Open session not found' });

      const isOwner = String(session.cashierId) === String(req.user.id);
      const isElevated = ['manager', 'merchant_admin'].includes(req.user.role);
      if (!isOwner && !isElevated) {
        return res.status(403).json({ message: 'You can only close your own session' });
      }

      const counted = round2(req.body.closingCountedCash);
      if (!Number.isFinite(counted) || counted < 0) {
        return res.status(400).json({ message: 'Closing counted cash must be a non-negative number' });
      }

      const notes = typeof req.body.varianceNotes === 'string' ? req.body.varianceNotes.trim() : '';

      const closedAt = new Date();
      const openedAt = new Date(session.openedAt);
      const cashSalesDuringSession = await sumCashSales(
        req.tenantId,
        req.storeId,
        session.cashierId,
        openedAt,
        closedAt
      );
      const expectedCashInDrawer = round2(session.openingCashBalance + cashSalesDuringSession);
      const varianceAmount = round2(counted - expectedCashInDrawer);

      if (Math.abs(varianceAmount) > VARIANCE_EPSILON && !notes) {
        return res.status(400).json({
          message: 'Variance notes are required when counted cash differs from the expected amount',
        });
      }

      session.status = 'closed';
      session.closedAt = closedAt;
      session.closingCountedCash = counted;
      session.expectedCashInDrawer = expectedCashInDrawer;
      session.cashSalesDuringSession = cashSalesDuringSession;
      session.varianceAmount = varianceAmount;
      session.varianceNotes = notes;
      await session.save();

      const populated = await CashierSession.findById(session._id)
        .populate('cashierId', 'name email role')
        .lean();

      res.json({ session: populated });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// GET list (merchant admins & managers)
router.get(
  '/',
  protect,
  authorize('manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const { status, cashierId, from, until } = req.query;
      const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };

      if (status) {
        const st = status.split(',').map((s) => s.trim()).filter(Boolean);
        filter.status = st.length === 1 ? st[0] : { $in: st };
      }
      if (cashierId) filter.cashierId = cashierId;

      if (from || until) {
        filter.openedAt = {};
        if (from) filter.openedAt.$gte = new Date(from);
        if (until) filter.openedAt.$lte = new Date(until);
      }

      const sessions = await CashierSession.find(filter)
        .populate('cashierId', 'name email role')
        .sort({ closedAt: -1, openedAt: -1 })
        .limit(200)
        .lean();

      res.json(sessions);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

// GET one
router.get(
  '/:id',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const doc = await CashierSession.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
        ...buildStoreFilter(req),
      })
        .populate('cashierId', 'name email role')
        .lean();

      if (!doc) return res.status(404).json({ message: 'Session not found' });

      const isOwner = String(doc.cashierId?._id || doc.cashierId) === String(req.user.id);
      const isElevated = ['manager', 'merchant_admin'].includes(req.user.role);
      if (!isOwner && !isElevated) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(doc);
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  }
);

module.exports = router;
