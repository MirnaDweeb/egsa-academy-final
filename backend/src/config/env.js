const path = require('path');
const dotenv = require('dotenv');

// Load environment from .env in backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT) || 5000;

const clientUrls = (process.env.CLIENT_URL || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const env = {
  nodeEnv,
  port,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  clientUrls,
  db: {
    studentUri: process.env.STUDENT_MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy',
    instructorUri: process.env.INSTRUCTOR_MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_instructor',
    adminUri: process.env.ADMIN_MONGO_URI || 'mongodb://127.0.0.1:27017/esa_academy',
  },
  jwt: {
    studentSecret: process.env.STUDENT_JWT_SECRET || process.env.JWT_SECRET || 'egsa_student_dev_secret_min_32_characters',
    studentExpiresIn: process.env.STUDENT_JWT_EXPIRES_IN || '7d',
    instructorAccessSecret: process.env.INSTRUCTOR_ACCESS_SECRET || 'egsa_instructor_dev_access_secret_32_chars',
    instructorAccessExpires: process.env.INSTRUCTOR_ACCESS_EXPIRES || '15m',
    instructorRefreshSecret: process.env.INSTRUCTOR_REFRESH_SECRET || 'egsa_instructor_dev_refresh_secret_32_chars',
    instructorRefreshExpires: process.env.INSTRUCTOR_REFRESH_EXPIRES || '7d',
    adminSecret: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'egsa_admin_dev_secret_min_32_characters',
    adminExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '24h',
  },
  integrationApiKey: process.env.INTEGRATION_API_KEY || process.env.S2S_SECRET || 'egsa-integration-key-default-dev',
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'DEVELOPMENT_MOCK',
    apiKey: process.env.PAYMOB_API_KEY || '',
    integrationId: process.env.PAYMOB_INTEGRATION_ID || '',
    iframeId: process.env.PAYMOB_IFRAME_ID || '',
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
    baseUrl: process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api',
    refundEncryptionKey: process.env.REFUND_DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
  rateLimitDisabled: nodeEnv !== 'production' && process.env.RATE_LIMIT_DISABLED === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'Egyptian Space Agency Academy <no-reply@egsa.gov.eg>',
  },
};

// Fail-safe validation for production deployments
if (env.isProduction) {
  const missing = [];
  if (!process.env.STUDENT_MONGO_URI && !process.env.MONGO_URI) missing.push('STUDENT_MONGO_URI');
  if (!process.env.INSTRUCTOR_MONGO_URI && !process.env.MONGODB_URI) missing.push('INSTRUCTOR_MONGO_URI');
  if (!process.env.ADMIN_MONGO_URI && !process.env.MONGODB_URI) missing.push('ADMIN_MONGO_URI');

  const checkSecret = (name, val) => {
    if (!val || val.length < 32 || val.includes('_dev_secret_')) {
      missing.push(`${name} (must be at least 32 characters and non-default in production)`);
    }
  };

  checkSecret('STUDENT_JWT_SECRET', process.env.STUDENT_JWT_SECRET || process.env.JWT_SECRET);
  checkSecret('INSTRUCTOR_ACCESS_SECRET', process.env.INSTRUCTOR_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET);
  checkSecret('INSTRUCTOR_REFRESH_SECRET', process.env.INSTRUCTOR_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET);
  checkSecret('ADMIN_JWT_SECRET', process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);

  if (missing.length > 0) {
    throw new Error(`[FATAL] Production security configuration error:\n - ${missing.join('\n - ')}`);
  }
}

module.exports = env;
