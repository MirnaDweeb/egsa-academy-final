const mongoose = require('mongoose');
const { Conversation, Message, Cohort, StudentReference, EnrollmentReference, Notification, User: InstructorUser } = require('../models');
const { ownedStudentEnrollments, ownedConversation, ownedCohort } = require('./ownership.service');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const { NOTIFICATION_TYPE } = require('../config/constants');
const { emitNewMessage, emitMessageRead } = require('../../../socket');
const { getStudentConn, getAdminConn } = require('../../../config/database');

/**
 * Safe student lookup by externalStudentId with automatic reference synchronization.
 */
async function studentGetByExternalId(externalStudentId) {
  if (!externalStudentId) throw ApiError.badRequest('externalStudentId is required');

  let student = null;
  if (isId(String(externalStudentId))) {
    student = await StudentReference.findById(externalStudentId);
  }
  if (!student) {
    student = await StudentReference.findOne({ externalStudentId: String(externalStudentId) });
  }

  // If not found in instructor StudentReference collection, sync from Student DB
  if (!student && isId(String(externalStudentId))) {
    try {
      const studentConn = getStudentConn();
      const StudentUser = studentConn.models.User || studentConn.model('User');
      const studentUser = await StudentUser.findById(externalStudentId).lean();
      if (studentUser) {
        student = await StudentReference.create({
          externalStudentId: String(studentUser._id),
          name: studentUser.fullName || studentUser.name || 'Student Cadet',
          email: studentUser.email,
        });
      }
    } catch (syncErr) {
      console.warn('[MessagingService] Student reference auto-sync warning:', syncErr.message);
    }
  }

  if (!student) throw ApiError.notFound('Student record not found');
  return student;
}

/**
 * Universal conversation access check (Anti-IDOR).
 * Ensures only authorized participants (or administrators) can access conversation.
 */
async function canUserAccessConversation(userContext, conversationId) {
  if (!isId(String(conversationId))) throw ApiError.badRequest('Invalid conversationId');

  const conv = await Conversation.findById(conversationId)
    .populate('student', 'name email externalStudentId')
    .populate('instructor', 'name email')
    .populate('cohort', 'name')
    .populate('course', 'name code');

  if (!conv) throw ApiError.notFound('Conversation not found');

  // 1. Admin access
  const isAdmin =
    userContext.isAdmin ||
    ['admin', 'super_admin', 'pre_university_admin', 'university_admin'].includes(userContext.role);
  if (isAdmin) {
    return conv;
  }

  // 2. Instructor access
  if (userContext.role === 'instructor') {
    if (conv.instructor && String(conv.instructor._id || conv.instructor) === String(userContext.id)) {
      return conv;
    }
    throw ApiError.forbidden('Unauthorized: You are not an assigned instructor in this conversation');
  }

  // 3. Student access
  if (userContext.role === 'student') {
    const studentRef = await studentGetByExternalId(userContext.id);
    if (conv.student && String(conv.student._id || conv.student) === String(studentRef._id)) {
      return conv;
    }
    throw ApiError.forbidden('Unauthorized: You are not a student participant in this conversation');
  }

  throw ApiError.forbidden('Forbidden');
}

/**
 * Universal message persistence & real-time dispatch.
 * 1. Checks membership authorization
 * 2. Persists message in DB
 * 3. Updates conversation lastMessage & unread count
 * 4. Broadcasts to Socket.IO conversation room & recipient private rooms
 */
