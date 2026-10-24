const jwt = require('jsonwebtoken');

function generateToken(user) {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32 || secret === 'replace_this_with_a_long_random_secret') {
      throw new Error('[FATAL] JWT_SECRET must be configured with at least 32 characters in production.');
    }
  }
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    secret || 'admin_jwt_secret_dev_key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = generateToken;
