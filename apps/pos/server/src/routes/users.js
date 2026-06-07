const express = require('express');
const User = require('../models/User');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { presignObjectKey, presignObjectKeys } = require('../utils/s3Runtime');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

const MANAGER_ROLES = ['cashier', 'kitchen'];
const ADMIN_ROLES = ['manager', 'cashier', 'kitchen'];
const storeAccessFilter = (storeId) => (
  storeId
    ? {
        $or: [
          { storeIds: storeId },
          { storeIds: { $exists: false } },
          { storeIds: { $size: 0 } },
        ],
      }
    : {}
);

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

// GET all users scoped to current tenant
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...storeAccessFilter(req.storeId) };
    if (req.user.role === 'manager') {
      filter.role = { $in: MANAGER_ROLES };
    }
    const sort = parseSortQuery(req, {
      name: 'name',
      role: 'role',
      createdAt: 'createdAt',
      status: 'isActive',
    }, { role: 1, name: 1 });
    let users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpires -managerApprovalPin')
      .sort(sort)
      .lean();
    users = await attachFreshProfileImages(users);
    res.json(users);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET active managers for return approval picker
router.get(
  '/approval-managers',
  protect,
  authorize('cashier', 'manager', 'merchant_admin'),
  tenantScope,
  resolveSelectedStore,
  async (req, res) => {
    try {
      const managers = await User.find({
        tenantId: req.tenantId,
        role: { $in: ['manager', 'merchant_admin'] },
        isActive: true,
        ...storeAccessFilter(req.storeId),
      })
        .select('name email managerApprovalPin')
        .sort({ name: 1 })
        .lean();
      res.json(
        managers.map((m) => ({
          _id: m._id,
          name: m.name,
          email: m.email,
          hasApprovalPin: Boolean(m.managerApprovalPin),
        })),
      );
    } catch (err) {
      sendRouteError(res, err, { req });
    }
  },
);

// PUT /users/me/approval-pin — manager or admin sets return approval PIN
router.put('/me/approval-pin', protect, authorize('manager', 'merchant_admin'), tenantScope, async (req, res) => {
  try {
    const { pin, currentPassword } = req.body || {};
    if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
    const pinStr = String(pin || '').trim();
    if (!/^\d{4,8}$/.test(pinStr)) {
      return res.status(400).json({ message: 'Passcode must be 4–8 digits' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const pwOk = await user.comparePassword(currentPassword);
    if (!pwOk) return res.status(401).json({ message: 'Current password is incorrect' });

    user.managerApprovalPin = pinStr;
    user.updatedBy = req.user.id;
    await user.save();
    res.json({ message: 'Approval passcode updated', hasApprovalPin: true });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST create user
router.post('/', protect, authorize('merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!password || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    if (req.user.role === 'manager') {
      return res.status(403).json({
        message: 'Only merchant admins can create users. Use the admin portal.',
      });
    }
    if (req.user.role === 'merchant_admin' && ![...ADMIN_ROLES, 'merchant_admin'].includes(role)) {
      return res.status(403).json({ message: 'Invalid role for merchant admin' });
    }

    if (role === 'merchant_admin') {
      const adminCount = await User.countDocuments({ tenantId: req.tenantId, role: 'merchant_admin' });
      if (adminCount >= 2) {
        return res.status(400).json({ message: 'Maximum of 2 admin users allowed per merchant' });
      }
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already in use' });

    const writeStoreId = await resolveWriteStoreId(req);
    if (!writeStoreId) return res.status(400).json({ message: 'No store available for user creation' });

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role,
      tenantId: req.tenantId,
      storeIds: [writeStoreId],
      defaultStoreId: writeStoreId,
      createdBy: req.user.id,
    });

    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update user
router.put('/:id', protect, authorize('merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId, ...storeAccessFilter(req.storeId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'manager' && !MANAGER_ROLES.includes(user.role)) {
      return res.status(403).json({ message: 'Cannot edit this user' });
    }

    const { name, email, password, role, isActive } = req.body;
    if (name) user.name = name.trim();
    if (email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (conflict) return res.status(400).json({ message: 'Email already in use' });
      user.email = email.toLowerCase();
    }
    if (role) {
      if (req.user.role === 'manager' && !MANAGER_ROLES.includes(role)) {
        return res.status(403).json({ message: 'Managers can only assign cashier or kitchen roles' });
      }
      user.role = role;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      user.password = password;
    }
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedBy = req.user.id;

    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE user (soft delete)
router.delete('/:id', protect, authorize('merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId, ...storeAccessFilter(req.storeId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'manager' && !MANAGER_ROLES.includes(user.role)) {
      return res.status(403).json({ message: 'Cannot delete this user' });
    }
    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    user.isActive = false;
    user.updatedBy = req.user.id;
    await user.save();
    res.json({ message: 'User deactivated' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
