const router = require('express').Router();
const { getInstructorConn } = require('../../../config/database');

router.get('/health', (_q, res) => {
  const conn = getInstructorConn();
  const isDbReady = conn.readyState === 1;
  const status = isDbReady ? 200 : 503;
  return res.status(status).json({
    success: isDbReady,
    data: {
      status: isDbReady ? 'ok' : 'degraded',
      service: 'egsa-instructor-api',
      database: {
        connected: isDbReady,
        name: conn.name || 'egsa_instructor',
      },
      time: new Date().toISOString(),
    },
  });
});
router.use('/auth', require('./auth.routes'));
router.use('/instructor', require('./instructor.routes'));
router.use('/integration', require('./integration.routes'));
module.exports = router;
