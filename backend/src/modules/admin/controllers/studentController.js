const bcrypt = require('bcrypt');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');

// Authoritative Student Models (egsa_academy database namespace)
const StudentUser = require('../../student/models/User');
const StudentProfile = require('../../student/models/StudentProfile');
const StudentApplication = require('../../student/models/Application');
const StudentEnrollment = require('../../student/models/Enrollment');
const StudentInvoice = require('../../student/models/Invoice');
const StudentEvaluation = require('../../student/models/Evaluation');
const StudentCertificate = require('../../student/models/Certificate');
const StudentAttendance = require('../../student/models/AttendanceRecord');
const StudentNotification = require('../../student/models/Notification');

// Admin Platform Models (esa_academy database namespace - for audit, feedback, and fallback compatibility)
const AdminStudentProfile = require('../models/StudentProfile');
const AdminUser = require('../models/User');
const PaymentTransaction = require('../models/PaymentTransaction');
const { Feedback } = require('../models/Feedback');

const { generateStudentReportPdfBuffer } = require('../utils/studentReportPdfGenerator');
const { recordAudit } = require('../services/auditService');
const { ROLES } = require('../constants/roles');
const { ROLE_TO_DIVISION, DIVISIONS } = require('../constants/divisions');

const SALT_ROUNDS = 12;

/**
 * Normalizes a student profile and populated user for Admin UI consumers.
 */
function normalizeStudentObject(profileDoc) {
  if (!profileDoc) return null;
  const s = profileDoc.toObject ? profileDoc.toObject() : { ...profileDoc };
  const u = s.user || {};

  const division = s.division || u.division || 'UNIVERSITY';
  const institution =
    s.institution ||
    s.university ||
    s.academicInfo?.institutionName ||
    (division === 'PRE_UNIVERSITY' ? 'STEM Space Academy' : 'Egyptian Space Academy Candidate');

  const academicYear = s.academicYear || s.academicInfo?.studyYear || '—';
  const major = s.major || s.department || s.faculty || s.academicInfo?.department || '—';
  const isActive = u.isActive !== undefined ? u.isActive : (s.isActive ?? true);

  return {
    ...s,
    division,
    institution,
    academicYear,
    major,
    isActive,
    user: {
      _id: u._id || s.user,
      id: u._id || s.user,
      fullName: u.fullName || 'Academy Student',
      email: u.email || '',
      phone: u.phone || s.phone || '',
      nationalId: u.nationalId || s.nationalId || '',
      role: u.role || 'student',
      division,
      isActive,
      accountStatus: u.accountStatus || (isActive ? 'active' : 'disabled'),
      createdAt: u.createdAt || s.createdAt,
      lastLoginAt: u.lastLoginAt,
    },
  };
}