async function saveMessageAndDispatch({ userContext, conversationId, body, attachments }) {
  const conv = await canUserAccessConversation(userContext, conversationId);

  const rawText = String(body || '').trim();
  const validAttachments = Array.isArray(attachments) ? attachments.filter((a) => a && a.url) : [];

  if (!rawText && !validAttachments.length) {
    throw ApiError.badRequest('Message body or attachment is required');
  }
  if (rawText.length > 3000) {
    throw ApiError.badRequest('Message exceeds 3000 characters limit');
  }

  // Resolve sender role and identity
  let senderRole = 'student';
  let senderId = null;
  let senderName = userContext.name || 'User';

  if (userContext.role === 'instructor') {
    senderRole = 'instructor';
    senderId = new mongoose.Types.ObjectId(userContext.id);
  } else if (
    userContext.isAdmin ||
    ['admin', 'super_admin', 'pre_university_admin', 'university_admin'].includes(userContext.role)
  ) {
    senderRole = 'admin';
    senderId = new mongoose.Types.ObjectId(userContext.id);
  } else {
    // Student
    const studentRef = await studentGetByExternalId(userContext.id);
    senderRole = 'student';
    senderId = studentRef._id;
    senderName = studentRef.name || userContext.name;
  }

  const message = await Message.create({
    conversation: conversationId,
    senderRole,
    senderId,
    senderName,
    body: rawText,
    attachments: validAttachments,
    read: false,
  });

  // Calculate unread increments
  const convUpdate = {
    lastMessage: {
      body: rawText || (validAttachments.length ? `[Attachment: ${validAttachments[0].name || 'File'}]` : ''),
      senderRole,
      senderId,
      senderName,
      createdAt: message.createdAt,
    },
    lastMessageAt: message.createdAt,
  };

  // Auto-reopen resolved support conversation on follow-up message
  const wasResolved = conv.supportStatus === 'resolved';
  if (wasResolved) {
    convUpdate.supportStatus = 'in_progress';
  }

  const recipientRooms = [];

  if (senderRole === 'student') {
    if (conv.type === 'student_admin') {
      convUpdate.$inc = { unreadCountAdmin: 1 };
      recipientRooms.push('role:admin');
    } else {
      convUpdate.$inc = { unreadCountInstructor: 1 };
      if (conv.instructor) {
        const instId = String(conv.instructor._id || conv.instructor);
        recipientRooms.push(`user:instructor:${instId}`, `user:${instId}`);
      }
    }
  } else if (senderRole === 'instructor') {
    if (conv.type === 'instructor_admin') {
      convUpdate.$inc = { unreadCountAdmin: 1 };
      recipientRooms.push('role:admin');
    } else {
      convUpdate.$inc = { unreadCountStudent: 1 };
      if (conv.student) {
        const extId = String(conv.student.externalStudentId || conv.student._id || conv.student);
        recipientRooms.push(`user:student:${extId}`, `user:${extId}`);
      }
    }
  } else {
    // Admin sender
    convUpdate.$inc = {};
    if (conv.student) {
      convUpdate.$inc.unreadCountStudent = 1;
      const extId = String(conv.student.externalStudentId || conv.student._id || conv.student);
      recipientRooms.push(`user:student:${extId}`, `user:${extId}`);
    }
    if (conv.instructor) {
      convUpdate.$inc.unreadCountInstructor = 1;
      const instId = String(conv.instructor._id || conv.instructor);
      recipientRooms.push(`user:instructor:${instId}`, `user:${instId}`);
    }
  }

  await Conversation.updateOne({ _id: conversationId }, convUpdate);

  // Dispatch real-time Socket.IO events
  emitNewMessage(conversationId, message, recipientRooms);

  if (wasResolved) {
    const { getIO } = require('../../../socket');
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation:status_changed', {
        conversationId,
        supportStatus: 'in_progress',
        reopenedAt: message.createdAt,
      });
    }
  }

  return { message, conversation: conv, recipientRooms };
}

/**
 * Universal mark messages in conversation as read.
 */
async function markConversationRead(userContext, conversationId) {
  const conv = await canUserAccessConversation(userContext, conversationId);
  const now = new Date();

  let unreadField = 'unreadCountStudent';
  let otherSenderFilter = {};

  if (userContext.role === 'instructor') {
    unreadField = 'unreadCountInstructor';
    otherSenderFilter = { senderRole: { $ne: 'instructor' } };
  } else if (
    userContext.isAdmin ||
    ['admin', 'super_admin', 'pre_university_admin', 'university_admin'].includes(userContext.role)
  ) {
    unreadField = 'unreadCountAdmin';
    otherSenderFilter = { senderRole: { $ne: 'admin' } };
  } else {
    // Student
    unreadField = 'unreadCountStudent';
    otherSenderFilter = { senderRole: { $ne: 'student' } };
  }

  await Message.updateMany(
    { conversation: conversationId, ...otherSenderFilter, read: false },
    { $set: { read: true, readAt: now } }
  );

  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { [unreadField]: 0 } }
  );

  emitMessageRead(conversationId, userContext.id, userContext.role);
  return { marked: true };
}

