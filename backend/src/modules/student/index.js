const express = require('express');
const { protect } = require('./middleware/auth');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const goalRoutes = require('./routes/goalRoutes');
const learningPathRoutes = require('./routes/learningPathRoutes');
const courseRoutes = require('./routes/courseRoutes');
const readinessRoutes = require('./routes/readinessRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const bundleRoutes = require('./routes/bundleRoutes');
const adminRoutes = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const messagingRoutes = require('./routes/messagingRoutes');
const dashboardController = require('./controllers/dashboardController');
const { getStudentConn } = require('../../config/database');

const router = express.Router();

// Health check for student database
router.get(['/health', '/v1/health'], (req, res) => {
  const conn = getStudentConn();
  const isReady = conn.readyState === 1;
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    status: isReady ? 'UP' : 'DEGRADED',
    database: {
      connected: isReady,
      name: conn.name || 'egsa_academy',
    },
    service: 'student-module',
    timestamp: new Date().toISOString(),
  });
});

// Mount student sub-routes
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/goals', goalRoutes);
router.use('/learning-paths', learningPathRoutes);
router.use('/courses', courseRoutes);
router.use('/readiness', readinessRoutes);
router.use('/applications', applicationRoutes);
router.use('/payments', paymentRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/certificates', certificateRoutes);
router.use('/bundles', bundleRoutes);
router.use('/admin', adminRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/media', mediaRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/evaluations', evaluationRoutes);
router.use('/messages', messagingRoutes);
router.get('/dashboard', protect, dashboardController.getDashboard);

module.exports = router;
