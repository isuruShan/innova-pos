const express = require('express');
const User = require('../models/User');
const { protect, authorize, tenantScope } = require('../middleware/auth');

const router = express.Router();

const MANAGER_ROLES = ['cashier', 'kitchen'];
const ADMIN_ROLES = ['manager', 'cashier', 'kitchen'];

// GET all users scoped to current tenant
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.user.role === 'manager') {
      filter.role = { $in: MANAGER_ROLES };
    }
    const users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ role: 1, name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create user
router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!password || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    if (req.user.role === 'manager' && !MANAGER_ROLES.includes(role)) {
      return res.status(403).json({ message: 'Managers can only create cashier or kitchen users' });
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

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role,
      tenantId: req.tenantId,
      createdBy: req.user.id,
    });

    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update user
router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
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
router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
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
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
