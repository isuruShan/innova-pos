const jwt = require('jsonwebtoken');

/**
 * Build the JWT payload from a User document + tenant subscription info.
 */
const buildPayload = (user, subscriptionActive = true) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  tenantId: user.tenantId || null,
  profileImage: user.profileImage || '',
  isTemporaryPassword: user.isTemporaryPassword || false,
  subscriptionActive,
});

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });

module.exports = { buildPayload, signToken };
