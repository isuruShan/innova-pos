'use strict';

const express = require('express');
const PaymentReceipt = require('../models/PaymentReceipt');
const UserLicensePricing = require('../models/UserLicensePricing');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');
const { quoteCreateUser, quoteAssignStores } = require('../lib/userLicenseQuote');
const { ensureDefaultUserLicensePricing } = require('../lib/userLicensePricing');

const router = express.Router();

router.get('/pricing', authenticateJWT, authorize('superadmin'), async (_req, res) => {
  try {
    await ensureDefaultUserLicensePricing();
    const rows = await UserLicensePricing.find().sort({ sortOrder: 1 }).lean();
    res.json(rows);
  } catch (err) {
    sendRouteError(res, err, { req: _req });
  }
});

router.put('/pricing/:role', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const role = String(req.params.role || '').trim().toLowerCase();
    let doc = await UserLicensePricing.findOne({ role });
    if (!doc) doc = new UserLicensePricing({ role });

    const fields = [
      'userSeatMonthlyAmount',
      'userSeatYearlyAmount',
      'extraStoreMonthlyAmount',
      'extraStoreYearlyAmount',
      'currency',
      'internationalUserSeatMonthlyAmount',
      'internationalUserSeatYearlyAmount',
      'internationalExtraStoreMonthlyAmount',
      'internationalExtraStoreYearlyAmount',
      'internationalCurrency',
      'isActive',
      'sortOrder',
    ];
    for (const key of fields) {
      if (req.body[key] != null) {
        if (key.includes('Currency')) doc[key] = String(req.body[key]).trim().toUpperCase();
        else if (key === 'isActive') doc[key] = Boolean(req.body[key]);
        else if (key === 'sortOrder') doc.sortOrder = Number(req.body.sortOrder) || 0;
        else doc[key] = Math.max(0, Number(req.body[key]) || 0);
      }
    }
    doc.updatedBy = req.user.id;
    await doc.save();
    res.json(doc);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/quote/create-user', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { role, storeIds } = req.body;
    if (!role) return res.status(400).json({ message: 'role is required' });
    const quote = await quoteCreateUser(req.tenantId, role, storeIds || []);
    res.json(quote);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});


router.post('/quote/assign-stores', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { userId, storeIds } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const quote = await quoteAssignStores(req.tenantId, userId, storeIds || []);
    res.json(quote);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/pending', authenticateJWT, authorize('merchant_admin'), async (req, res) => {
  try {
    const { action, email, userId } = req.query;
    const pending = await PaymentReceipt.find({
      tenantId: req.tenantId,
      receiptKind: 'user_license',
      status: 'pending',
      ...(action ? { userLicenseAction: String(action) } : {}),
    })
      .sort({ createdAt: -1 })
      .lean();

    const match = pending.find((r) => {
      const p = r.userLicensePayload || {};
      if (action === 'create_user' && email) {
        return String(p.email || '').toLowerCase() === String(email).toLowerCase();
      }
      if (action === 'assign_stores' && userId) {
        return String(p.userId) === String(userId);
      }
      return false;
    });

    res.json({ pending: Boolean(match), receipt: match || null });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
