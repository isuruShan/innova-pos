const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { authenticateJWT } = require('@innovapos/shared-middleware');

const router = express.Router();

const buildPayload = (u, subscriptionActive = true) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  tenantId: u.tenantId || null,
  profileImage: u.profileImage || '',
  isTemporaryPassword: u.isTemporaryPassword || false,
  subscriptionActive,
});

const isSubscriptionActive = async (tenantId) => {
  if (!tenantId) return true;
  const tenant = await Tenant.findById(tenantId).select('subscriptionStatus trialEndsAt status');
  if (!tenant || tenant.status !== 'active') return false;
  if (tenant.subscriptionStatus === 'expired') return false;
  if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) return false;
  return true;
};

// POST /auth/login — only merchant_admin and superadmin can log into the admin portal
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isActive)
      return res.status(403).json({ message: 'Account is deactivated' });

    if (!['merchant_admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. This portal is for admins only.' });
    }

    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    const payload = buildPayload(user, subscriptionActive);
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    user.lastLoginAt = new Date();
    await user.save();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /auth/me
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    res.json(buildPayload(user, subscriptionActive));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /auth/me — change own name, password
router.put('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, currentPassword, newPassword } = req.body;
    if (name?.trim()) user.name = name.trim();

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password required' });
      if (!(await user.comparePassword(currentPassword))) return res.status(400).json({ message: 'Current password incorrect' });
      if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
      user.password = newPassword;
      user.isTemporaryPassword = false;
    }
    user.updatedBy = req.user.id;
    await user.save();

    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    const payload = buildPayload(user, subscriptionActive);
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ user: payload, token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
