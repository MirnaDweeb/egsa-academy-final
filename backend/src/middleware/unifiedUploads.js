const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getStudentConn } = require('../config/database');
const env = require('../config/env');

// Search directories in priority order: unified backend/uploads first, then original backends
const SEARCH_DIRS = [
  path.resolve(__dirname, '../../uploads'),
  path.resolve('D:/egsa_academy/EGSA-student/Back_End/uploads'),
  path.resolve('D:/egsa_academy/egsa-instructor-v2/backend/uploads')
];

// Helper to authenticate request using Student or Admin JWT
async function authenticateRequest(req) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;

  try {
    // Try student token first
    const secret = env.jwt.studentSecret;
    const decoded = jwt.verify(token, secret);
    if (decoded && decoded.id) {
      const studentConn = getStudentConn();
      const User = studentConn.models.User;
      if (User) {
        const user = await User.findById(decoded.id).select('-password');
        if (user) return { user, role: user.role };
      }
    }
  } catch (_) {
    // Fallback try admin or instructor secret
    try {
      const decodedAdmin = jwt.verify(token, env.jwt.adminSecret);
      if (decodedAdmin) return { user: decodedAdmin, role: decodedAdmin.role || 'admin' };
    } catch (_) {
      try {
        const decodedInst = jwt.verify(token, env.jwt.instructorAccessSecret);
        if (decodedInst) return { user: decodedInst, role: decodedInst.role || 'instructor' };
      } catch (_) {}
    }
  }
  return null;
}

