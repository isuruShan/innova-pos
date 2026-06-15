const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticateJWT, authorize, tenantScope, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { childLogger } = require('@innovapos/logger');
const { sendWelcomeEmail, sendAdminResetPasswordEmail } = require('../utils/mailer');
const { createNotification } = require('../lib/notificationHelpers');

const { presignObjectKey, presignObjectKeys } = require('../utils/s3Runtime');
const { parsePageQuery, paginated, parseSortQuery } = require('../lib/listPagination');
const { quoteCreateUser, quoteAssignStores } = require('../lib/userLicenseQuote');
const {
  normalizeStoreAssignments,
  fulfillCreateUser,
} = require('../lib/userLicenseFulfill');

const router = express.Router();

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');
const STAFF_ROLES = ['manager', 'cashier', 'kitchen'];

/**
 * Attach fresh presigned URLs to user profile images using batch presigning.
 */
async function attachFreshProfileImages(users) {
  if (!users?.length) return users;
  const keys = [...new Set(users.map((u) => u.profileImageKey).filter(Boolean))];
  if (!keys.length) return users;
  // Single batch call instead of N individual calls
  const urls = await presignObjectKeys(keys, 86400);
  return users.map((u) => (u.profileImageKey && urls[u.profileImageKey]
    ? { ...u, profileImage: urls[u.profileImageKey] }
    : u));
}