// GET /api/admin/students
// Division filtering is strictly enforced: division admins are locked to their division,
// and Super Admins can filter by ?division=PRE_UNIVERSITY|UNIVERSITY|all.
const listStudents = asyncHandler(async (req, res) => {
  const { search = '', isActive, status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision) {
      throw ApiError.forbidden('This administrative account has no assigned division');
    }
    filter.division = adminDivision;
  } else if (req.scopeDivision && req.scopeDivision !== 'all') {
    filter.division = req.scopeDivision;
  }

  // Parse isActive filter
  let activeFilter = undefined;
  if (isActive !== undefined && isActive !== '') {
    activeFilter = isActive === 'true' || isActive === true;
  } else if (status !== undefined && status !== '') {
    if (status === 'ACTIVE' || status === 'true') activeFilter = true;
    else if (status === 'INACTIVE' || status === 'false' || status === 'DEACTIVATED') activeFilter = false;
  }

  // Ensure all registered student users have an authoritative profile in egsa_academy
  const unprofiledStudents = await StudentUser.find({ role: 'student' }).select(
    '_id fullName email division isActive phone nationalId university faculty'
  );
  const existingProfiles = await StudentProfile.find({}).select('user').lean();
  const profiledUserIds = new Set(existingProfiles.map((p) => p.user?.toString()));

  for (const stdUser of unprofiledStudents) {
    if (!profiledUserIds.has(stdUser._id.toString())) {
      const defaultDiv = stdUser.division || 'UNIVERSITY';
      await StudentProfile.create({
        user: stdUser._id,
        division: defaultDiv,
        status: 'student',
        university: stdUser.university || (defaultDiv === 'PRE_UNIVERSITY' ? 'STEM Space Academy' : 'Egyptian Space Academy Candidate'),
        institution: stdUser.university || (defaultDiv === 'PRE_UNIVERSITY' ? 'STEM Space Academy' : 'Egyptian Space Academy Candidate'),
        faculty: stdUser.faculty || 'General Engineering',
        phone: stdUser.phone || '',
        nationalId: stdUser.nationalId || '',
        profileCompleted: false,
      });
      profiledUserIds.add(stdUser._id.toString());
    }
  }

  // Build search & active criteria
  if (activeFilter !== undefined || search) {
    const userCriteria = { role: 'student' };
    if (activeFilter !== undefined) {
      userCriteria.isActive = activeFilter;
    }
    if (search) {
      userCriteria.$or = [
        { fullName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { nationalId: new RegExp(search, 'i') },
        { registrationNumber: new RegExp(search, 'i') },
      ];
    }

    const matchingUsers = await StudentUser.find(userCriteria).select('_id');
    const matchingUserIds = matchingUsers.map((u) => u._id);

    if (search) {
      // Also match by institution, university, faculty, or department in profile
      const matchingProfiles = await StudentProfile.find({
        $or: [
          { institution: new RegExp(search, 'i') },
          { university: new RegExp(search, 'i') },
          { faculty: new RegExp(search, 'i') },
          { department: new RegExp(search, 'i') },
        ],
      }).select('user');

      const extraUserIds = matchingProfiles.map((p) => p.user).filter(Boolean);
      const combined = Array.from(
        new Set([
          ...matchingUserIds.map((id) => id.toString()),
          ...extraUserIds.map((id) => id.toString()),
        ])
      );
      filter.user = { $in: combined };
    } else {
      filter.user = { $in: matchingUserIds };
    }
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const total = await StudentProfile.countDocuments(filter);
  const profiles = await StudentProfile.find(filter)
    .populate('user', 'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  const studentsWithStatus = profiles
    .filter((p) => p.user) // Ensure associated user exists
    .map(normalizeStudentObject);

  sendSuccess(
    res,
    200,
    { students: studentsWithStatus },
    {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    }
  );
});

// GET /api/admin/students/:id
const getStudentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let student = await StudentProfile.findById(id).populate(
    'user',
    'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
  );

  // Fallback: in case id was a User id in StudentUser
  if (!student) {
    student = await StudentProfile.findOne({ user: id }).populate(
      'user',
      'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
    );
  }

  // Fallback: check if id exists in StudentUser directly
  if (!student) {
    const directUser = await StudentUser.findById(id);
    if (directUser) {
      student = await StudentProfile.findOneAndUpdate(
        { user: directUser._id },
        {
          $setOnInsert: {
            user: directUser._id,
            division: directUser.division || 'UNIVERSITY',
            university: 'Egyptian Space Academy Candidate',
            institution: 'Egyptian Space Academy Candidate',
          },
        },
        { upsert: true, new: true }
      ).populate('user', 'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber');
    }
  }

  // Fallback: check AdminStudentProfile in esa_academy for legacy mock ID compatibility
  if (!student) {
    student = await AdminStudentProfile.findById(id).populate(
      'user',
      'fullName email isActive createdAt lastLoginAt role division'
    );
    if (!student) {
      student = await AdminStudentProfile.findOne({ user: id }).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division'
      );
    }
  }

  if (!student) throw ApiError.notFound('Student not found');

  const studentDivision = student.division || student.user?.division || 'UNIVERSITY';
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision || studentDivision !== adminDivision) {
      throw ApiError.forbidden('You cannot access a student outside your division');
    }
  }

  const studentObj = normalizeStudentObject(student);
  sendSuccess(res, 200, { student: studentObj });
});

