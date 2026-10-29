const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/modules/admin/controllers/programController.js');

const updatedContent = `const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const Course = require('../models/Course');
const User = require('../models/User');
const InstructorProfile = require('../models/InstructorProfile');
const AuditLog = require('../models/AuditLog');
const Application = require('../models/Application');
const Cohort = require('../models/Cohort');
const Enrollment = require('../models/Enrollment');
const Invoice = require('../models/Invoice');
const Certificate = require('../models/Certificate');
const {
  validateProgramInput,
  validateProgramStatusTransition,
} = require('../validators/programValidators');
const { recordAudit } = require('../services/auditService');
const { ROLES } = require('../constants/roles');
const { PROGRAM_STATUS } = require('../constants/statuses');

/**
 * Validates that an instructor exists, is active, has instructor role,
 * and matches the course's division and caller scope.
 */
async function validateInstructorAssignment(instructorId, courseDivision, user) {
  if (!instructorId) return null;
  const idStr = (instructorId?._id || instructorId?.id || instructorId).toString();
  if (!mongoose.Types.ObjectId.isValid(idStr)) {
    throw ApiError.badRequest('Invalid instructor ID format');
  }
  const instructor = await User.findById(idStr);
  if (!instructor) {
    throw ApiError.notFound('Instructor not found');
  }
  if (instructor.role !== ROLES.INSTRUCTOR) {
    throw ApiError.badRequest('Selected user does not have instructor credentials');
  }
  if (instructor.isActive === false) {
    throw ApiError.badRequest('Selected instructor is deactivated and cannot be assigned to courses');
  }

  // Division scoping check
  if (user.role !== ROLES.SUPER_ADMIN && user.scopeDivision && user.scopeDivision !== 'all') {
    if (instructor.division !== user.scopeDivision) {
      throw ApiError.forbidden('You cannot assign an instructor from outside your authorized division');
    }
  }

  if (courseDivision && instructor.division && instructor.division !== courseDivision) {
    const profile = await InstructorProfile.findOne({ user: instructor._id });
    const allowedDivisions = profile?.divisions || [instructor.division];
    if (!allowedDivisions.includes(courseDivision)) {
      throw ApiError.badRequest(\`Instructor is registered for \${instructor.division} and cannot be assigned to \${courseDivision}\`);
    }
  }
  return instructor;
}

// POST /api/programs
const createProgram = asyncHandler(async (req, res) => {
  validateProgramInput(req.body);
  const {
    title,
    description = '',
    division,
    level,
    targetAudience = '',
    price = 0,
    capacity,
    deliveryMode,
    status = PROGRAM_STATUS.DRAFT,
    category = '',
    transportationOption = 'NONE',
    registrationStartDate,
    registrationEndDate,
    startDate,
    endDate,
    reopeningDate,
    assignedInstructor,
    assignedInstructors = [],
    prerequisites = [],
    requiredEducation = '',
    targetMajors = [],
  } = req.body;

  // A division admin may only create programs inside their own division.
  if (req.user.role !== ROLES.SUPER_ADMIN && division !== req.scopeDivision) {
    throw ApiError.forbidden('You cannot create a program outside your division');
  }

  // Validate instructor if provided
  const targetInstId = assignedInstructor || (Array.isArray(assignedInstructors) && assignedInstructors[0]);
  let validatedInstructor = null;
  if (targetInstId) {
    validatedInstructor = await validateInstructorAssignment(targetInstId, division, req.user);
  }

  const program = await Course.create({
    title: title.trim(),
    description: description.trim(),
    division,
    level,
    targetAudience: targetAudience.trim(),
    price: Number(price) || 0,
    capacity: Number(capacity),
    deliveryMode,
    status: status || PROGRAM_STATUS.DRAFT,
    category: category ? category.trim() : '',
    transportationOption: transportationOption || 'NONE',
    registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
    registrationEndDate: registrationEndDate ? new Date(registrationEndDate) : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    reopeningDate: reopeningDate ? new Date(reopeningDate) : undefined,
    assignedInstructor: validatedInstructor ? validatedInstructor._id : null,
    assignedInstructors: validatedInstructor ? [validatedInstructor._id] : (Array.isArray(assignedInstructors) ? assignedInstructors : []),
    prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
    requiredEducation: requiredEducation ? requiredEducation.trim() : '',
    targetMajors: Array.isArray(targetMajors) ? targetMajors : [],
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await recordAudit({
    user: req.user,
    action: 'PROGRAM_CREATED',
    resource: 'Course',
    resourceId: program._id,
    division: program.division,
    before: null,
    after: program.toObject(),
    reason: \`Program created by \${req.user.role} \${req.user.fullName} (\${req.user.email})\`,
  });

  try {
    const { syncProgramFromAdmin } = require('../../integration/unifiedSyncService');
    await syncProgramFromAdmin(program);
  } catch (syncErr) {
    console.warn('[PROGRAM CONTROLLER] syncProgramFromAdmin warning on create:', syncErr.message);
  }

  if (validatedInstructor) {
    try {
      const { syncCourseInstructorAssignment } = require('../../integration/unifiedSyncService');
      await syncCourseInstructorAssignment({
        courseId: program._id,
        instructorId: validatedInstructor._id,
        user: req.user,
      });
    } catch (syncInstErr) {
      console.warn('[PROGRAM CONTROLLER] syncCourseInstructorAssignment warning on create:', syncInstErr.message);
    }
  }

  const populatedProgram = await Course.findById(program._id)
    .populate('assignedInstructors', 'fullName email division isActive')
    .populate('assignedInstructor', 'fullName email division isActive')
    .populate('createdBy', 'fullName email role')
    .populate('updatedBy', 'fullName email role');

  sendSuccess(res, 201, { program: populatedProgram });
});

// GET /api/programs
const listPrograms = asyncHandler(async (req, res) => {
  const { status, search = '', division, instructorId, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === ROLES.SUPER_ADMIN) {
    if (division && division !== 'all') {
      filter.division = division;
    }
  } else if (req.scopeDivision && req.scopeDivision !== 'all') {
    filter.division = req.scopeDivision;
  }

  if (status) {
    filter.status = status;
  }

  if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) {
    filter.$or = [
      { assignedInstructor: instructorId },
      { assignedInstructors: instructorId },
    ];
  }

  if (search && search.trim()) {
    const searchRegex = { $regex: search.trim(), $options: 'i' };
    const searchConditions = [
      { title: searchRegex },
      { description: searchRegex },
      { targetAudience: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const total = await Course.countDocuments(filter);
  const programs = await Course.find(filter)
    .populate('assignedInstructors', 'fullName email division isActive')
    .populate('assignedInstructor', 'fullName email division isActive')
    .populate('createdBy', 'fullName email role')
    .populate('updatedBy', 'fullName email role')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  // Compute actual enrolled count from canonical Enrollment records
  const programIds = programs.map((p) => p._id);
  const counts = await Enrollment.aggregate([
    { $match: { program: { $in: programIds }, status: { $in: ['CONFIRMED', 'ACTIVE'] } } },
    { $group: { _id: '$program', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach((c) => {
    countMap[c._id.toString()] = c.count;
  });

  const enrichedPrograms = programs.map((p) => {
    const obj = p.toObject();
    obj.enrolledCount = countMap[p._id.toString()] !== undefined ? countMap[p._id.toString()] : (obj.occupiedSeats || 0);
    return obj;
  });

  sendSuccess(
    res,
    200,
    { programs: enrichedPrograms },
    {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    }
  );
});

// GET /api/programs/:id
const getProgramById = asyncHandler(async (req, res) => {
  const program = await Course.findById(req.params.id)
    .populate('assignedInstructors', 'fullName email division isActive')
    .populate('assignedInstructor', 'fullName email division isActive')
    .populate('createdBy', 'fullName email role')
    .populate('updatedBy', 'fullName email role');

  if (!program) {
    throw ApiError.notFound('Program not found');
  }

  // Scoping check for division admins
  if (req.user.role !== ROLES.SUPER_ADMIN && req.scopeDivision && req.scopeDivision !== 'all') {
    if (program.division !== req.scopeDivision) {
      throw ApiError.forbidden('You cannot access a program outside your division');
    }
  }

  const [auditLogs, enrolledCount] = await Promise.all([
    AuditLog.find({ resource: 'Course', resourceId: program._id })
      .sort({ timestamp: -1 })
      .populate('user', 'fullName email role'),
    Enrollment.countDocuments({
      program: program._id,
      status: { $in: ['CONFIRMED', 'ACTIVE'] },
    }),
  ]);

  const obj = program.toObject();
  obj.enrolledCount = enrolledCount;

  sendSuccess(res, 200, { program: obj, auditLogs });
});

// PUT /api/programs/:id
const updateProgram = asyncHandler(async (req, res) => {
  validateProgramInput(req.body, { partial: true });
  const program = await Course.findById(req.params.id);
  if (!program) {
    throw ApiError.notFound('Program not found');
  }

  if (req.user.role !== ROLES.SUPER_ADMIN && program.division !== req.scopeDivision) {
    throw ApiError.forbidden('You cannot modify a program outside your division');
  }

  const before = program.toObject();

  if (req.body.title !== undefined) program.title = req.body.title.trim();
  if (req.body.description !== undefined) program.description = req.body.description.trim();
  if (req.body.level !== undefined) program.level = req.body.level;
  if (req.body.targetAudience !== undefined) program.targetAudience = req.body.targetAudience.trim();
  if (req.body.price !== undefined) program.price = Number(req.body.price);
  if (req.body.capacity !== undefined) program.capacity = Number(req.body.capacity);
  if (req.body.deliveryMode !== undefined) program.deliveryMode = req.body.deliveryMode;
  if (req.body.category !== undefined) program.category = req.body.category.trim();
  if (req.body.transportationOption !== undefined) program.transportationOption = req.body.transportationOption;
  if (req.body.registrationStartDate !== undefined) program.registrationStartDate = req.body.registrationStartDate ? new Date(req.body.registrationStartDate) : undefined;
  if (req.body.registrationEndDate !== undefined) program.registrationEndDate = req.body.registrationEndDate ? new Date(req.body.registrationEndDate) : undefined;
  if (req.body.startDate !== undefined) program.startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
  if (req.body.endDate !== undefined) program.endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
  if (req.body.reopeningDate !== undefined) program.reopeningDate = req.body.reopeningDate ? new Date(req.body.reopeningDate) : undefined;
  if (Array.isArray(req.body.prerequisites)) program.prerequisites = req.body.prerequisites;
  if (req.body.requiredEducation !== undefined) program.requiredEducation = req.body.requiredEducation.trim();
  if (Array.isArray(req.body.targetMajors)) program.targetMajors = req.body.targetMajors;

  // Handle instructor assignment/change with validation
  let validatedInstructor = null;
  let instructorChanged = false;
  if (req.body.assignedInstructor !== undefined || req.body.assignedInstructors !== undefined) {
    const instTarget = req.body.assignedInstructor || (Array.isArray(req.body.assignedInstructors) && req.body.assignedInstructors[0]);
    if (instTarget) {
      validatedInstructor = await validateInstructorAssignment(instTarget, program.division, req.user);
      program.assignedInstructor = validatedInstructor._id;
      program.assignedInstructors = [validatedInstructor._id];
      instructorChanged = true;
    } else {
      program.assignedInstructor = null;
      program.assignedInstructors = [];
      instructorChanged = true;
    }
  }

  if (req.body.status !== undefined && req.body.status !== program.status) {
    validateProgramStatusTransition(program.status, req.body.status);
    program.status = req.body.status;
  }

  program.updatedBy = req.user._id;
  await program.save();

  await recordAudit({
    user: req.user,
    action: instructorChanged ? 'PROGRAM_INSTRUCTOR_UPDATED' : 'PROGRAM_UPDATED',
    resource: 'Course',
    resourceId: program._id,
    division: program.division,
    before,
    after: program.toObject(),
    reason: req.body.reason || \`Program updated by \${req.user.role} \${req.user.fullName} (\${req.user.email})\`,
  });

  try {
    const { syncProgramFromAdmin } = require('../../integration/unifiedSyncService');
    await syncProgramFromAdmin(program);
  } catch (syncErr) {
    console.warn('[PROGRAM CONTROLLER] syncProgramFromAdmin warning on update:', syncErr.message);
  }

  if (validatedInstructor) {
    try {
      const { syncCourseInstructorAssignment } = require('../../integration/unifiedSyncService');
      await syncCourseInstructorAssignment({
        courseId: program._id,
        instructorId: validatedInstructor._id,
        user: req.user,
      });
    } catch (syncInstErr) {
      console.warn('[PROGRAM CONTROLLER] syncCourseInstructorAssignment warning on update:', syncInstErr.message);
    }
  }

  const populated = await Course.findById(program._id)
    .populate('assignedInstructors', 'fullName email division isActive')
    .populate('assignedInstructor', 'fullName email division isActive')
    .populate('createdBy', 'fullName email role')
    .populate('updatedBy', 'fullName email role');

  sendSuccess(res, 200, { program: populated });
});

// POST /api/programs/:id/assign-instructor
const assignInstructorToProgram = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { instructorId, reason } = req.body;
  if (!instructorId) {
    throw ApiError.badRequest('instructorId is required');
  }

  const program = await Course.findById(id);
  if (!program) {
    throw ApiError.notFound('Program not found');
  }

  if (req.user.role !== ROLES.SUPER_ADMIN && program.division !== req.scopeDivision) {
    throw ApiError.forbidden('You cannot assign instructors to a program outside your division');
  }

  const instructor = await validateInstructorAssignment(instructorId, program.division, req.user);
  const before = {
    assignedInstructor: program.assignedInstructor,
    assignedInstructors: program.assignedInstructors,
  };

  program.assignedInstructor = instructor._id;
  program.assignedInstructors = [instructor._id];
  program.updatedBy = req.user._id;
  await program.save();

  await recordAudit({
    user: req.user,
    action: before.assignedInstructor ? 'COURSE_INSTRUCTOR_REASSIGNED' : 'COURSE_INSTRUCTOR_ASSIGNED',
    resource: 'Course',
    resourceId: program._id,
    division: program.division,
    before,
    after: {
      assignedInstructor: instructor._id,
      instructorName: instructor.fullName,
      instructorEmail: instructor.email,
    },
    reason: reason || \`Instructor \${instructor.fullName} (\${instructor.email}) assigned to "\${program.title}" by \${req.user.role} \${req.user.fullName}\`,
  });

  const { syncCourseInstructorAssignment } = require('../../integration/unifiedSyncService');
  const syncResult = await syncCourseInstructorAssignment({
    courseId: program._id,
    instructorId: instructor._id,
    user: req.user,
  });

  const populatedProgram = await Course.findById(program._id)
    .populate('assignedInstructors', 'fullName email division isActive')
    .populate('assignedInstructor', 'fullName email division isActive')
    .populate('createdBy', 'fullName email role')
    .populate('updatedBy', 'fullName email role');

  sendSuccess(res, 200, { program: populatedProgram, syncResult });
});

// GET /api/programs/:id/enrollments
const getProgramEnrollments = asyncHandler(async (req, res) => {
  const program = await Course.findById(req.params.id);
  if (!program) {
    throw ApiError.notFound('Program not found');
  }

  if (req.user.role !== ROLES.SUPER_ADMIN && req.scopeDivision && req.scopeDivision !== 'all') {
    if (program.division !== req.scopeDivision) {
      throw ApiError.forbidden('You cannot access enrollments for a program outside your division');
    }
  }

  const { status, page = 1, limit = 50 } = req.query;
  const filter = { program: program._id };
  if (status) filter.status = status;

  const total = await Enrollment.countDocuments(filter);
  const enrollments = await Enrollment.find(filter)
    .populate('student', 'fullName email phone')
    .populate('application', 'status eligibilityStatus decision createdAt')
    .populate('cohort', 'name startDate endDate')
    .sort({ createdAt: -1 });

  const enrollmentIds = enrollments.map((e) => e._id);
  const invoices = await Invoice.find({ enrollment: { $in: enrollmentIds } });
  const invMap = {};
  invoices.forEach((inv) => {
    invMap[inv.enrollment.toString()] = inv;
  });

  const list = enrollments.map((e) => {
    const obj = e.toObject();
    obj.invoice = invMap[e._id.toString()] || null;
    obj.paymentStatus = obj.invoice?.status === 'PAID' ? 'PAID' : (['CONFIRMED', 'ACTIVE'].includes(e.status) ? 'PAID' : 'PENDING');
    return obj;
  });

  sendSuccess(res, 200, {
    enrollments: list,
    total,
    capacity: program.capacity,
    occupiedSeats: program.occupiedSeats,
  });
});

// PATCH /api/programs/:id/status
const updateProgramStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!status) {
    throw ApiError.badRequest('status is required');
  }

  const program = await Course.findById(req.params.id);
  if (!program) {
    throw ApiError.notFound('Program not found');
  }

  if (req.user.role !== ROLES.SUPER_ADMIN && program.division !== req.scopeDivision) {
    throw ApiError.forbidden('You cannot modify a program outside your division');
  }

  validateProgramStatusTransition(program.status, status);

  const before = { status: program.status };
  program.status = status;
  program.updatedBy = req.user._id;
  await program.save();

  await recordAudit({
    user: req.user,
    action: 'PROGRAM_STATUS_CHANGED',
    resource: 'Course',
    resourceId: program._id,
    division: program.division,
    before,
    after: { status: program.status },
    reason: reason || \`Program status transitioned from \${before.status} to \${status} by \${req.user.role} \${req.user.fullName}\`,
  });

  try {
    const { syncProgramFromAdmin } = require('../../integration/unifiedSyncService');
    await syncProgramFromAdmin(program);
  } catch (syncErr) {
    console.warn('[PROGRAM CONTROLLER] syncProgramFromAdmin warning on status change:', syncErr.message);
  }

  sendSuccess(res, 200, { program });
});

// DELETE /api/programs/:id (Delete or Safe Archive)
const deleteOrArchiveProgram = asyncHandler(async (req, res) => {
  const program = await Course.findById(req.params.id);
  if (!program) {
    throw ApiError.notFound('Program not found');
  }

  if (req.user.role !== ROLES.SUPER_ADMIN && program.division !== req.scopeDivision) {
    throw ApiError.forbidden('You cannot delete or archive a program outside your division');
  }

  const [appCount, cohortCount, enrollCount, invoiceCount, certCount] = await Promise.all([
    Application.countDocuments({ program: program._id }),
    Cohort.countDocuments({ program: program._id }),
    Enrollment.countDocuments({ program: program._id }),
    Invoice.countDocuments({ program: program._id }),
    Certificate.countDocuments({ program: program._id }),
  ]);

  const totalReferences = appCount + cohortCount + enrollCount + invoiceCount + certCount;
  const before = program.toObject();

  if (totalReferences > 0) {
    program.status = PROGRAM_STATUS.ARCHIVED;
    program.isArchived = true;
    program.archivedAt = new Date();
    program.archivedBy = req.user._id;
    program.updatedBy = req.user._id;
    await program.save();

    await recordAudit({
      user: req.user,
      action: 'PROGRAM_ARCHIVED',
      resource: 'Course',
      resourceId: program._id,
      division: program.division,
      before,
      after: program.toObject(),
      reason: req.body.reason || \`Program safely archived due to \${totalReferences} existing operational references\`,
    });

    try {
      const { syncProgramFromAdmin } = require('../../integration/unifiedSyncService');
      await syncProgramFromAdmin(program);
    } catch (syncErr) {
      console.warn('[PROGRAM CONTROLLER] syncProgramFromAdmin warning on archive:', syncErr.message);
    }

    return sendSuccess(res, 200, {
      program,
      archived: true,
      deleted: false,
      message: \`Program has active references and was safely archived rather than deleted (\${totalReferences} linked records preserved).\`,
      references: { applications: appCount, cohorts: cohortCount, enrollments: enrollCount, invoices: invoiceCount, certificates: certCount },
    });
  }

  await Course.findByIdAndDelete(program._id);

  try {
    const StudentCourse = require('../../student/models/Course');
    await StudentCourse.findByIdAndDelete(program._id);
  } catch (_) {}

  await recordAudit({
    user: req.user,
    action: 'PROGRAM_DELETED',
    resource: 'Course',
    resourceId: program._id,
    division: program.division,
    before,
    after: null,
    reason: req.body.reason || \`Program "\${program.title}" deleted by \${req.user.role} \${req.user.fullName} (\${req.user.email})\`,
  });

  sendSuccess(res, 200, {
    deleted: true,
    archived: false,
    message: \`Program "\${program.title}" was successfully deleted.\`,
  });
});

module.exports = {
  createProgram,
  listPrograms,
  getProgramById,
  updateProgram,
  assignInstructorToProgram,
  getProgramEnrollments,
  updateProgramStatus,
  deleteOrArchiveProgram,
  validateInstructorAssignment,
};
`;

fs.writeFileSync(targetPath, updatedContent, 'utf8');
console.log('Successfully updated programController.js');