// -------------------------------------------------------------
// Instructor Service Methods
// -------------------------------------------------------------

async function listConversations(instructorId, { search, type, supportStatus } = {}) {
  const query = { instructor: instructorId };
  if (type) {
    query.type = type;
  }
  if (supportStatus) {
    query.supportStatus = supportStatus;
  }

  let convs = await Conversation.find(query)
    .populate('student', 'name email externalStudentId')
    .populate('cohort', 'name')
    .populate('course', 'name code')
    .sort({ lastMessageAt: -1 })
    .lean();

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    convs = convs.filter((c) => {
      const name = c.student?.name?.toLowerCase() || '';
      const email = c.student?.email?.toLowerCase() || '';
      const ext = c.student?.externalStudentId?.toLowerCase() || '';
      const cohortName = c.cohort?.name?.toLowerCase() || '';
      const subject = c.subject?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || ext.includes(q) || cohortName.includes(q) || subject.includes(q);
    });
  }

  const unreadTotal = convs.reduce((sum, c) => sum + (c.unreadCountInstructor || 0), 0);
  return { items: convs, meta: { total: convs.length, unreadTotal } };
}

async function getOrCreateConversation(instructorId, { studentId, cohortId }) {
  if (!isId(String(studentId))) throw ApiError.badRequest('Invalid studentId');
  const enrollments = await ownedStudentEnrollments(instructorId, studentId);

  let selectedCohortId = cohortId;
  if (selectedCohortId) {
    if (!isId(String(selectedCohortId))) throw ApiError.badRequest('Invalid cohortId');
    await ownedCohort(instructorId, selectedCohortId);
    const valid = enrollments.some((e) => String(e.cohort) === String(selectedCohortId));
    if (!valid) throw ApiError.badRequest('Student is not enrolled in the specified cohort');
  } else {
    selectedCohortId = enrollments[0].cohort;
  }

  let conv = await Conversation.findOne({
    instructor: instructorId,
    student: studentId,
    cohort: selectedCohortId,
  })
    .populate('student', 'name email externalStudentId')
    .populate('cohort', 'name')
    .populate('course', 'name code');

  if (!conv) {
    const cohort = await Cohort.findById(selectedCohortId).select('course');
    conv = await Conversation.create({
      type: 'direct',
      instructor: instructorId,
      student: studentId,
      cohort: selectedCohortId,
      course: cohort?.course,
      lastMessageAt: new Date(),
      unreadCountInstructor: 0,
      unreadCountStudent: 0,
    });
    conv = await Conversation.findById(conv._id)
      .populate('student', 'name email externalStudentId')
      .populate('cohort', 'name')
      .populate('course', 'name code');
  }

  return conv;
}

async function instructorGetOrCreateAdminConversation(instructorId, { subject = 'Faculty Administration Support', category = 'general', forceNew = false } = {}) {
  const validCategories = ['general', 'technical', 'academic', 'complaint'];
  const resolvedCategory = validCategories.includes(category) ? category : 'general';

  if (!forceNew) {
    let existing = await Conversation.findOne({
      type: 'instructor_admin',
      instructor: instructorId,
      supportStatus: { $in: ['open', 'in_progress'] },
    })
      .populate('instructor', 'name email')
      .sort({ lastMessageAt: -1 })
      .lean();

    if (existing) {
      return existing;
    }

    // Fallback to any latest instructor_admin conversation if none open
    let latest = await Conversation.findOne({
      type: 'instructor_admin',
      instructor: instructorId,
    })
      .populate('instructor', 'name email')
      .sort({ lastMessageAt: -1 })
      .lean();

    if (latest && latest.supportStatus !== 'resolved') {
      return latest;
    }
  }

  const inst = await InstructorUser.findById(instructorId).lean();
  const conv = await Conversation.create({
    type: 'instructor_admin',
    instructor: instructorId,
    subject: subject || 'Faculty Administration Support',
    category: resolvedCategory,
    supportStatus: 'open',
    adminName: 'Academy Support & Governance',
    lastMessageAt: new Date(),
    unreadCountInstructor: 0,
    unreadCountAdmin: 0,
  });

  return Conversation.findById(conv._id)
    .populate('instructor', 'name email')
    .lean();
}