// PATCH /api/admin/students/:id/status
const updateStudentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;

  if (typeof isActive !== 'boolean') {
    throw ApiError.badRequest('isActive field is required and must be a boolean');
  }

  let student = await StudentProfile.findById(id).populate('user');
  if (!student) {
    student = await StudentProfile.findOne({ user: id }).populate('user');
  }

  let isAuthoritative = Boolean(student);

  // Fallback to AdminStudentProfile
  if (!student) {
    student = await AdminStudentProfile.findById(id).populate('user');
    if (!student) {
      student = await AdminStudentProfile.findOne({ user: id }).populate('user');
    }
  }

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  const studentDivision = student.division || student.user?.division || 'UNIVERSITY';
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision || studentDivision !== adminDivision) {
      throw ApiError.forbidden('You cannot modify a student outside your division');
    }
  }

  let user = null;
  if (isAuthoritative) {
    user = await StudentUser.findById(student.user._id || student.user);
    if (user) {
      user.isActive = isActive;
      user.accountStatus = isActive ? 'active' : 'disabled';
      await user.save();
    }
    // Also mirror to AdminUser if exists
    if (user?.email) {
      await AdminUser.updateOne({ email: user.email }, { $set: { isActive } });
    }
  } else {
    user = await AdminUser.findById(student.user._id || student.user);
    if (user) {
      user.isActive = isActive;
      await user.save();
    }
  }

  if (!user) {
    throw ApiError.notFound('Associated user account not found');
  }

  // Audit log entry in esa_academy
  await recordAudit({
    user: req.user,
    action: isActive ? 'STUDENT_ACTIVATED' : 'STUDENT_DEACTIVATED',
    resource: 'User',
    resourceId: user._id,
    division: studentDivision,
    before: { isActive: !isActive },
    after: { isActive },
    reason:
      reason ||
      `Student status changed to ${isActive ? 'Active' : 'Inactive'} by ${req.user.role} ${req.user.fullName} (${req.user.email})`,
  });

  const updatedStudent = isAuthoritative
    ? await StudentProfile.findById(student._id).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
      )
    : await AdminStudentProfile.findById(student._id).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division'
      );

  const studentObj = normalizeStudentObject(updatedStudent);
  sendSuccess(res, 200, { student: studentObj });
});

