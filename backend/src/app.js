const express = require('express');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const { corsMiddleware, helmetMiddleware, generalLimiter } = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/error');
const { getStudentConn, getInstructorConn, getAdminConn } = require('./config/database');

const app = express();

// Security and monitoring middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);

if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

// Protected & Static uploads serving across unified and legacy assets
const unifiedUploadsHandler = require('./middleware/unifiedUploads');
app.use('/uploads', unifiedUploadsHandler);

// Health check endpoint verifying all three database connections
app.get('/health', (req, res) => {
  const sConn = getStudentConn();
  const iConn = getInstructorConn();
  const aConn = getAdminConn();

  const dbStatus = {
    student: sConn.readyState === 1 ? 'connected' : 'connecting',
    instructor: iConn.readyState === 1 ? 'connected' : 'connecting',
    admin: aConn.readyState === 1 ? 'connected' : 'connecting',
  };

  const isHealthy = Object.values(dbStatus).every((s) => s === 'connected');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'egsa-unified-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    databases: dbStatus,
    apiPrefixes: {
      student: '/api',
      instructor: '/api/v1',
      admin: '/admin-api',
    },
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'EGSA Space Academy Unified API Gateway',
    version: '1.0.0',
    endpoints: {
      student: '/api',
      instructor: '/api/v1',
      admin: '/admin-api',
      health: '/health',
    },
  });
});

const instructorRouter = require('./modules/instructor');
app.use('/api/v1', instructorRouter);

const studentRouter = require('./modules/student');
app.use('/api', studentRouter);

const adminRouter = require('./modules/admin');
app.use('/admin-api', adminRouter);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
