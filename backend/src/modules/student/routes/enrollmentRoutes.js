const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/enrollmentController');

router.get('/', protect, ctrl.myEnrollments);
router.get('/my', protect, ctrl.myEnrollments);

module.exports = router;