// PUT /api/admin/students/:id
const updateStudentAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  // Disallow forbidden security/administrative manipulations
  const forbiddenKeys = ['password', 'passwordHash', 'role', 'permissions', 'jwt', 'isAdmin', 'isSuperAdmin', 'division'];
  for (const key of forbiddenKeys) {
    if (body[key] !== undefined) {
      throw ApiError.badRequest(`Security violation: Cannot modify "${key}" through student profile editing.`);
    }
  }

  let student = await StudentProfile.findById(id).populate('user');
  if (!student) {
    student = await StudentProfile.findOne({ user: id }).populate('user');
  }
  let isAuthoritative = Boolean(student);

  if (!student) {
    student = await AdminStudentProfile.findById(id).populate('user');
    if (!student) {
      student = await AdminStudentProfile.findOne({ user: id }).populate('user');
    }
  }

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  const studentDivision = student.division || student.user?.division || 'UNIVERSITY';
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision || studentDivision !== adminDivision) {
      throw ApiError.forbidden('You cannot modify a student outside your division');
    }
  }

  const UserCollection = isAuthoritative ? StudentUser : AdminUser;
  const user = await UserCollection.findById(student.user._id || student.user);
  if (!user) {
    throw ApiError.notFound('Associated user account not found');
  }

  // Update user fields
  if (body.fullName && body.fullName.trim()) {
    user.fullName = body.fullName.trim();
  }
  if (body.phone && body.phone.trim()) {
    user.phone = body.phone.trim();
  }
  if (body.email && body.email.trim() && body.email.trim().toLowerCase() !== user.email) {
    const newEmail = body.email.trim().toLowerCase();
    const existing = await UserCollection.findOne({ email: newEmail, _id: { $ne: user._id } });
    if (existing) {
      throw ApiError.conflict(`Email "${newEmail}" is already in use by another user account.`);
    }
    user.email = newEmail;
  }
  await user.save();

  // Update profile fields
  if (body.phone !== undefined) student.phone = String(body.phone).trim();
  if (body.institution !== undefined) {
    student.institution = String(body.institution).trim();
    student.university = String(body.institution).trim();
  }
  if (body.educationLevel !== undefined) student.educationLevel = String(body.educationLevel).trim();
  if (body.major !== undefined) {
    student.major = String(body.major).trim();
    student.faculty = String(body.major).trim();
  }
  if (body.academicYear !== undefined) student.academicYear = String(body.academicYear).trim();
  if (body.gpa !== undefined) student.gpa = body.gpa === '' || body.gpa === null ? null : Number(body.gpa);
  if (body.skills !== undefined) {
    student.skills = Array.isArray(body.skills)
      ? body.skills
      : String(body.skills)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  }
  if (body.notes !== undefined) student.notes = String(body.notes).trim();
  if (body.guardianName !== undefined) student.guardianName = String(body.guardianName).trim();
  if (body.guardianPhone !== undefined) student.guardianPhone = String(body.guardianPhone).trim();
  if (body.dateOfBirth !== undefined) student.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  if (body.nationalId !== undefined) {
    student.nationalId = String(body.nationalId).trim();
    user.nationalId = String(body.nationalId).trim();
    await user.save();
  }

  await student.save();

  // Audit log
  await recordAudit({
    user: req.user,
    action: 'STUDENT_UPDATED',
    resource: 'StudentProfile',
    resourceId: student._id,
    division: studentDivision,
    after: {
      user: { fullName: user.fullName, email: user.email },
      profile: { institution: student.institution, phone: student.phone },
    },
    reason: body.reason || `Student profile updated by ${req.user.fullName} (${req.user.role})`,
  });

  const updatedStudent = isAuthoritative
    ? await StudentProfile.findById(student._id).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
      )
    : await AdminStudentProfile.findById(student._id).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division'
      );

  const studentObj = normalizeStudentObject(updatedStudent);
  sendSuccess(res, 200, { student: studentObj, message: 'Student profile updated successfully' });
});