// GET /users
router.get('/', authenticateJWT, tenantScope, authorize('merchant_admin', 'superadmin'), async (req, res) => {
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
    const sort = parseSortQuery(req, {
      name: 'name',
      email: 'email',
      role: 'role',
      createdAt: 'createdAt',
      status: 'isActive',
    }, { role: 1, name: 1 });
    let users = await User.find(filter)
      .populate('storeIds', 'name code')
      .populate('defaultStoreId', 'name code')
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    users = await attachFreshProfileImages(users);
    // Identify the account owner (earliest merchant_admin) for the tenant
    const ownerAdmin = await User.findOne({ tenantId, role: 'merchant_admin' }).sort({ createdAt: 1 }).select('_id').lean();
    const ownerIdStr = ownerAdmin ? String(ownerAdmin._id) : null;
    if (ownerIdStr) {
      users = users.map((u) => ownerIdStr === String(u._id) ? { ...u, isOwner: true } : u);
    }
    res.json(paginated(users, total, page, limit));
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /users — merchant admin only; paid seats via user-licensing checkout
router.post('/', authenticateJWT, tenantScope, authorize('merchant_admin', 'superadmin'), async (req, res) => {
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

    if (role === 'steward') {
      const Tenant = require('../models/Tenant');
      const tenantForSteward = await Tenant.findById(tenantId);
      const { isTableManagementEffective } = require('../lib/addonPeriod');
      if (!isTableManagementEffective(tenantForSteward)) {
        return res.status(400).json({ message: 'Table Management add-on is required to create steward users.' });
      }
    }

    const quote = await quoteCreateUser(tenantId, role, storeIds || []);

    if (quote.requiresPayment && req.user.role !== 'superadmin') {
      const Tenant = require('../models/Tenant');
      const tenant = await Tenant.findById(tenantId).select('subscriptionStatus');
      if (tenant?.subscriptionStatus === 'trial') {
        return res.status(400).json({
          code: 'TRIAL_PERIOD_RESTRICTION',
          message: 'You cannot purchase user seats during your trial period. Please subscribe to a paid plan first.',
        });
      }
      return res.status(402).json({
        code: 'PAYMENT_REQUIRED',
        message: 'Payment is required before adding another user.',
        quote,
      });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const PaymentReceipt = require('../models/PaymentReceipt');
    const pending = await PaymentReceipt.findOne({
      receiptKind: 'user_license',
      userLicenseAction: 'create_user',
      status: 'pending',
      'userLicensePayload.email': email.toLowerCase().trim(),
    });
    if (pending) {
      return res.status(400).json({ message: 'A user creation request for this email is already pending approval' });
    }

    const { user } = await fulfillCreateUser(
      tenantId,
      { name, email, role, storeIds, defaultStoreId, createdBy: req.user.id },
      { createdBy: req.user.id },
    );

    emitAudit({
      req,
      action: 'USER_CREATED',
      resource: 'User',
      resourceId: user._id,
      changes: { after: { name: user.name, email: user.email, role: user.role, tenantId } },
    }).catch(() => {}); // fire-and-forget

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
router.put('/:id', authenticateJWT, tenantScope, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? undefined : req.tenantId;
    const filter = { _id: req.params.id };
    if (tenantId) filter.tenantId = tenantId;

    const user = await User.findOne(filter);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, email, role, isActive, storeIds, defaultStoreId } = req.body;

    // Protect account owner from deactivation by non-superadmin
    if (isActive === false && req.user.role !== 'superadmin') {
      const oldestAdmin = await User.findOne({ tenantId: user.tenantId, role: 'merchant_admin' }).sort({ createdAt: 1 }).select('_id').lean();
      if (oldestAdmin && String(oldestAdmin._id) === String(user._id)) {
        return res.status(403).json({ message: 'The account owner cannot be deactivated. Contact support.' });
      }
    }

    if (name) user.name = name.trim();
    if (email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (conflict) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase();
    }
    if (isActive !== undefined) user.isActive = isActive;

    if (role && role !== user.role) {
      if (req.user.role !== 'superadmin') {
        return res.status(400).json({ message: 'Role changes are not allowed for existing users.' });
      }
      const allowedRoles = [...STAFF_ROLES, 'merchant_admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Role ${role} not allowed` });
      }
      user.role = role;
    }

    if (storeIds !== undefined) {
      const targetIds = (storeIds || []).map(String);
      const quote = await quoteAssignStores(user.tenantId, user._id, targetIds);

      if (quote.requiresPayment && req.user.role !== 'superadmin') {
        const Tenant = require('../models/Tenant');
        const tenant = await Tenant.findById(user.tenantId).select('subscriptionStatus');
        if (tenant?.subscriptionStatus === 'trial') {
          return res.status(400).json({
            code: 'TRIAL_PERIOD_RESTRICTION',
            message: 'You cannot assign users to additional stores during your trial period. Please subscribe to a paid plan first.',
          });
        }
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
        user.licensedStoreSlots = Math.max(1, normalizedStoreIds.length);
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

router.delete('/:id', authenticateJWT, tenantScope, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin' ? undefined : req.tenantId;
    const filter = { _id: req.params.id };
    if (tenantId) filter.tenantId = tenantId;

    const user = await User.findOne(filter);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user._id) === String(req.user.id)) return res.status(400).json({ message: 'Cannot delete your own account' });

    // Protect account owner from deletion by non-superadmin
    if (req.user.role !== 'superadmin') {
      const oldestAdmin = await User.findOne({ tenantId: user.tenantId, role: 'merchant_admin' }).sort({ createdAt: 1 }).select('_id').lean();
      if (oldestAdmin && String(oldestAdmin._id) === String(user._id)) {
        return res.status(403).json({ message: 'The account owner cannot be deleted. Contact support.' });
      }
    }

    await emitAudit({ req, action: 'USER_DELETED', resource: 'User', resourceId: user._id,
      changes: { before: { name: user.name, email: user.email, role: user.role } } });

    await User.deleteOne({ _id: user._id });

    res.json({ message: 'User deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/:id/reset-password', authenticateJWT, tenantScope, authorize('merchant_admin', 'superadmin'), async (req, res) => {
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

    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findById(user.tenantId).select('businessName').lean();
    const businessName = tenant ? tenant.businessName : '';
    const adminName = req.user.role === 'superadmin' ? 'A platform administrator' : (req.user.name || 'An administrator');

    try {
      await sendAdminResetPasswordEmail({
        to: user.email,
        name: user.name,
        tempPassword,
        loginUrl,
        adminName,
        businessName,
      });
      // Push notification paired with the email — rule: every email gets a push
      createNotification(user.tenantId, user._id, {
        type: 'password_reset_by_admin',
        title: '🔐 Password reset by admin',
        body: `${adminName} has reset your password for ${businessName || 'Cafinity'}. Check your email for the temporary password.`,
        meta: { resourceType: 'user', resourceId: String(user._id) },
      }).catch(() => {});
      res.json({ message: 'Password reset and email sent', welcomeEmailSent: true });
    } catch (emailErr) {
      logger.error('Password reset email failed', { error: emailErr.message, to: user.email });
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
