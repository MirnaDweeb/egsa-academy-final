const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or allowed frontend origins
    if (!origin || env.clientUrls.includes(origin) || !env.isProduction) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With'],
});

const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 10000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 10000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many authentication attempts. Please try again later.' } },
});

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  generalLimiter,
  authLimiter,
};
