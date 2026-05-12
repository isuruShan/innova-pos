const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Store = require('../models/Store');
const { authenticateJWT, authorize, tenantScope, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { childLogger } = require('@innovapos/logger');
const { sendWelcomeEmail } = require('../utils/mailer');
const { presignObjectKey } = require('../utils/s3Runtime');

const router = express.Router();

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');
const STAFF_ROLES = ['manager', 'cashier', 'kitchen'];

const normalizeStoreAssignments = async ({ tenantId, storeIds = [], defaultStoreId = null }) => {
  const tenantStores = await Store.find({ tenantId, isActive: true }).select('_id');
  const tenantStoreSet = new Set(tenantStores.map((s) => String(s._id)));
  const normalizedStoreIds = [...new Set((storeIds || []).map(String))]
    .filter((storeId) => tenantStoreSet.has(storeId));
  const normalizedDefaultStoreId = defaultStoreId && tenantStoreSet.has(String(defaultStoreId))
    ? String(defaultStoreId)
    : normalizedStoreIds[0] || null;

  return { normalizedStoreIds, normalizedDefaultStoreId };
};

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

// GET /users — list users in tenant
router.get('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? (req.query.tenantId || req.tenantId) : req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    let users = await User.find({ tenantId })
      .populate('storeIds', 'name code')
      .populate('defaultStoreId', 'name code')
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ role: 1, name: 1 })
      .lean();
    users = await attachFreshProfileImages(users);
    res.json(users);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /users — create staff or second admin
router.post('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);
  try {
    const { name, email, role, storeIds, defaultStoreId } = req.body;
    if (!name?.trim() || !email?.trim() || !role) {
      return res.status(400).json({ message: 'name, email, and role are required' });
    }

    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || req.tenantId) : req.tenantId;
    const allowedRoles = req.user.role === 'superadmin' ? [...STAFF_ROLES, 'merchant_admin'] : STAFF_ROLES;

    if (!allowedRoles.includes(role)) {
      // merchant_admin can create one more merchant_admin (max 2 total)
      if (role === 'merchant_admin' && req.user.role === 'merchant_admin') {
        const adminCount = await User.countDocuments({ tenantId, role: 'merchant_admin', isActive: true });
        if (adminCount >= 2) {
          return res.status(400).json({ message: 'Maximum 2 admin users allowed per merchant' });
        }
      } else {
        return res.status(400).json({ message: `Role ${role} not allowed` });
      }
    }

    if (role === 'merchant_admin' && req.user.role === 'merchant_admin') {
      const adminCount = await User.countDocuments({ tenantId, role: 'merchant_admin', isActive: true });
      if (adminCount >= 2) {
        return res.status(400).json({ message: 'Maximum 2 admin users allowed per merchant' });
      }
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const tempPassword = generateTempPassword();
    const { normalizedStoreIds, normalizedDefaultStoreId } = await normalizeStoreAssignments({
      tenantId,
      storeIds,
      defaultStoreId,
    });
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: tempPassword,
      role,
      tenantId,
      storeIds: normalizedStoreIds,
      defaultStoreId: normalizedDefaultStoreId,
      isTemporaryPassword: true,
      isActive: true,
      createdBy: req.user.id,
    });

    const loginUrl = role === 'merchant_admin'
      ? (process.env.ADMIN_URL || 'http://localhost:5174')
      : (process.env.POS_URL || 'http://localhost:5173');

    await sendWelcomeEmail({ to: user.email, name: user.name, tempPassword, loginUrl }).catch(() => {});

    await emitAudit({ req, action: 'USER_CREATED', resource: 'User', resourceId: user._id,
      changes: { after: { name, email, role, tenantId } } });

    res.status(201).json({
      id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /users/:id
router.put('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
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
    if (role) {
      const allowedRoles = req.user.role === 'superadmin' ? [...STAFF_ROLES, 'merchant_admin'] : STAFF_ROLES;
      if (!allowedRoles.includes(role)) {
        if (role === 'merchant_admin' && req.user.role === 'merchant_admin') {
          const adminCount = await User.countDocuments({
            tenantId: user.tenantId,
            role: 'merchant_admin',
            isActive: true,
            _id: { $ne: user._id },
          });
          if (adminCount >= 2) {
            return res.status(400).json({ message: 'Maximum 2 admin users allowed per merchant' });
          }
        } else {
          return res.status(400).json({ message: `Role ${role} not allowed` });
        }
      }
      user.role = role;
    }
    if (storeIds !== undefined || defaultStoreId !== undefined) {
      const { normalizedStoreIds, normalizedDefaultStoreId } = await normalizeStoreAssignments({
        tenantId: user.tenantId,
        storeIds: storeIds !== undefined ? storeIds : user.storeIds,
        defaultStoreId: defaultStoreId !== undefined ? defaultStoreId : user.defaultStoreId,
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

// DELETE /users/:id — soft delete
router.delete('/:id', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
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

// POST /users/:id/reset-password
router.post('/:id/reset-password', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
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
