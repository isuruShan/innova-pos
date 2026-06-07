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
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    user.lastLoginAt = new Date();
    await user.save();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.json({ token, refreshToken, user: payload });
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

// PUT /auth/me — change own name, password, profile image
router.put('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, currentPassword, newPassword, profileImage, profileImageKey } = req.body;
    if (name?.trim()) user.name = name.trim();
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (profileImageKey !== undefined) user.profileImageKey = profileImageKey;
    if (profileImageKey !== undefined) user.profileImage = '';

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
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ user: payload, token, refreshToken });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /auth/me/approval-pin — set/change the manager approval PIN (merchant_admin only)
router.put('/me/approval-pin', authenticateJWT, async (req, res) => {
  try {
    if (!['merchant_admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only merchant admins and managers can set an approval PIN' });
    }
    const { currentPassword, newPin } = req.body;
    if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
    if (!newPin) return res.status(400).json({ message: 'New PIN is required' });
    if (!/^\d{4,8}$/.test(String(newPin))) {
      return res.status(400).json({ message: 'PIN must be 4–8 digits' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.managerApprovalPin = String(newPin);
    user.updatedBy = req.user.id;
    await user.save();

    res.json({ message: 'Approval PIN updated successfully' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});


// POST /auth/profile-image — upload profile image
const multer = require('multer');
const { proxyUploadToService } = require('../lib/uploadProxy');
const uploadProfileImg = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Profile image must be JPEG, PNG, or WebP'), ok);
  },
});

router.post('/profile-image', authenticateJWT, uploadProfileImg.single('profileImage'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const uploaded = await proxyUploadToService({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'profile.webp',
      mimetype: req.file.mimetype,
      type: 'logo',
      authorization: req.headers.authorization,
    });
    const { key } = uploaded;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.profileImage = '';
    user.profileImageKey = key;
    await user.save();

    const freshUrl = await presignObjectKey(key, 86400);
    res.json({ profileImage: freshUrl, profileImageKey: key });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendRouteError(res, err, { req });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    if (!['merchant_admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subscriptionActive = await isSubscriptionActive(user.tenantId);
    let payload = buildPayload(user, subscriptionActive);
    payload = await withFreshProfileImage(payload, user);

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const newRefreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, refreshToken: newRefreshToken, user: payload });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
