const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createApplicationValidator } = require('../validators/cycleValidators');
const { applicationDocumentUpload } = require('../middleware/applicationDocumentUpload');
const ctrl = require('../controllers/applicationController');

const uploadDocMiddleware = [
  applicationDocumentUpload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  (req, res, next) => {
    if (req.files) {
      req.file = req.files.document?.[0] || req.files.file?.[0] || null;
    }
    next();
  },
];

router.post('/', protect, validate(createApplicationValidator), ctrl.createApplication);
router.get('/my', protect, ctrl.myApplications);
router.get('/:id', protect, ctrl.getApplication);
router.post('/:id/document', protect, uploadDocMiddleware, ctrl.uploadApplicationDocument);
router.get('/:id/document', protect, ctrl.streamApplicationDocument);
router.post('/:id/direct-enroll', protect, ctrl.directEnrollApplication);
router.patch('/:id/cancel', protect, ctrl.cancelApplication);

module.exports = router;
