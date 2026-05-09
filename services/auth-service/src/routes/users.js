const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticateJWT, authorize, tenantScope, emitAudit } = require('@innovapos/shared-middleware');
const { sendWelcomeEmail } = require('../utils/mailer');
const { childLogger } = require('@innovapos/logger');

const router = express.Router();

// Roles a manager can manage
const MANAGER_ROLES = ['cashier', 'kitchen'];
// Roles a merchant_admin can manage
const ADMIN_ROLES = ['manager', 'cashier', 'kitchen'];

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');

/**
 * GET /users — list users scoped to the current tenant.
 * Superadmin can pass ?tenantId=xxx to see a specific tenant's users.
 */
router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.role === 'superadmin'
      ? (req.query.tenantId || null)
      : req.tenantId;

    const filter = tenantId ? { tenantId } : {};

    // Non-superadmin: only see users they can manage
    if (req.user.role === 'manager') {
      filter.role = { $in: MANAGER_ROLES };
    } else if (req.user.role === 'merchant_admin') {
      filter.role = { $in: [...ADMIN_ROLES, 'merchant_admin'] };
    }

    const users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ role: 1, name: 1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /users — create a new user.
 * - manager: can create cashier/kitchen
 * - merchant_admin: can create manager/cashier/kitchen + 1 more merchant_admin (max 2 total)
 * - superadmin: can create any role including merchant_admin
 */
router.post('/', authenticateJWT, tenantScope, async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);

  try {
    const { name, email, role, sendWelcome = true } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!role) return res.status(400).json({ message: 'Role is required' });

    // Role permission checks
    if (req.user.role === 'manager' && !MANAGER_ROLES.includes(role)) {
      return res.status(403).json({ message: 'Managers can only create cashier or kitchen users' });
    }
    if (req.user.role === 'merchant_admin' && ![...ADMIN_ROLES, 'merchant_admin'].includes(role)) {
      return res.status(403).json({ message: 'Invalid role for admin' });
    }
    if (req.user.role !== 'superadmin' && role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot create superadmin users' });
    }

    // Enforce max 2 merchant_admins per tenant
    if (role === 'merchant_admin' && req.user.role !== 'superadmin') {
      const adminCount = await User.countDocuments({ tenantId: req.tenantId, role: 'merchant_admin' });
      if (adminCount >= 2) {
        return res.status(400).json({ message: 'Maximum of 2 admin users allowed per merchant' });
      }
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const tempPassword = generateTempPassword();
    const tenantId = req.user.role === 'superadmin' ? (req.body.tenantId || null) : req.tenantId;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: tempPassword,
      role,
      tenantId,
      isTemporaryPassword: true,
      createdBy: req.user.id,
    });

    logger.info('User created', { newUserId: user._id, role, tenantId });

    await emitAudit({
      req,
      action: 'USER_CREATED',
      resource: 'User',
      resourceId: user._id,
      changes: { after: { name, email, role } },
    });

    if (sendWelcome) {
      const loginUrl = process.env.POS_URL || 'http://localhost:5173';
      await sendWelcomeEmail({ to: user.email, name: user.name, tempPassword, loginUrl }).catch(() => {});
    }

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      isTemporaryPassword: user.isTemporaryPassword,
    });
  } catch (err) {
    logger.error('Create user error', { error: err.message });
    res.status(400).json({ message: err.message });
  }
});

/**
 * PUT /users/:id — update a user.
 */
router.put('/:id', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Ensure same tenant (superadmin bypasses)
    if (req.user.role !== 'superadmin' && String(user.tenantId) !== String(req.tenantId)) {
      return res.status(403).json({ message: 'Cannot edit users from another tenant' });
    }

    // Cannot edit superadmins unless you are one
    if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot edit superadmin users' });
    }

    const { name, email, role, isActive } = req.body;
    const before = { name: user.name, email: user.email, role: user.role, isActive: user.isActive };

    if (name) user.name = name.trim();
    if (email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (conflict) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase();
    }
    if (role) {
      // Validate role change permissions
      if (req.user.role === 'manager' && !MANAGER_ROLES.includes(role)) {
        return res.status(403).json({ message: 'Managers can only assign cashier or kitchen roles' });
      }
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedBy = req.user.id;

    await user.save();

    await emitAudit({
      req,
      action: 'USER_UPDATED',
      resource: 'User',
      resourceId: user._id,
      changes: { before, after: { name: user.name, email: user.email, role: user.role, isActive: user.isActive } },
    });

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /users/:id — soft-delete (deactivate) a user.
 */
router.delete('/:id', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.user.role !== 'superadmin' && String(user.tenantId) !== String(req.tenantId)) {
      return res.status(403).json({ message: 'Cannot delete users from another tenant' });
    }
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete superadmin users' });
    }
    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    user.isActive = false;
    user.updatedBy = req.user.id;
    await user.save();

    await emitAudit({ req, action: 'USER_DEACTIVATED', resource: 'User', resourceId: user._id });

    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /users/:id/reset-password — admin resets a user's password to a new temp password.
 */
router.post('/:id/reset-password', authenticateJWT, authorize('merchant_admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.user.role !== 'superadmin' && String(user.tenantId) !== String(req.tenantId)) {
      return res.status(403).json({ message: 'Cannot reset password for users from another tenant' });
    }

    const tempPassword = generateTempPassword();
    user.password = tempPassword;
    user.isTemporaryPassword = true;
    user.updatedBy = req.user.id;
    await user.save();

    await emitAudit({ req, action: 'USER_PASSWORD_RESET', resource: 'User', resourceId: user._id });

    const loginUrl = process.env.POS_URL || 'http://localhost:5173';
    await sendWelcomeEmail({ to: user.email, name: user.name, tempPassword, loginUrl }).catch(() => {});

    res.json({ message: 'Password reset and welcome email sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
