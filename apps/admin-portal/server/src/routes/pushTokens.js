const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/users/push-token
 * Registers an FCM push registration token for the logged-in admin user.
 */
router.post('/push-token', protect, async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Push registration token is required' });
  }

  try {
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { fcmTokens: token },
    });
    res.json({ ok: true, message: 'Push notification token registered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/users/push-token/remove
 * Unregisters an FCM push registration token (e.g. on logout).
 */
router.post('/push-token/remove', protect, async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Token to remove is required' });
  }

  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { fcmTokens: token },
    });
    res.json({ ok: true, message: 'Push notification token removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
