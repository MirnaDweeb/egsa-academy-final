const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const bool = (v, d) => (v === undefined ? d : String(v).toLowerCase() === 'true');
const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5100,
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? null : 'mongodb://127.0.0.1:27017/egsa_instructor'),
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
  jwt: {
    accessSecret: process.env.INSTRUCTOR_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.INSTRUCTOR_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.INSTRUCTOR_ACCESS_EXPIRES || process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.INSTRUCTOR_REFRESH_EXPIRES || process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  integrationApiKey: process.env.INTEGRATION_API_KEY || process.env.S2S_SECRET,
  smtp: { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.MAIL_FROM || 'no-reply@egsa.example' },
  rateLimitDisabled: bool(process.env.RATE_LIMIT_DISABLED, false),
};

if (config.nodeEnv === 'production') {
  if (!config.mongoUri) throw new Error('[FATAL] MONGODB_URI is required in production.');
  if (!config.jwt.accessSecret || config.jwt.accessSecret.length < 32) {
    throw new Error('[FATAL] JWT_ACCESS_SECRET must be at least 32 characters in production.');
  }
  if (!config.jwt.refreshSecret || config.jwt.refreshSecret.length < 32) {
    throw new Error('[FATAL] JWT_REFRESH_SECRET must be at least 32 characters in production.');
  }
  if (!config.integrationApiKey || config.integrationApiKey.length < 32) {
    throw new Error('[FATAL] INTEGRATION_API_KEY must be at least 32 characters in production.');
  }
}

module.exports = config;
