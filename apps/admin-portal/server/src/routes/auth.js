const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { authenticateJWT, sendRouteError } = require('@innovapos/shared-middleware');
const { sendPasswordResetEmail } = require('../utils/mailer');
const { presignObjectKey } = require('../utils/s3Runtime');

const router = express.Router();

const toStoreIdList = (storeRefs = []) => storeRefs
  .map((s) => (s && s._id ? s._id : s))
  .filter(Boolean)
  .map((s) => String(s));

const buildPayload = (u, subscriptionActive = true) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  tenantId: u.tenantId || null,
  storeIds: toStoreIdList(Array.isArray(u.storeIds) ? u.storeIds : []),
  defaultStoreId: u.defaultStoreId ? String(u.defaultStoreId) : null,
  profileImage: u.profileImage || '',
  isTemporaryPassword: u.isTemporaryPassword || false,
  subscriptionActive,
});

async function withFreshProfileImage(payload, userDoc) {
  if (!userDoc?.profileImageKey) return payload;
  const url = await presignObjectKey(userDoc.profileImageKey, 86400);
  if (!url) return payload;
  return { ...payload, profileImage: url };
}

const isSubscriptionActive = async (tenantId) => {
  if (!tenantId) return true;
  const tenant = await Tenant.findById(tenantId).select('subscriptionStatus trialEndsAt status temporaryActivationUntil');
  if (!tenant) return false;
  if (tenant.temporaryActivationUntil && new Date() <= tenant.temporaryActivationUntil) return true;
  if (tenant.status !== 'active') return false;
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
    let payload = buildPayload(user, subscriptionActive);
    payload = await withFreshProfileImage(payload, user);
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

router.post('/forgot-password', async (req, res) => {
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ message: 'Email is required' });
  try {
    const user = await User.findOne({ email, isActive: true });
    if (user) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.resetPasswordToken = hashed;
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      const appUrl = process.env.ADMIN_URL || 'http://localhost:5174';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch(() => {});
    }
    res.json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ message: 'token and newPassword are required' });
  if (String(newPassword).length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
  try {
    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true,
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });
    user.password = newPassword;
    user.isTemporaryPassword = false;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ message: 'Password reset successful' });
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
    let payload = buildPayload(user, subscriptionActive);
    payload = await withFreshProfileImage(payload, user);
    res.json(payload);
  } catch (err) {
    sendRouteError(res, err, { req });
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
    let payload = buildPayload(user, subscriptionActive);
    payload = await withFreshProfileImage(payload, user);
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ user: payload, token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