async function getConversation(instructorId, conversationId) {
  return canUserAccessConversation({ id: instructorId, role: 'instructor' }, conversationId);
}

async function listMessages(instructorId, conversationId, { limit = 100, before } = {}) {
  await canUserAccessConversation({ id: instructorId, role: 'instructor' }, conversationId);

  const filter = { conversation: conversationId };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const lim = Math.min(parseInt(limit, 10) || 100, 200);
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();

  messages.reverse();

  // Mark messages as read by instructor
  await markConversationRead({ id: instructorId, role: 'instructor' }, conversationId);

  return { items: messages, total: messages.length };
}

async function sendMessage(instructorId, conversationId, rawBody, attachments = []) {
  const user = await InstructorUser.findById(instructorId).lean();
  const res = await saveMessageAndDispatch({
    userContext: { id: instructorId, role: 'instructor', name: user?.name || 'Instructor' },
    conversationId,
    body: rawBody,
    attachments,
  });
  return res.message;
}

async function markAsRead(instructorId, conversationId) {
  return markConversationRead({ id: instructorId, role: 'instructor' }, conversationId);
}

async function getUnreadCount(instructorId) {
  const r = await Conversation.aggregate([
    { $match: { instructor: new mongoose.Types.ObjectId(instructorId) } },
    { $group: { _id: null, total: { $sum: '$unreadCountInstructor' } } },
  ]);
  return { unreadCount: r[0]?.total || 0 };
}

// -------------------------------------------------------------
// Student Service Methods
// -------------------------------------------------------------

async function studentListConversations(externalStudentId, { type, supportStatus } = {}) {
  const student = await studentGetByExternalId(externalStudentId);

  const query = {
    $or: [
      { student: student._id },
      { type: 'student_admin', student: student._id },
    ],
  };

  if (type) {
    query.type = type;
  }
  if (supportStatus) {
    query.supportStatus = supportStatus;
  }

  const convs = await Conversation.find(query)
    .populate('instructor', 'name email avatarUrl professional')
    .populate('cohort', 'name')
    .populate('course', 'name code')
    .sort({ lastMessageAt: -1 })
    .lean();

  return convs;
}

async function studentGetOrCreateInstructorConversation(externalStudentId, { instructorId, cohortId, subject }) {
  const student = await studentGetByExternalId(externalStudentId);
  if (!isId(String(instructorId))) throw ApiError.badRequest('Invalid instructorId');

  // AUTHORIZATION / ENROLLMENT CHECK:
  // Strictly ensure the student is actively enrolled in a course/cohort taught by this instructor
  const available = await studentListAvailableContacts(externalStudentId);
  const eligibleInstructor = available.instructors.find(
    (inst) => String(inst._id) === String(instructorId) && (!cohortId || String(inst.cohortId) === String(cohortId))
  );

  if (!eligibleInstructor) {
    throw ApiError.forbidden(
      'Unauthorized: You are not authorized to contact this instructor. You must be enrolled in their course or cohort.'
    );
  }

  const selectedCohortId = cohortId || eligibleInstructor.cohortId;

  let conv = await Conversation.findOne({
    type: 'direct',
    instructor: instructorId,
    student: student._id,
    cohort: selectedCohortId,
  })
    .populate('instructor', 'name email avatarUrl professional')
    .populate('cohort', 'name')
    .populate('course', 'name code');

  if (!conv) {
    const cohort = await Cohort.findById(selectedCohortId).select('course name');
    conv = await Conversation.create({
      type: 'direct',
      instructor: instructorId,
      student: student._id,
      cohort: selectedCohortId,
      course: cohort?.course || eligibleInstructor.courseId,
      subject: subject || `${eligibleInstructor.courseName || 'Course'} Inquiry`,
      lastMessageAt: new Date(),
      unreadCountInstructor: 0,
      unreadCountStudent: 0,
    });

    conv = await Conversation.findById(conv._id)
      .populate('instructor', 'name email avatarUrl professional')
      .populate('cohort', 'name')
      .populate('course', 'name code');
  }

  return conv;
}

