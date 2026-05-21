const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticateJWT, authorize, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { childLogger } = require('@innovapos/logger');
const { sendWelcomeEmail } = require('../utils/mailer');
const { presignObjectKey } = require('../utils/s3Runtime');
const { parsePageQuery, paginated } = require('../lib/listPagination');
const { quoteCreateUser, quoteAssignStores } = require('../lib/userLicenseQuote');
const {
  normalizeStoreAssignments,
  fulfillCreateUser,
} = require('../lib/userLicenseFulfill');

const router = express.Router();

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');
const STAFF_ROLES = ['manager', 'cashier', 'kitchen'];

async function attachFreshProfileImages(users) {
  if (!users?.length) return users;
  const keys = [...new Set(users.map((u) => u.profileImageKey).filter(Boolean))];
  if (!keys.length) return users;
  const pairs = await Promise.all(keys.map(async (key) => [key, await presignObjectKey(key, 86400)]));
  const urls = Object.fromEntries(pairs.filter(([, url]) => Boolean(url)));
  return users.map((u) => (u.profileImageKey && urls[u.profileImageKey]
    ? { ...u, profileImage: urls[u.profileImageKey] }
    : u));
}

// GET /users
router.get('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || req.tenantId) : req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    const { page, limit, skip } = parsePageQuery(req, { defaultLimit: 25, maxLimit: 100 });
    const filter = { tenantId };
    const roleQ = String(req.query.role || '').trim();
    if (roleQ) {
      const roles = roleQ.split(',').map((r) => r.trim()).filter(Boolean);
      if (roles.length === 1) filter.role = roles[0];
      else if (roles.length > 1) filter.role = { $in: roles };
    }

    const search = String(req.query.search || req.query.q || '').trim();
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    const storeQ = String(req.query.storeIds || req.query.storeId || '').trim();
    if (storeQ) {
      const storeIds = storeQ.split(',').map((s) => s.trim()).filter(Boolean);
      if (storeIds.length) filter.storeIds = { $in: storeIds };
    }

    const total = await User.countDocuments(filter);
    let users = await User.find(filter)
      .populate('storeIds', 'name code')
      .populate('defaultStoreId', 'name code')
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ role: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    users = await attachFreshProfileImages(users);
    res.json(paginated(users, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /users — merchant admin only; paid seats via user-licensing checkout
router.post('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);
  try {
    const { name, email, role, storeIds, defaultStoreId } = req.body;
    if (!name?.trim() || !email?.trim() || !role) {
      return res.status(400).json({ message: 'name, email, and role are required' });
    }

    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
    const allowedRoles =
      req.user.role === 'superadmin' ? [...STAFF_ROLES, 'merchant_admin'] : [...STAFF_ROLES, 'merchant_admin'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: `Role ${role} not allowed` });
    }

    const quote = await quoteCreateUser(tenantId, role, storeIds || []);

    if (quote.requiresPayment && req.user.role !== 'superadmin') {
      return res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        message: 'Payment is required before adding another user.',
        quote,
      });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const { user } = await fulfillCreateUser(
      tenantId,
      { name, email, role, storeIds, defaultStoreId, createdBy: req.user.id },
      { createdBy: req.user.id },
    );

    await emitAudit({
      req,
      action: 'USER_CREATED',
      resource: 'User',
      resourceId: user._id,
      changes: { after: { name: user.name, email: user.email, role: user.role, tenantId } },
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (err) {
    logger.error('Create user failed', { error: err.message });
    res.status(400).json({ message: err.message });
  }
});

// PUT /users/:id
router.put('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? undefined : req.tenantId;
    const filter = { _id: req.params.id };
    if (tenantId) filter.tenantId = tenantId;

    const user = await User.findOne(filter);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, email, role, isActive, storeIds, defaultStoreId } = req.body;

    if (name) user.name = name.trim();
    if (email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (conflict) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase();
    }
    if (isActive !== undefined) user.isActive = isActive;

    if (role && role !== user.role) {
      const allowedRoles =
        req.user.role === 'superadmin' ? [...STAFF_ROLES, 'merchant_admin'] : [...STAFF_ROLES, 'merchant_admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Role ${role} not allowed` });
      }
      user.role = role;
    }

    if (storeIds !== undefined) {
      const targetIds = (storeIds || []).map(String);
      const quote = await quoteAssignStores(user.tenantId, user._id, targetIds);

      if (quote.requiresPayment && req.user.role !== 'superadmin') {
        return res.status(402).json({
          code: 'PAYMENT_REQUIRED',
          message: 'Payment is required to assign this user to additional stores.',
          quote,
        });
      }

      const { normalizedStoreIds, normalizedDefaultStoreId } = await normalizeStoreAssignments({
        tenantId: user.tenantId,
        storeIds: targetIds,
        defaultStoreId: defaultStoreId !== undefined ? defaultStoreId : user.defaultStoreId,
        role: user.role,
      });
      user.storeIds = normalizedStoreIds;
      user.defaultStoreId = normalizedDefaultStoreId;
      if (user.role !== 'merchant_admin') {
        user.licensedStoreSlots = Math.max(user.licensedStoreSlots || 1, normalizedStoreIds.length);
      }
    } else if (defaultStoreId !== undefined) {
      const { normalizedStoreIds, normalizedDefaultStoreId } = await normalizeStoreAssignments({
        tenantId: user.tenantId,
        storeIds: user.storeIds,
        defaultStoreId,
        role: user.role,
      });
      user.storeIds = normalizedStoreIds;
      user.defaultStoreId = normalizedDefaultStoreId;
    }

    user.updatedBy = req.user.id;
    await user.save();

    await emitAudit({ req, action: 'USER_UPDATED', resource: 'User', resourceId: user._id });

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? undefined : req.tenantId;
    const filter = { _id: req.params.id };
    if (tenantId) filter.tenantId = tenantId;

    const user = await User.findOne(filter);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user._id) === String(req.user.id)) return res.status(400).json({ message: 'Cannot delete your own account' });

    user.isActive = false;
    user.updatedBy = req.user.id;
    await user.save();

    await emitAudit({ req, action: 'USER_DEACTIVATED', resource: 'User', resourceId: user._id });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/:id/reset-password', authenticateJWT, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);
  try {
    const tenantId = req.user.role === 'superadmin' ? undefined : req.tenantId;
    const filter = { _id: req.params.id };
    if (tenantId) filter.tenantId = tenantId;

    const user = await User.findOne(filter);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const tempPassword = generateTempPassword();
    user.password = tempPassword;
    user.isTemporaryPassword = true;
    user.updatedBy = req.user.id;
    await user.save();

    const loginUrl = ['merchant_admin'].includes(user.role)
      ? (process.env.ADMIN_URL || 'http://localhost:5174')
      : (process.env.POS_URL || 'http://localhost:5173');

    try {
      await sendWelcomeEmail({ to: user.email, name: user.name, tempPassword, loginUrl });
      res.json({ message: 'Password reset and email sent', welcomeEmailSent: true });
    } catch (emailErr) {
      logger.error('Welcome email failed after password reset', { error: emailErr.message, to: user.email });
      res.json({
        message:
          'Password was reset but the email could not be sent. Share the temporary password manually or fix mail configuration.',
        welcomeEmailSent: false,
      });
    }
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
