const express = require('express');
const Customer = require('../models/Customer');
const LoyaltyTier = require('../models/LoyaltyTier');
const { getEffectiveTier, tierFromPoints } = require('../lib/loyaltyTier');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');
const requireLoyalty = requirePaidAddon('loyalty');
const { notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { parseSortQuery } = require('../lib/listPagination');

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
    const sort = parseSortQuery(req, {
      name: 'name',
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      points: 'lifetimePoints',
    }, { updatedAt: -1 });
    const rows = await Customer.find(filter).sort(sort).limit(500);
    res.json(rows);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/:id/points', protect, authorize('manager', 'merchant_admin'), tenantScope, requireLoyalty, async (req, res) => {
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

router.get(
  '/:id',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  (req, res, next) => (req.query.loyalty === '1' ? requireLoyalty(req, res, next) : next()),
  async (req, res) => {
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
    sendRouteError(res, err, { req });
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

const CustomerSessionCheckin = require('../models/CustomerSessionCheckin');
const { publishCheckinEvent, subscribeCheckinEvent } = require('../lib/notificationBus');

// GET /api/customers/session-checkin-sse/:sessionId — SSE stream for cashier to receive check-in notification
router.get('/session-checkin-sse/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  console.log(`[session-checkin-sse] Client connected for session: ${sessionId}`);
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
  });

  // Keep-alive tick
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  // Subscribe to check-in notifications from the notification bus (clustered/single instance safe)
  const unsubscribe = subscribeCheckinEvent(sessionId, (message) => {
    console.log(`[session-checkin-sse] Sending event to client for session ${sessionId}`);
    res.write(`data: ${message}\n\n`);
  });

  req.on('close', () => {
    console.log(`[session-checkin-sse] Client disconnected for session: ${sessionId}`);
    clearInterval(keepAlive);
    unsubscribe();
  });
});

// POST /api/customers/session-checkin-trigger/:sessionId — Called when a customer successfully checks in
router.post('/session-checkin-trigger/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`[session-checkin-trigger] Received trigger for session: ${sessionId}`);
    
    const checkin = await CustomerSessionCheckin.findOne({ sessionId });
    if (!checkin) {
      console.log(`[session-checkin-trigger] Session not found: ${sessionId}`);
      return res.status(404).json({ message: 'Active check-in session not found' });
    }

    if (checkin.status !== 'completed') {
      return res.status(400).json({ message: 'Check-in is not completed' });
    }

    // Match or create the customer in POS database
    const emailNorm = normalizeEmail(checkin.email);
    let customer = await findExistingCustomerByContact(checkin.tenantId, emailNorm, checkin.mobile);
    
    if (!customer) {
      customer = await Customer.create({
        tenantId: checkin.tenantId,
        storeId: checkin.storeId,
        name: checkin.name || 'Customer',
        mobile: checkin.mobile,
        email: emailNorm,
        birthday: checkin.birthday || null,
        lastLoyaltyActivityAt: new Date(),
      });
    } else {
      // If customer exists, let's update their details if they inputted new values
      let changed = false;
      if (checkin.name && !customer.name) {
        customer.name = checkin.name;
        changed = true;
      }
      if (checkin.birthday && !customer.birthday) {
        customer.birthday = checkin.birthday;
        changed = true;
      }
      if (emailNorm && !customer.email) {
        customer.email = emailNorm;
        changed = true;
      }
      if (changed) {
        await customer.save();
      }
    }

    // Broadcast check-in complete event across all process instances via Redis/Bus
    console.log(`[session-checkin-trigger] Publishing event for session ${sessionId}, customer: ${customer._id}`);
    publishCheckinEvent(sessionId, customer);

    res.json({ success: true, customer });
  } catch (err) {
    console.error(`[session-checkin-trigger] Error:`, err.message);
    sendRouteError(res, err, { req });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const c = await Customer.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