async function studentGetOrCreateAdminConversation(externalStudentId, { subject = 'EGSA Student Support Inquiry', category = 'general', forceNew = false } = {}) {
  const student = await studentGetByExternalId(externalStudentId);

  const validCategories = ['general', 'technical', 'academic', 'complaint'];
  const resolvedCategory = validCategories.includes(category) ? category : 'general';

  if (!forceNew) {
    let existing = await Conversation.findOne({
      type: 'student_admin',
      student: student._id,
      supportStatus: { $in: ['open', 'in_progress'] },
    })
      .populate('student', 'name email')
      .sort({ lastMessageAt: -1 })
      .lean();

    if (existing) {
      return existing;
    }

    // Fallback to latest student_admin conversation if none open
    let latest = await Conversation.findOne({
      type: 'student_admin',
      student: student._id,
    })
      .populate('student', 'name email')
      .sort({ lastMessageAt: -1 })
      .lean();

    if (latest && latest.supportStatus !== 'resolved') {
      return latest;
    }
  }

  const conv = await Conversation.create({
    type: 'student_admin',
    student: student._id,
    subject: subject || 'EGSA Student Support Inquiry',
    category: resolvedCategory,
    supportStatus: 'open',
    adminName: 'EGSA Support & Admissions Desk',
    lastMessageAt: new Date(),
    unreadCountStudent: 0,
    unreadCountAdmin: 0,
  });

  return Conversation.findById(conv._id)
    .populate('student', 'name email')
    .lean();
}

async function studentSendMessage(externalStudentId, conversationId, rawBody, attachments = []) {
  const student = await studentGetByExternalId(externalStudentId);
  const res = await saveMessageAndDispatch({
    userContext: { id: externalStudentId, role: 'student', name: student.name },
    conversationId,
    body: rawBody,
    attachments,
  });
  return res.message;
}

async function studentListMessages(externalStudentId, conversationId, { limit = 100, before } = {}) {
  const student = await studentGetByExternalId(externalStudentId);
  await canUserAccessConversation({ id: externalStudentId, role: 'student' }, conversationId);

  const filter = { conversation: conversationId };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const lim = Math.min(parseInt(limit, 10) || 100, 200);
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();

  messages.reverse();

  // Mark messages as read by student
  await markConversationRead({ id: externalStudentId, role: 'student' }, conversationId);

  return { items: messages, total: messages.length };
}

async function studentMarkAsRead(externalStudentId, conversationId) {
  return markConversationRead({ id: externalStudentId, role: 'student' }, conversationId);
}

async function studentGetUnreadCount(externalStudentId) {
  const student = await studentGetByExternalId(externalStudentId);
  const r = await Conversation.aggregate([
    { $match: { student: student._id } },
    { $group: { _id: null, total: { $sum: '$unreadCountStudent' } } },
  ]);
  return { unreadCount: r[0]?.total || 0 };
}

/**
 * List available faculty contacts for a student (instructors of enrolled cohorts + Admin Support)
 */