// GET /api/admin/students/:id/overview
const getStudentOverviewAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let student = await StudentProfile.findById(id).populate(
    'user',
    'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
  );
  if (!student) {
    student = await StudentProfile.findOne({ user: id }).populate(
      'user',
      'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
    );
  }

  if (!student) {
    student = await AdminStudentProfile.findById(id).populate(
      'user',
      'fullName email isActive createdAt lastLoginAt role division'
    );
    if (!student) {
      student = await AdminStudentProfile.findOne({ user: id }).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division'
      );
    }
  }

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  const studentDivision = student.division || student.user?.division || 'UNIVERSITY';
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision || studentDivision !== adminDivision) {
      throw ApiError.forbidden('You cannot access student dossier outside your division');
    }
  }

  const userId = student.user?._id || student.user;

  // Concurrently fetch records from egsa_academy (authoritative student module)
  const [
    applications,
    enrollments,
    invoices,
    evaluations,
    certificates,
    attendanceSessions,
    feedbackRecords,
    notifications,
  ] = await Promise.all([
    StudentApplication.find({ student: userId })
      .populate('course', 'title division level price currency deliveryMode')
      .populate('cohort', 'name startDate endDate')
      .sort({ createdAt: -1 }),
    StudentEnrollment.find({ student: userId })
      .populate('course', 'title division level price')
      .populate('cohort', 'name startDate endDate status')
      .sort({ createdAt: -1 }),
    StudentInvoice.find({ student: userId })
      .populate('course', 'title division price')
      .sort({ createdAt: -1 }),
    StudentEvaluation.find({ student: userId })
      .populate('course', 'title division level')
      .populate('cohort', 'name')
      .sort({ createdAt: -1 }),
    StudentCertificate.find({ student: userId })
      .populate('course', 'title division level')
      .populate('cohort', 'name')
      .sort({ issuedAt: -1 }),
    StudentAttendance.find({ student: userId })
      .populate('session')
      .populate('cohort', 'name startDate endDate')
      .sort({ createdAt: -1 })
      .limit(30),
    Feedback.find({ student: userId })
      .populate('program', 'title division')
      .populate('cohort', 'cohortNumber name')
      .sort({ submittedAt: -1 }),
    StudentNotification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(20),
  ]);

  // Format attendance for UI
  const studentAttendance = attendanceSessions.map((rec) => ({
    _id: rec._id,
    cohort: rec.cohort,
    sessionDate: rec.session?.date || rec.createdAt,
    topic: rec.session?.topic || rec.session?.title || 'Academic Training Session',
    sessionNumber: rec.session?.sessionNumber || 1,
    status: rec.status || (rec.present ? 'PRESENT' : 'ABSENT'),
    notes: rec.notes || '',
  }));

  // Normalize application course -> program for admin frontend compatibility
  const normalizedApplications = applications.map((a) => {
    const obj = a.toObject();
    obj.program = obj.course;
    return obj;
  });

  const normalizedEnrollments = enrollments.map((e) => {
    const obj = e.toObject();
    obj.program = obj.course;
    return obj;
  });

  const normalizedInvoices = invoices.map((inv) => {
    const obj = inv.toObject();
    obj.program = obj.course;
    return obj;
  });

  const studentObj = normalizeStudentObject(student);

  sendSuccess(res, 200, {
    student: studentObj,
    applications: normalizedApplications,
    enrollments: normalizedEnrollments,
    invoices: normalizedInvoices,
    transactions: [],
    evaluations,
    certificates,
    attendance: studentAttendance,
    feedback: feedbackRecords,
    notifications,
  });
});

