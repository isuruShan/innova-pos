const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { buildPayload, signToken } = require('../utils/jwt');
const { authenticateJWT, emitAudit, sendRouteError } = require('@innovapos/shared-middleware');
const { sendPasswordResetEmail } = require('../utils/mailer');
const { childLogger } = require('@innovapos/logger');

const router = express.Router();

const isSubscriptionActive = async (tenantId) => {
  if (!tenantId) return true; // superadmin has no tenant
  const tenant = await Tenant.findById(tenantId).select('subscriptionStatus trialEndsAt status');
  if (!tenant || tenant.status !== 'active') return false;
  if (tenant.subscriptionStatus === 'expired' || tenant.subscriptionStatus === 'cancelled') return false;
  if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) return false;
  return true;
};

// POST /auth/login
router.post('/login', async (req, res) => {
  const logger = childLogger(req.app.locals.logger, req);
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact your administrator.' });
    }

    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    const payload = buildPayload(user, subscriptionActive);
    const token = signToken(payload);

    user.lastLoginAt = new Date();
    await user.save();

    logger.info('User logged in', { userId: user._id, role: user.role, tenantId: user.tenantId });

    await emitAudit({ req: { ...req, user: payload, tenantId: user.tenantId }, action: 'USER_LOGIN', resource: 'User', resourceId: user._id });

    res.json({ token, user: payload });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /auth/me
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    const payload = buildPayload(user, subscriptionActive);
    res.json(payload);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT /auth/me — update own profile (name, profileImage)
router.put('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, profileImage, profileImageKey, currentPassword, newPassword } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      user.name = name.trim();
    }
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (profileImageKey !== undefined) user.profileImageKey = profileImageKey;

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
      const match = await user.comparePassword(currentPassword);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
      if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
      user.password = newPassword;
      user.isTemporaryPassword = false;
    }

    user.updatedBy = req.user.id;
    await user.save();

    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    const payload = buildPayload(user, subscriptionActive);
    const token = signToken(payload);

    res.json({ user: payload, token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    // Always return success to prevent user enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required' });
  if (newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

  try {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: 'Token is invalid or has expired' });

    user.password = newPassword;
    user.isTemporaryPassword = false;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