async function studentListAvailableContacts(externalStudentId) {
  const student = await studentGetByExternalId(externalStudentId);

  // 1. Find enrolled cohorts in Instructor DB
  let enrollments = await EnrollmentReference.find({ student: student._id })
    .populate({
      path: 'cohort',
      populate: [
        { path: 'instructor', select: 'name email avatarUrl professional' },
        { path: 'course', select: 'name code' },
      ],
    })
    .lean();

  // 2. If no enrollments exist in EnrollmentReference, auto-sync from Student DB
  if (!enrollments.length && isId(String(externalStudentId))) {
    try {
      const studentConn = getStudentConn();
      const StudentEnrollment = studentConn.models.Enrollment || studentConn.model('Enrollment');
      const stEnrollments = await StudentEnrollment.find({
        student: externalStudentId,
        status: { $in: ['Confirmed', 'Active', 'Completed', 'active', 'confirmed'] },
      }).lean();

      if (stEnrollments && stEnrollments.length > 0) {
        const { syncEnrollment } = require('../../integration/unifiedSyncService');
        for (const se of stEnrollments) {
          try {
            await syncEnrollment({
              student: externalStudentId,
              cohort: se.cohort,
              course: se.course,
              enrollmentId: se._id,
              status: se.status,
            });
          } catch (syncItemErr) {
            console.warn('[MessagingService] syncEnrollment item warning:', syncItemErr.message);
          }
        }

        enrollments = await EnrollmentReference.find({ student: student._id })
          .populate({
            path: 'cohort',
            populate: [
              { path: 'instructor', select: 'name email avatarUrl professional' },
              { path: 'course', select: 'name code' },
            ],
          })
          .lean();
      }
    } catch (syncErr) {
      console.warn('[MessagingService] studentListAvailableContacts auto-sync warning:', syncErr.message);
    }
  }

  const instructorsMap = new Map();

  enrollments.forEach((e) => {
    if (e.cohort && e.cohort.instructor) {
      const inst = e.cohort.instructor;
      const key = `${inst._id}_${e.cohort._id}`;
      if (!instructorsMap.has(key)) {
        instructorsMap.set(key, {
          _id: inst._id,
          name: inst.name,
          email: inst.email,
          avatarUrl: inst.avatarUrl,
          role: 'instructor',
          cohortId: e.cohort._id,
          cohortName: e.cohort.name,
          courseId: e.cohort.course?._id || e.course,
          courseName: e.cohort.course?.name || 'Academy Training Program',
          courseCode: e.cohort.course?.code,
        });
      }
    }
  });

  return {
    support: {
      id: 'admin_support',
      name: 'EGSA Support & Admissions Desk',
      role: 'admin',
      type: 'student_admin',
    },
    instructors: Array.from(instructorsMap.values()),
  };
}

/**
 * Universal update of conversation supportStatus (open, in_progress, resolved)
 */
async function updateConversationStatus(userContext, conversationId, newStatus) {
  const conv = await canUserAccessConversation(userContext, conversationId);
  const validStatuses = ['open', 'in_progress', 'resolved'];
  if (!validStatuses.includes(newStatus)) {
    throw ApiError.badRequest(`Invalid status: ${newStatus}. Must be one of: open, in_progress, resolved`);
  }

  await Conversation.updateOne({ _id: conversationId }, { $set: { supportStatus: newStatus } });

  const updatedConv = await Conversation.findById(conversationId)
    .populate('student', 'name email externalStudentId')
    .populate('instructor', 'name email')
    .populate('cohort', 'name')
    .populate('course', 'name code')
    .lean();

  const { getIO } = require('../../../socket');
  const io = getIO();
  if (io) {
    io.to(`conversation:${conversationId}`).emit('conversation:status_changed', {
      conversationId,
      supportStatus: newStatus,
      updatedBy: { id: userContext.id, role: userContext.role, name: userContext.name },
      updatedAt: new Date(),
    });
  }

  return updatedConv;
}

// -------------------------------------------------------------
// Admin Service Methods
// -------------------------------------------------------------

async function adminListConversations({ type, search, supportStatus, limit = 100, skip = 0 } = {}) {
  const query = {};
  if (type && type !== 'ALL') {
    query.type = type;
  }
  if (supportStatus && supportStatus !== 'ALL') {
    query.supportStatus = supportStatus;
  }

  const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);
  const parsedSkip = parseInt(skip, 10) || 0;

  let convs = await Conversation.find(query)
    .populate('student', 'name email externalStudentId')
    .populate('instructor', 'name email')
    .populate('cohort', 'name')
    .populate('course', 'name code')
    .sort({ lastMessageAt: -1 })
    .skip(parsedSkip)
    .limit(parsedLimit)
    .lean();

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    convs = convs.filter((c) => {
      const sName = c.student?.name?.toLowerCase() || '';
      const sEmail = c.student?.email?.toLowerCase() || '';
      const iName = c.instructor?.name?.toLowerCase() || '';
      const iEmail = c.instructor?.email?.toLowerCase() || '';
      const subj = c.subject?.toLowerCase() || '';
      const courseName = c.course?.name?.toLowerCase() || '';
      const cohortName = c.cohort?.name?.toLowerCase() || '';
      return sName.includes(q) || sEmail.includes(q) || iName.includes(q) || iEmail.includes(q) || subj.includes(q) || courseName.includes(q) || cohortName.includes(q);
    });
  }

  // Aggregate breakdown counts by conversation type
  const typeAgg = await Conversation.aggregate([
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        unreadAdmin: { $sum: '$unreadCountAdmin' },
      },
    },
  ]);

  const counts = {
    student_admin: { total: 0, unread: 0 },
    instructor_admin: { total: 0, unread: 0 },
    direct: { total: 0, unread: 0 },
    needs_review: { total: 0, unread: 0 },
  };

  let unreadTotal = 0;
  let totalConversations = 0;

  for (const item of typeAgg) {
    totalConversations += item.total || 0;
    unreadTotal += item.unreadAdmin || 0;
    if (counts[item._id]) {
      counts[item._id].total = item.total || 0;
      counts[item._id].unread = item.unreadAdmin || 0;
    } else {
      counts.needs_review.total += item.total || 0;
      counts.needs_review.unread += item.unreadAdmin || 0;
    }
  }

  return {
    items: convs,
    meta: {
      total: convs.length,
      totalAll: totalConversations,
      unreadTotal,
      counts,
    },
  };
}