function findFileOnDisk(segments) {
  // Reject any segment attempting directory traversal
  for (const seg of segments) {
    if (seg === '..' || seg === '.' || seg.includes('..') || seg.includes('/') || seg.includes('\\')) {
      return null;
    }
  }

  for (const baseDir of SEARCH_DIRS) {
    const resolvedBase = path.resolve(baseDir);
    const candidate = path.resolve(baseDir, ...segments);
    
    // Strict directory containment check
    if (!candidate.startsWith(resolvedBase)) {
      continue;
    }

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

async function unifiedUploadsHandler(req, res, next) {
  try {
    const rawUrl = req.url || '';
    const rawPath = req.path || '';

    // 1. Strict Path Traversal Detection (encoded or raw)
    if (
      /(\.\.|\%2e\%2e|\%252e|\%00|\0)/i.test(rawUrl) ||
      /(\.\.|\%2e\%2e|\%252e|\%00|\0)/i.test(rawPath)
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden: Path traversal attempt detected.' });
    }

    const normalizedPath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '');
    const segments = normalizedPath.split(/[\\/]/).filter(Boolean);

    if (segments.length === 0 || segments.some(s => s === '..' || s === '.')) {
      return res.status(403).json({ success: false, message: 'Forbidden directory access.' });
    }

    const category = segments[0].toLowerCase();
    const filename = segments[segments.length - 1];
    const fullDiskPath = findFileOnDisk(segments);

    if (!fullDiskPath) {
      return res.status(404).json({ success: false, message: 'Requested file not found on server.' });
    }

    // 2. Public Institutional Media: Courses, Thumbnails, Banners, Avatars
    const PUBLIC_CATEGORIES = ['media', 'avatars', 'courses', 'thumbnails'];
    if (PUBLIC_CATEGORIES.includes(category)) {
      return res.sendFile(fullDiskPath);
    }

    // 3. Official Certificates: Public only with valid verificationToken; otherwise authenticated
    if (category === 'certificates') {
      const studentConn = getStudentConn();
      const Certificate = studentConn.models.Certificate;
      const certDoc = Certificate ? await Certificate.findOne({ fileUrl: { $regex: filename } }) : null;

      const reqToken = req.query && (req.query.verifyToken || req.query.token);
      if (certDoc && reqToken && certDoc.verificationToken === reqToken && certDoc.status === 'Issued') {
        return res.sendFile(fullDiskPath);
      }

      const auth = await authenticateRequest(req);
      if (!auth) {
        return res.status(401).json({ success: false, message: 'Authentication required to view official certificate records.' });
      }

      const role = String(auth.role || '').toLowerCase();
      const isSuperAdmin = ['admin', 'superadmin', 'super_admin'].includes(role);
      const isInstructor = role === 'instructor';
      const isOwner = certDoc && String(certDoc.student) === String(auth.user._id || auth.user.id);

      // Division Admin isolation check
      if (role === 'pre_university_admin') {
        if (certDoc && certDoc.division && certDoc.division !== 'PRE_UNIVERSITY') {
          return res.status(403).json({ success: false, message: 'Access denied: certificate belongs to another division.' });
        }
        return res.sendFile(fullDiskPath);
      }

      if (role === 'university_admin') {
        if (certDoc && certDoc.division && certDoc.division !== 'UNIVERSITY') {
          return res.status(403).json({ success: false, message: 'Access denied: certificate belongs to another division.' });
        }
        return res.sendFile(fullDiskPath);
      }

      if (isSuperAdmin || isInstructor || isOwner) {
        return res.sendFile(fullDiskPath);
      }

      return res.status(403).json({ success: false, message: 'Access denied: unauthorized certificate access.' });
    }

    // 4. Assessments & Assignments: Academic submissions protected
    if (['assessments', 'assignments'].includes(category)) {
      const auth = await authenticateRequest(req);
      if (!auth) {
        return res.status(401).json({ success: false, message: 'Authentication required to access academic materials.' });
      }

      const role = String(auth.role || '').toLowerCase();
      const isStaff = ['admin', 'superadmin', 'super_admin', 'pre_university_admin', 'university_admin', 'instructor'].includes(role);
      if (isStaff) {
        return res.sendFile(fullDiskPath);
      }

      const studentId = String(auth.user._id || auth.user.id);
      const studentConn = getStudentConn();

      // Check if student owns this submission file
      const StudentSubmission = studentConn.models.StudentSubmission;
      if (StudentSubmission) {
        const submission = await StudentSubmission.findOne({
          $or: [
            { 'file.fileName': filename },
            { 'file.fileUrl': { $regex: filename } },
            { 'history.file.fileName': filename },
          ],
        });
        if (submission && String(submission.student) === studentId) {
          return res.sendFile(fullDiskPath);
        }
      }

      // Check if file is an attachment of an assessment for which student is enrolled
      const Assessment = studentConn.models.Assessment;
      if (Assessment) {
        const assessment = await Assessment.findOne({
          $or: [
            { 'attachments.fileName': filename },
            { 'attachments.originalName': filename },
            { 'attachments.fileUrl': { $regex: filename } },
          ],
        });
        if (assessment) {
          const Enrollment = studentConn.models.Enrollment;
          if (Enrollment) {
            const isEnrolled = await Enrollment.findOne({
              student: studentId,
              $or: [{ cohort: assessment.cohort }, { course: assessment.course }],
              status: { $in: ['Active', 'Confirmed', 'Completed'] },
            });
            if (isEnrolled) {
              return res.sendFile(fullDiskPath);
            }
          }
        }
      }

      // Also check instructor database assessment attachments
      try {
        const { getInstructorConn } = require('../config/database');
        const instConn = getInstructorConn();
        const InstAssessment = instConn.models.Assessment;
        if (InstAssessment) {
          const instAssess = await InstAssessment.findOne({
            $or: [
              { 'attachments.name': filename },
              { 'attachments.url': { $regex: filename } },
            ],
          });
          if (instAssess) {
            const Enrollment = studentConn.models.Enrollment;
            const isEnrolled = await Enrollment.findOne({
              student: studentId,
              status: { $in: ['Active', 'Confirmed', 'Completed'] },
            });
            if (isEnrolled) {
              return res.sendFile(fullDiskPath);
            }
          }
        }
      } catch (_) {}

      return res.status(403).json({ success: false, message: 'Access denied to this academic assessment file.' });
    }

    // 5. Payment Receipts and Proofs: Protected to Owner and Financial Staff
    if (['payment_proofs', 'receipts', 'payments'].includes(category)) {
      const auth = await authenticateRequest(req);
      if (!auth) {
        return res.status(401).json({ success: false, message: 'Authentication required to access financial proof files.' });
      }

      const role = String(auth.role || '').toLowerCase();
      const isStaff = ['admin', 'superadmin', 'super_admin', 'pre_university_admin', 'university_admin'].includes(role);
      if (isStaff) {
        return res.sendFile(fullDiskPath);
      }

      const studentConn = getStudentConn();
      const PaymentProof = studentConn.models.PaymentProof;
      if (PaymentProof) {
        const proof = await PaymentProof.findOne({
          $or: [
            { 'proofFile.filename': filename },
            { 'proofFile.path': { $regex: filename } }
          ]
        });
        if (proof && String(proof.student) === String(auth.user._id || auth.user.id)) {
          return res.sendFile(fullDiskPath);
        }
      }

      return res.status(403).json({ success: false, message: 'Access denied to this payment proof record.' });
    }

    // 6. Default for all other private categories: Requires authenticated staff or owner
    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const role = String(auth.role || '').toLowerCase();
    if (['admin', 'superadmin', 'super_admin', 'pre_university_admin', 'university_admin', 'instructor'].includes(role)) {
      return res.sendFile(fullDiskPath);
    }

    return res.status(403).json({ success: false, message: 'Access denied.' });
  } catch (err) {
    next(err);
  }
}

module.exports = unifiedUploadsHandler;
