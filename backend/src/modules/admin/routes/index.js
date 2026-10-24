const express = require('express');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const programRoutes = require('./programRoutes');
const studentRoutes = require('./studentRoutes');
const applicationRoutes = require('./applicationRoutes');
const paymentRoutes = require('./paymentRoutes');
const instructorRoutes = require('./instructorRoutes');
const certificatePublicRoutes = require('./certificatePublicRoutes');
const notificationRoutes = require('./notificationRoutes');
const studentAssessmentRoutes = require('./studentAssessmentRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/programs', programRoutes);
router.use('/students', studentRoutes);
router.use('/student/assessments', studentAssessmentRoutes);
router.use('/assessments', studentAssessmentRoutes);
router.use('/student', studentRoutes);
router.use('/applications', applicationRoutes);
router.use('/payments', paymentRoutes);
router.use('/instructor', instructorRoutes);
router.use('/certificates', certificatePublicRoutes);
router.use('/notifications', notificationRoutes);


const { getAdminConn } = require('../../../config/database');
router.get('/health', (req, res) => {
  const conn = getAdminConn();
  const isDbReady = conn.readyState === 1;
  const status = isDbReady ? 200 : 503;
  return res.status(status).json({
    success: isDbReady,
    data: {
      status: isDbReady ? 'ok' : 'degraded',
      service: 'esa-platform-admin-api',
      database: {
        connected: isDbReady,
        name: conn.name || 'esa_academy',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