async function adminGetConversation(conversationId) {
  return canUserAccessConversation({ role: 'admin', isAdmin: true }, conversationId);
}

async function adminListMessages(conversationId, { limit = 100, before } = {}) {
  await canUserAccessConversation({ role: 'admin', isAdmin: true }, conversationId);

  const filter = { conversation: conversationId };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const lim = Math.min(parseInt(limit, 10) || 100, 200);
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();

  messages.reverse();

  // Mark read by admin
  await markConversationRead({ id: 'admin', role: 'admin', isAdmin: true }, conversationId);

  return { items: messages, total: messages.length };
}

async function adminSendMessage(adminUser, conversationId, rawBody, attachments = []) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw ApiError.notFound('Conversation not found');
  }
  if (conv.type === 'direct') {
    throw ApiError.forbidden('Direct administrative messaging is disabled in monitored student-instructor conversations');
  }

  const res = await saveMessageAndDispatch({
    userContext: {
      id: adminUser._id || adminUser.id,
      role: 'admin',
      isAdmin: true,
      name: adminUser.name || adminUser.fullName || 'EGSA Administrator',
    },
    conversationId,
    body: rawBody,
    attachments,
  });
  return res.message;
}

async function adminMarkAsRead(adminUser, conversationId) {
  return markConversationRead({ id: adminUser._id || adminUser.id, role: 'admin', isAdmin: true }, conversationId);
}

async function adminGetUnreadCount() {
  const r = await Conversation.aggregate([
    { $group: { _id: null, total: { $sum: '$unreadCountAdmin' } } },
  ]);
  const typeAgg = await Conversation.aggregate([
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        unreadAdmin: { $sum: '$unreadCountAdmin' },
      },
    },
  ]);
  const counts = {
    student_admin: { total: 0, unread: 0 },
    instructor_admin: { total: 0, unread: 0 },
    direct: { total: 0, unread: 0 },
    needs_review: { total: 0, unread: 0 },
  };
  for (const item of typeAgg) {
    if (counts[item._id]) {
      counts[item._id].total = item.total || 0;
      counts[item._id].unread = item.unreadAdmin || 0;
    } else {
      counts.needs_review.total += item.total || 0;
      counts.needs_review.unread += item.unreadAdmin || 0;
    }
  }
  return { unreadCount: r[0]?.total || 0, counts };
}

module.exports = {
  // Common / Socket verification & dispatch
  canUserAccessConversation,
  saveMessageAndDispatch,
  markConversationRead,
  studentGetByExternalId,
  updateConversationStatus,

  // Instructor methods
  listConversations,
  getOrCreateConversation,
  instructorGetOrCreateAdminConversation,
  getConversation,
  listMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,

  // Student methods
  studentListConversations,
  studentGetOrCreateInstructorConversation,
  studentGetOrCreateAdminConversation,
  studentSendMessage,
  studentListMessages,
  studentMarkAsRead,
  studentGetUnreadCount,
  studentListAvailableContacts,

  // Admin methods
  adminListConversations,
  adminGetConversation,
  adminListMessages,
  adminSendMessage,
  adminMarkAsRead,
  adminGetUnreadCount,
};