// GET /api/admin/students/:id/report-pdf
const getStudentReportPdfAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let student = await StudentProfile.findById(id).populate(
    'user',
    'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
  );
  if (!student) {
    student = await StudentProfile.findOne({ user: id }).populate(
      'user',
      'fullName email isActive createdAt lastLoginAt role division phone nationalId registrationNumber'
    );
  }

  if (!student) {
    student = await AdminStudentProfile.findById(id).populate(
      'user',
      'fullName email isActive createdAt lastLoginAt role division'
    );
    if (!student) {
      student = await AdminStudentProfile.findOne({ user: id }).populate(
        'user',
        'fullName email isActive createdAt lastLoginAt role division'
      );
    }
  }

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  const studentDivision = student.division || student.user?.division || 'UNIVERSITY';
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision || studentDivision !== adminDivision) {
      throw ApiError.forbidden('You cannot export student report outside your division');
    }
  }

  const userId = student.user?._id || student.user;

  const [applications, enrollments, invoices, evaluations, certificates, feedbackRecords] =
    await Promise.all([
      StudentApplication.find({ student: userId }).populate('course', 'title division level price').sort({ createdAt: -1 }),
      StudentEnrollment.find({ student: userId })
        .populate('course', 'title division level')
        .populate('cohort', 'name startDate endDate status')
        .sort({ createdAt: -1 }),
      StudentInvoice.find({ student: userId }).populate('course', 'title division price').sort({ createdAt: -1 }),
      StudentEvaluation.find({ student: userId })
        .populate('course', 'title division')
        .populate('cohort', 'name')
        .sort({ createdAt: -1 }),
      StudentCertificate.find({ student: userId })
        .populate('course', 'title division')
        .populate('cohort', 'name')
        .sort({ issuedAt: -1 }),
      Feedback.find({ student: userId }).populate('program', 'title').sort({ submittedAt: -1 }),
    ]);

  const normalizedApplications = applications.map((a) => {
    const obj = a.toObject();
    obj.program = obj.course;
    return obj;
  });

  const normalizedEnrollments = enrollments.map((e) => {
    const obj = e.toObject();
    obj.program = obj.course;
    return obj;
  });

  const normalizedInvoices = invoices.map((inv) => {
    const obj = inv.toObject();
    obj.program = obj.course;
    return obj;
  });

  const studentObj = normalizeStudentObject(student);

  const pdfBuffer = await generateStudentReportPdfBuffer({
    student: studentObj,
    applications: normalizedApplications,
    enrollments: normalizedEnrollments,
    invoices: normalizedInvoices,
    evaluations,
    certificates,
    feedback: feedbackRecords,
  });

  await recordAudit({
    user: req.user,
    action: 'REPORT_EXPORTED',
    resource: 'StudentProfile',
    resourceId: student._id,
    division: studentDivision,
    reason: `Official Student Dossier PDF exported for ${student.user?.fullName} by ${req.user.fullName}`,
  });

  const cleanName = (student.user?.fullName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `ESA_Student_Dossier_${cleanName}_${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(pdfBuffer);
});

// POST /api/admin/students (Admin creates student account)
const createStudentAdmin = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    division,
    nationalId,
    dateOfBirth,
    educationLevel,
    institution,
    major,
    phone,
    guardianName,
    guardianPhone,
    emergencyContact,
    academicYear,
  } = req.body;

  if (!fullName || fullName.trim().length < 2) {
    throw ApiError.badRequest('Full Name is required (minimum 2 characters)');
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw ApiError.badRequest('A valid email address is required');
  }
  if (!password || password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  // Determine target division and enforce scope
  let targetDivision = division;
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    const adminDivision = req.scopeDivision || ROLE_TO_DIVISION[req.user.role] || req.user.division;
    if (!adminDivision) {
      throw ApiError.forbidden('This administrative account has no assigned division');
    }
    if (targetDivision && targetDivision !== adminDivision) {
      throw ApiError.forbidden('You cannot provision a student outside your division');
    }
    targetDivision = adminDivision;
  } else {
    if (!targetDivision) {
      targetDivision = req.scopeDivision && req.scopeDivision !== 'all' ? req.scopeDivision : DIVISIONS.PRE_UNIVERSITY;
    }
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await StudentUser.findOne({ email: normalizedEmail });
  if (existing) {
    throw ApiError.conflict('An account with this email address already exists');
  }

  const normalizedNationalId = nationalId ? nationalId.trim() : `2${Date.now().toString().slice(-13)}`;
  const instName =
    (institution || '').trim() ||
    (targetDivision === 'PRE_UNIVERSITY' ? 'STEM Space Academy' : 'Egyptian Space Academy Candidate');

  // Create authoritative Student user in egsa_academy
  const user = await StudentUser.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    password,
    phone: (phone || '01000000000').trim(),
    nationalId: normalizedNationalId,
    role: 'student',
    division: targetDivision,
    accountStatus: 'active',
    isEmailVerified: true,
    isActive: true,
  });

  const studentProfile = await StudentProfile.create({
    user: user._id,
    division: targetDivision,
    status: 'student',
    university: instName,
    institution: instName,
    faculty: (major || 'Aerospace Engineering').trim(),
    major: (major || 'Aerospace Engineering').trim(),
    educationLevel: (educationLevel || '').trim(),
    academicYear: (academicYear || '').trim(),
    phone: (phone || '').trim(),
    nationalId: normalizedNationalId,
    guardianName: (guardianName || '').trim(),
    guardianPhone: (guardianPhone || '').trim(),
    emergencyContact: (emergencyContact || '').trim(),
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    profileCompleted: false,
  });

  // Mirror to Admin DB (esa_academy) and Instructor StudentReference
  try {
    const { syncStudentRegistration } = require('../../integration/unifiedSyncService');
    if (typeof syncStudentRegistration === 'function') {
      await syncStudentRegistration({ user, division: targetDivision, profile: studentProfile });
    }
  } catch (syncErr) {
    console.warn('[ADMIN PROVISION SYNC NOTICE]', syncErr.message);
  }

  await recordAudit({
    user: req.user,
    action: 'STUDENT_CREATED',
    resource: 'StudentProfile',
    resourceId: studentProfile._id,
    division: targetDivision,
    after: {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      division: targetDivision,
      profileId: studentProfile._id,
    },
    reason: `Student account provisioned by ${req.user.role} ${req.user.fullName} (${req.user.email})`,
  });

  sendSuccess(res, 201, {
    student: {
      _id: studentProfile._id,
      division: studentProfile.division,
      nationalId: studentProfile.nationalId,
      educationLevel: studentProfile.educationLevel,
      institution: studentProfile.institution,
      major: studentProfile.major,
      phone: studentProfile.phone,
      user: user.toSafeObject(),
      createdAt: studentProfile.createdAt,
    },
  });
});

// GET /api/student/mine/profile (Student self-service)
const getMyStudentProfile = asyncHandler(async (req, res) => {
  let profile = await StudentProfile.findOne({ user: req.user._id }).populate(
    'user',
    'fullName email division isActive createdAt'
  );

  if (!profile) {
    profile = await StudentProfile.create({
      user: req.user._id,
      division: req.user.division || DIVISIONS.PRE_UNIVERSITY,
      university: 'Egyptian Space Academy Candidate',
      institution: 'Egyptian Space Academy Candidate',
      faculty: 'General Engineering',
      status: 'student',
    });
    profile = await StudentProfile.findById(profile._id).populate(
      'user',
      'fullName email division isActive createdAt'
    );
  }

  sendSuccess(res, 200, { profile });
});

// PUT /api/student/mine/profile (Student self-service update)
const updateMyStudentProfile = asyncHandler(async (req, res) => {
  const {
    fullName,
    phone,
    dateOfBirth,
    nationalId,
    institution,
    educationLevel,
    major,
    guardianName,
    guardianPhone,
    emergencyContact,
    academicYear,
    skills,
  } = req.body;

  let profile = await StudentProfile.findOne({ user: req.user._id });
  if (!profile) {
    profile = await StudentProfile.create({
      user: req.user._id,
      division: req.user.division || DIVISIONS.PRE_UNIVERSITY,
      university: institution || 'Egyptian Space Academy Candidate',
      institution: institution || 'Egyptian Space Academy Candidate',
      faculty: major || 'General Engineering',
      status: 'student',
    });
  }

  if (fullName && fullName.trim().length >= 2) {
    const user = await StudentUser.findById(req.user._id);
    if (user) {
      user.fullName = fullName.trim();
      await user.save();
    }
  }

  if (phone !== undefined) profile.phone = phone.trim();
  if (dateOfBirth !== undefined && dateOfBirth) profile.dateOfBirth = new Date(dateOfBirth);
  if (nationalId !== undefined) profile.nationalId = nationalId.trim();
  if (institution !== undefined) {
    profile.institution = institution.trim();
    profile.university = institution.trim();
  }
  if (educationLevel !== undefined) profile.educationLevel = educationLevel.trim();
  if (major !== undefined) {
    profile.major = major.trim();
    profile.faculty = major.trim();
  }
  if (guardianName !== undefined) profile.guardianName = guardianName.trim();
  if (guardianPhone !== undefined) profile.guardianPhone = guardianPhone.trim();
  if (emergencyContact !== undefined) profile.emergencyContact = emergencyContact.trim();
  if (academicYear !== undefined) profile.academicYear = academicYear.trim();
  if (Array.isArray(skills)) profile.skills = skills;

  await profile.save();

  const updated = await StudentProfile.findById(profile._id).populate(
    'user',
    'fullName email division isActive createdAt'
  );

  sendSuccess(res, 200, { profile: updated });
});

module.exports = {
  listStudents,
  getStudentById,
  updateStudentStatus,
  updateStudentAdmin,
  getStudentOverviewAdmin,
  getStudentReportPdfAdmin,
  createStudentAdmin,
  getMyStudentProfile,
  updateMyStudentProfile,
};
