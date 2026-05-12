const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { protect, sendRouteError } = require('../middleware/auth');
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

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).populate('storeIds', '_id');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isActive)
      return res.status(403).json({ message: 'Account is deactivated. Contact your administrator.' });

    // Check subscription if tenant-scoped
    let subscriptionActive = true;
    if (user.tenantId && !['superadmin', 'merchant_admin'].includes(user.role)) {
      const mongoose = require('mongoose');
      const Tenant = mongoose.models.Tenant || require('../models/Tenant');
      const tenant = await Tenant.findById(user.tenantId).select('subscriptionStatus trialEndsAt status temporaryActivationUntil');
      if (tenant) {
        if (tenant.temporaryActivationUntil && new Date() <= tenant.temporaryActivationUntil) {
          subscriptionActive = true;
        } else if (tenant.status !== 'active') {
          subscriptionActive = false;
        } else if (tenant.subscriptionStatus === 'expired') {
          subscriptionActive = false;
        } else if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
          subscriptionActive = false;
        }
      }
    }

    let payload = buildPayload(user, subscriptionActive);
    payload = await withFreshProfileImage(payload, user);
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ token, user: payload });
  } catch (err) {
    sendRouteError(res, err, { req });
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
      const appUrl = process.env.POS_URL || 'http://localhost:5173';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch((mailErr) => {
        // SMTP misconfiguration is common — log so ops can fix without exposing details to the client
        console.warn('[auth/forgot-password] Email failed:', mailErr?.message || mailErr);
      });
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

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('storeIds', '_id')
      .select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });
    let payload = buildPayload(user, req.user.subscriptionActive);
    payload = await withFreshProfileImage(payload, user);
    res.json(payload);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('storeIds', '_id');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, profileImage, profileImageKey, currentPassword, newPassword } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      user.name = name.trim();
    }
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (profileImageKey !== undefined) user.profileImageKey = profileImageKey;
    if (profileImageKey !== undefined) user.profileImage = '';

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

    let payload = buildPayload(user, req.user.subscriptionActive ?? true);
    payload = await withFreshProfileImage(payload, user);
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });
    res.json({ user: payload, token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
