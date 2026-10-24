const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const rawAccessSecret = process.env.STUDENT_JWT_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const rawRefreshSecret = process.env.STUDENT_JWT_SECRET || process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (isProd) {
  if (!rawAccessSecret || rawAccessSecret.length < 32 || rawAccessSecret === 'change_this_secret') {
    throw new Error('[FATAL] JWT_ACCESS_SECRET or JWT_SECRET must be configured with at least 32 characters in production.');
  }
}

const ACCESS_SECRET = rawAccessSecret || 'egsa_space_academy_access_secret_key_dev';
const REFRESH_SECRET = rawRefreshSecret || 'egsa_space_academy_refresh_secret_key_dev';
const ACCESS_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Creates a cryptographically secure random token (e.g. for email verification or password reset)
 */
function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Computes a secure SHA-256 digest of a raw token string for database storage
 */
function hashToken(rawToken) {
  if (!rawToken) return null;
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Signs a short-lived Access Token
 */
function signAccessToken(user) {
  const payload = {
    id: user._id || user.id,
    role: user.role || 'student',
    email: user.email,
  };
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

/**
 * Signs a Refresh Token (or issues a random cryptographic token signed as JWT)
 */
function signRefreshToken(user) {
  const payload = {
    id: user._id || user.id,
    type: 'refresh',
  };
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

/**
 * Backward compatibility alias for existing code
 */
function signToken(userId, role = 'student') {
  return signAccessToken({ _id: userId, role });
}

/**
 * Verifies an Access Token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verifies a Refresh Token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  signToken,
  signAccessToken,
  signRefreshToken,
  generateRandomToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
};

