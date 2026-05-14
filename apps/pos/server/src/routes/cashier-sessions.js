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

function toOid(id) {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

function buildSessionOrderMatch(tenantId, storeId, cashierId, openedAt, endDate) {
  return {
    tenantId: toOid(tenantId),
    storeId: toOid(storeId),
    status: 'completed',
    createdAt: { $gte: openedAt, $lte: endDate },
    /** POS orders: created by this cashier. QR / table orders: attribute to who completed payment. */
    $or: [{ createdBy: toOid(cashierId) }, { orderSource: 'qr', updatedBy: toOid(cashierId) }],
  };
}

async function aggregateSessionSalesBreakdown(tenantId, storeId, cashierId, openedAt, endDate) {
  const match = buildSessionOrderMatch(tenantId, storeId, cashierId, openedAt, endDate);

  const [totalsAgg, byPayment] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: { $ifNull: ['$discountTotal', 0] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$paymentType', 'unknown'] },
          revenue: { $sum: '$totalAmount' },
          cnt: { $sum: 1 },
        },
      },
    ]),
  ]);

  const salesByPaymentType = (byPayment || []).map((r) => ({
    paymentType: String(r._id || 'unknown'),
    revenue: round2(r.revenue || 0),
    orderCount: r.cnt || 0,
  }));

  let cashSales = 0;
  let cardSales = 0;
  let otherSales = 0;
  for (const row of salesByPaymentType) {
    const pt = String(row.paymentType || '').toLowerCase();
    if (pt === 'cash') cashSales += row.revenue;
    else if (pt === 'card') cardSales += row.revenue;
    else otherSales += row.revenue;
  }

  return {
    salesByPaymentType,
    cashSales: round2(cashSales),
    cardSales: round2(cardSales),
    otherSales: round2(otherSales),
    totalDiscounts: round2(totalsAgg[0]?.totalDiscounts || 0),
    orderCount: totalsAgg[0]?.orders || 0,
  };
}

function sumCashMovements(movements) {
  const list = Array.isArray(movements) ? movements : [];
  let inSum = 0;
  let outSum = 0;
  for (const m of list) {
    const a = round2(Math.abs(Number(m.amount) || 0));
    if (m.kind === 'cash_in') inSum += a;
    else if (m.kind === 'cash_out') outSum += a;
  }
  return {
    cashInTotal: round2(inSum),
    cashOutTotal: round2(outSum),
    netCashMovements: round2(inSum - outSum),
  };
}

function enrichSession(session, cashSalesSoFar, expectedCashInDrawer, breakdown, movementTotals) {
  const s =
    typeof session.toObject === 'function'
      ? session.toObject()
      : { ...session };
  return {
    session: s,
    cashSalesSoFar,
    expectedCashInDrawer,
    breakdown,
    cashInTotal: movementTotals.cashInTotal,
    cashOutTotal: movementTotals.cashOutTotal,
    netCashMovements: movementTotals.netCashMovements,
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
          breakdown: null,
          cashInTotal: 0,
          cashOutTotal: 0,
          netCashMovements: 0,
        });
      }

      const now = new Date();
      const openedAt = new Date(session.openedAt);
      const [breakdown, movementTotals] = await Promise.all([
        aggregateSessionSalesBreakdown(req.tenantId, req.storeId, req.user.id, openedAt, now),
        Promise.resolve(sumCashMovements(session.cashMovements)),
      ]);
      const cashSalesSoFar = breakdown.cashSales;
      const expectedCashInDrawer = round2(
        session.openingCashBalance + cashSalesSoFar + movementTotals.netCashMovements,
      );

      return res.json(enrichSession(session, cashSalesSoFar, expectedCashInDrawer, breakdown, movementTotals));
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
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
      const breakdown = await aggregateSessionSalesBreakdown(
        req.tenantId,
        req.storeId,
        req.user.id,
        openedAt,
        now,
      );
      const movementTotals = sumCashMovements(session.cashMovements);
      const cashSalesSoFar = breakdown.cashSales;
      const expectedCashInDrawer = round2(
        session.openingCashBalance + cashSalesSoFar + movementTotals.netCashMovements,
      );

      res.status(201).json(enrichSession(session, cashSalesSoFar, expectedCashInDrawer, breakdown, movementTotals));
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// POST record cash in / cash out (adjusts expected drawer for this session)
router.post(
  '/:id/movements',
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
      if (!isOwner) {
        return res.status(403).json({ message: 'Only the session cashier can record cash in or cash out' });
      }

      const kind = String(req.body.kind || '').trim();
      if (kind !== 'cash_in' && kind !== 'cash_out') {
        return res.status(400).json({ message: 'kind must be cash_in or cash_out' });
      }

      const amount = round2(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
      }

      const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

      session.cashMovements.push({
        kind,
        amount,
        notes,
        createdAt: new Date(),
        createdBy: req.user.id,
      });
      await session.save();

      const now = new Date();
      const openedAt = new Date(session.openedAt);
      const breakdown = await aggregateSessionSalesBreakdown(
        req.tenantId,
        req.storeId,
        req.user.id,
        openedAt,
        now,
      );
      const movementTotals = sumCashMovements(session.cashMovements);
      const cashSalesSoFar = breakdown.cashSales;
      const expectedCashInDrawer = round2(
        session.openingCashBalance + cashSalesSoFar + movementTotals.netCashMovements,
      );

      const lean = await CashierSession.findById(session._id).lean();
      res.status(201).json(enrichSession(lean, cashSalesSoFar, expectedCashInDrawer, breakdown, movementTotals));
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
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
      const breakdown = await aggregateSessionSalesBreakdown(
        req.tenantId,
        req.storeId,
        session.cashierId,
        openedAt,
        closedAt,
      );
      const cashSalesDuringSession = breakdown.cashSales;
      const movementTotals = sumCashMovements(session.cashMovements);
      const expectedCashInDrawer = round2(
        session.openingCashBalance + cashSalesDuringSession + movementTotals.netCashMovements,
      );
      const varianceAmount = round2(counted - expectedCashInDrawer);

      if (Math.abs(varianceAmount) > VARIANCE_EPSILON && !notes) {
        return res.status(400).json({
          message: 'Variance notes are required when counted cash differs from the expected amount',
        });
      }

      session.sessionCloseBreakdown = {
        salesByPaymentType: breakdown.salesByPaymentType,
        cashSales: breakdown.cashSales,
        cardSales: breakdown.cardSales,
        otherSales: breakdown.otherSales,
        totalDiscounts: breakdown.totalDiscounts,
        orderCount: breakdown.orderCount,
        cashInTotal: movementTotals.cashInTotal,
        cashOutTotal: movementTotals.cashOutTotal,
        netCashMovements: movementTotals.netCashMovements,
        cashMovements: (session.cashMovements || []).map((m) => ({
          kind: m.kind,
          amount: round2(m.amount),
          notes: m.notes || '',
          createdAt: m.createdAt,
        })),
      };

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
  },
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
  },
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
  },
);

module.exports = router;
