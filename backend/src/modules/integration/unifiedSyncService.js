const mongoose = require('mongoose');
const { getStudentConn, getInstructorConn, getAdminConn } = require('../../config/database');

// Lazy-load models across all three pools to ensure schemas are registered
function getModels() {
  const sConn = getStudentConn();
  const iConn = getInstructorConn();
  const aConn = getAdminConn();

  return {
    student: {
      User: require('../student/models/User'),
      Course: require('../student/models/Course'),
      Cohort: require('../student/models/Cohort'),
      Application: require('../student/models/Application'),
      Invoice: require('../student/models/Invoice'),
      Enrollment: require('../student/models/Enrollment'),
      TrainingSession: require('../student/models/TrainingSession'),
      AttendanceRecord: require('../student/models/AttendanceRecord'),
      Assessment: require('../student/models/Assessment'),
      StudentSubmission: require('../student/models/StudentSubmission'),
      AssessmentResult: require('../student/models/AssessmentResult'),
      Notification: require('../student/models/Notification'),
    },
    instructor: {
      User: require('../instructor/models/User'),
      Course: require('../instructor/models/Course'),
      Cohort: require('../instructor/models/Cohort'),
      Session: require('../instructor/models/Session'),
      StudentReference: require('../instructor/models/StudentReference'),
      EnrollmentReference: require('../instructor/models/EnrollmentReference'),
      Attendance: require('../instructor/models/Attendance'),
      Assessment: require('../instructor/models/Assessment'),
      AssessmentSubmission: require('../instructor/models/AssessmentSubmission'),
      AssessmentResult: require('../instructor/models/AssessmentResult'),
      Notification: require('../instructor/models/Notification'),
    },
    admin: {
      User: require('../admin/models/User'),
      Course: require('../admin/models/Course'),
      Cohort: require('../admin/models/Cohort'),
      Application: require('../admin/models/Application'),
      Invoice: require('../admin/models/Invoice'),
      Enrollment: require('../admin/models/Enrollment'),
      Attendance: require('../admin/models/Attendance'),
      StudentProfile: require('../admin/models/StudentProfile'),
      InstructorProfile: require('../admin/models/InstructorProfile'),
    },
  };
}

/**
 * 1. Synchronize an active / confirmed enrollment to Instructor and Admin portals.
 */
async function syncEnrollment({ student, course, cohort, enrollmentId, status = 'active' }) {
  try {
    const { student: S, instructor: I, admin: A } = getModels();

    const studentIdStr = (student?._id || student?.id || student)?.toString();
    if (!studentIdStr) return null;

    // Resolve student user details
    let studentUser = student;
    if (!studentUser.email || !studentUser.fullName) {
      studentUser = await S.User.findById(studentIdStr).lean();
    }
    if (!studentUser) return null;

    const studentName = studentUser.fullName || studentUser.name || 'Academy Student';
    const studentEmail = studentUser.email.toLowerCase().trim();

    // 1. Ensure StudentReference in Instructor DB (egsa_instructor)
    const studentRef = await I.StudentReference.findOneAndUpdate(
      { externalStudentId: studentIdStr },
      { $set: { name: studentName, email: studentEmail } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Resolve course and authoritative assigned instructor
    const courseIdStr = (course?._id || course?.id || course)?.toString();
    let adminCourse = null;
    if (courseIdStr && mongoose.Types.ObjectId.isValid(courseIdStr)) {
      adminCourse = await A.Course.findById(courseIdStr).lean();
    }

    let instUser = null;
    const adminInstId = adminCourse?.assignedInstructor || (adminCourse?.assignedInstructors && adminCourse.assignedInstructors[0]);
    if (adminInstId) {
      const adminInst = await A.User.findById(adminInstId).lean();
      if (adminInst) {
        instUser = await I.User.findOne({
          $or: [
            { externalId: adminInst._id.toString() },
            { email: adminInst.email.toLowerCase().trim() },
          ],
        });
        if (!instUser) {
          const bcrypt = require('bcrypt');
          const hash = await bcrypt.hash('EgsaInstructor2026!', 10);
          instUser = await I.User.create({
            externalId: adminInst._id.toString(),
            email: adminInst.email.toLowerCase().trim(),
            name: adminInst.fullName,
            passwordHash: hash,
            role: 'instructor',
            division: adminInst.division || adminCourse.division || 'UNIVERSITY',
            status: 'active',
          });
        }
      }
    }
    if (!instUser) {
      let studentCourseDoc = null;
      if (courseIdStr && mongoose.Types.ObjectId.isValid(courseIdStr)) {
        studentCourseDoc = await S.Course.findById(courseIdStr).lean();
      }
      if (studentCourseDoc?.instructorEmail) {
        instUser = await I.User.findOne({ email: studentCourseDoc.instructorEmail.toLowerCase().trim() });
      }
    }
    if (!instUser) {
      instUser = await I.User.findOne({ role: 'instructor', status: 'active' });
      if (!instUser) {
        instUser = await I.User.findOne({ role: 'instructor' });
      }
    }

    // 3. Resolve or sync Course in Instructor DB
    let instructorCourse = null;
    if (courseIdStr) {
      instructorCourse = await I.Course.findOne({
        $or: [{ externalCourseId: courseIdStr }, { _id: mongoose.Types.ObjectId.isValid(courseIdStr) ? courseIdStr : null }],
      });
    }
    if (!instructorCourse && course?.title) {
      instructorCourse = await I.Course.findOne({ name: course.title });
    }
    if (!instructorCourse) {
      const code = (course?.code || adminCourse?.code || `CRS-${(courseIdStr || Date.now().toString()).slice(-4)}`).toUpperCase();
      instructorCourse = await I.Course.create({
        externalCourseId: courseIdStr || '',
        code,
        name: course?.title || adminCourse?.title || 'Academy Space Program',
        description: course?.shortDescription || course?.overview || adminCourse?.description || 'Accredited training program',
        assignedInstructor: instUser?._id,
        status: 'active',
      });
    } else if (instUser && String(instructorCourse.assignedInstructor) !== String(instUser._id)) {
      instructorCourse.assignedInstructor = instUser._id;
      await instructorCourse.save();
    }

    // 4. Resolve or sync Cohort in Instructor DB
    const cohortIdStr = (cohort?._id || cohort?.id || cohort)?.toString();
    let instructorCohort = null;
    if (cohortIdStr) {
      instructorCohort = await I.Cohort.findOne({
        $or: [
          { externalCohortId: cohortIdStr },
          { _id: mongoose.Types.ObjectId.isValid(cohortIdStr) ? cohortIdStr : null },
        ],
      });
    }
    if (!instructorCohort && instructorCourse) {
      instructorCohort = await I.Cohort.findOne({ course: instructorCourse._id });
    }
    if (!instructorCohort) {
      instructorCohort = await I.Cohort.create({
        externalCohortId: cohortIdStr || `coh-${Date.now().toString().slice(-4)}`,
        name: cohort?.name || `${instructorCourse.name} - Cohort 1`,
        course: instructorCourse._id,
        instructor: instUser?._id,
        startDate: cohort?.startDate ? new Date(cohort.startDate) : new Date(),
        endDate: cohort?.endDate ? new Date(cohort.endDate) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'active',
      });
    } else if (instUser && String(instructorCohort.instructor) !== String(instUser._id)) {
      instructorCohort.instructor = instUser._id;
      await instructorCohort.save();
    }

    // 5. Upsert EnrollmentReference in Instructor DB
    const normalizedStatus = ['Confirmed', 'Active', 'active', 'COMPLETED', 'Completed'].includes(status)
      ? 'active'
      : status.toLowerCase();

    const enrollmentRef = await I.EnrollmentReference.findOneAndUpdate(
      { student: studentRef._id, cohort: instructorCohort._id },
      {
        $set: {
          course: instructorCourse._id,
          status: normalizedStatus,
          externalEnrollmentId: (enrollmentId || '').toString(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 6. Ensure Student User & Profile in Admin DB (esa_academy)
    let adminSynced = false;
    let adminError = null;
    let adminEnrollment = null;
    try {
      const adminUser = await A.User.findOneAndUpdate(
        { email: studentEmail },
        {
          $setOnInsert: {
            fullName: studentName,
            email: studentEmail,
            role: 'STUDENT',
            division: adminCourse?.division || 'UNIVERSITY',
            isActive: true,
          },
        },
        { upsert: true, new: true }
      );

      await A.StudentProfile.findOneAndUpdate(
        { user: adminUser._id },
        {
          $setOnInsert: {
            user: adminUser._id,
            division: adminCourse?.division || 'UNIVERSITY',
            academicLevel: 'Undergraduate',
          },
        },
        { upsert: true }
      );

      // Ensure Admin Application and Enrollment record exist
      if (adminCourse) {
        let adminApp = await A.Application.findOne({ student: adminUser._id, program: adminCourse._id });
        if (!adminApp) {
          adminApp = await A.Application.create({
            student: adminUser._id,
            program: adminCourse._id,
            division: adminCourse.division || 'UNIVERSITY',
            status: 'CONFIRMED',
            submittedAt: new Date(),
            decision: 'ACCEPT',
          });
        } else if (adminApp.status !== 'CONFIRMED') {
          adminApp.status = 'CONFIRMED';
          adminApp.decision = 'ACCEPT';
          await adminApp.save();
        }

        let adminCohort = await A.Cohort.findOne({ program: adminCourse._id });
        if (!adminCohort) {
          const cCode = (adminCourse.code || courseIdStr.slice(-4)).toUpperCase();
          const cohortNumber = `COH-${cCode}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`;
          adminCohort = await A.Cohort.create({
            cohortNumber,
            name: `${adminCourse.title} - Cohort 1`,
            program: adminCourse._id,
            instructor: adminInstId || adminUser._id,
            division: adminCourse.division,
            capacity: adminCourse.capacity || 25,
            startDate: adminCourse.startDate || new Date(),
            endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            status: 'SCHEDULED',
            createdBy: adminUser._id,
          });
        }

        adminEnrollment = await A.Enrollment.findOneAndUpdate(
          { student: adminUser._id, program: adminCourse._id },
          {
            $set: {
              application: adminApp._id,
              student: adminUser._id,
              program: adminCourse._id,
              division: adminCourse.division || 'UNIVERSITY',
              cohort: adminCohort._id,
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
            $setOnInsert: {
              enrolledAt: new Date(),
              createdBy: adminUser._id,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Update occupiedSeats on admin course
        const confirmedAdminCount = await A.Enrollment.countDocuments({
          program: adminCourse._id,
          status: { $in: ['CONFIRMED', 'ACTIVE'] },
        });
        await A.Course.updateOne({ _id: adminCourse._id }, { $set: { occupiedSeats: confirmedAdminCount } });
      }

      adminSynced = true;
    } catch (adminErr) {
      adminError = adminErr.message;
      console.warn('[UNIFIED SYNC] Admin user/enrollment mirror notice:', adminErr.message);
    }

    // 7. Update Student DB Course seatsTaken & instructor name if needed
    if (courseIdStr && mongoose.Types.ObjectId.isValid(courseIdStr)) {
      try {
        const sConfirmedCount = await S.Enrollment.countDocuments({
          course: courseIdStr,
          status: { $in: ['Confirmed', 'Active'] },
        });
        const updateDoc = { seatsTaken: sConfirmedCount };
        if (instUser?.name) {
          updateDoc.instructor = instUser.name;
          updateDoc.assignedInstructorId = instUser._id.toString();
          updateDoc.instructorEmail = instUser.email;
        }
        await S.Course.updateOne({ _id: courseIdStr }, { $set: updateDoc });
      } catch (_) {}
    }

    return {
      success: true,
      partial: !adminSynced,
      syncedPools: { instructor: true, admin: adminSynced, student: true },
      adminWarning: adminError,
      studentId: studentIdStr,
      courseId: courseIdStr,
      instructorId: instUser?._id?.toString(),
      instructorEmail: instUser?.email,
      instructorName: instUser?.name,
      studentRefId: studentRef._id,
      cohortId: instructorCohort._id,
      enrollmentRefId: enrollmentRef._id,
      adminEnrollmentId: adminEnrollment?._id,
      status: 'Confirmed',
    };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync enrollment:', err.message);
    return { success: false, error: err.message };
  }
}

async function syncAttendanceFromInstructor({ instructorId, sessionId, records }) {
  try {
    const { student: S, instructor: I, admin: A } = getModels();

    // 1. Load instructor session & cohort
    const session = await I.Session.findById(sessionId).populate('cohort').lean();
    if (!session) return { success: false, reason: 'Session not found in instructor DB' };

    const instructorCohort = session.cohort;
    const sessionDate = session.date ? new Date(session.date) : new Date();

    // 2. Find or create matching TrainingSession in Student DB (egsa_academy)
    let studentCohort = null;
    if (instructorCohort.externalCohortId && mongoose.Types.ObjectId.isValid(instructorCohort.externalCohortId)) {
      studentCohort = await S.Cohort.findById(instructorCohort.externalCohortId).lean();
    }
    if (!studentCohort) {
      studentCohort = await S.Cohort.findOne({ name: instructorCohort.name }).lean();
    }
    if (!studentCohort) {
      // Find course
      const firstCourse = await S.Course.findOne().lean();
      studentCohort = await S.Cohort.create({
        name: instructorCohort.name,
        course: firstCourse?._id,
        startDate: sessionDate,
        endDate: new Date(sessionDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'InProgress',
      });
    }

    let studentSession = await S.TrainingSession.findOne({
      cohort: studentCohort._id,
      $or: [
        { sessionNumber: session.sessionNumber },
        { title: session.title },
      ],
    });

    if (!studentSession) {
      studentSession = await S.TrainingSession.create({
        cohort: studentCohort._id,
        course: studentCohort.course,
        sessionNumber: session.sessionNumber || 1,
        title: session.title || `Session ${session.sessionNumber || 1}`,
        description: session.description || 'Hands-on Training Session',
        date: sessionDate,
        startTime: session.startTime || '10:00 AM',
        endTime: session.endTime || '12:00 PM',
        status: 'Completed',
      });
    }

    // 3. For each student record, map to student User and upsert AttendanceRecord in egsa_academy
    for (const r of records) {
      const studentRef = await I.StudentReference.findById(r.studentId).lean();
      if (!studentRef) continue;

      let studentUser = null;
      if (studentRef.externalStudentId && mongoose.Types.ObjectId.isValid(studentRef.externalStudentId)) {
        studentUser = await S.User.findById(studentRef.externalStudentId).lean();
      }
      if (!studentUser) {
        studentUser = await S.User.findOne({ email: studentRef.email }).lean();
      }
      if (!studentUser) continue;

      // Ensure Enrollment in egsa_academy
      let studentEnrollment = await S.Enrollment.findOne({
        student: studentUser._id,
        cohort: studentCohort._id,
      }).lean();

      if (!studentEnrollment) {
        studentEnrollment = await S.Enrollment.create({
          student: studentUser._id,
          course: studentCohort.course,
          cohort: studentCohort._id,
          status: 'Confirmed',
          enrolledAt: new Date(),
        });
      }

      // Map status enum
      const isLate = r.subStatus === 'late' || r.isLate === true || r.status === 'late';
      const isExcused = r.subStatus === 'excused' || r.excused === true || r.status === 'excused';

      let mappedStatus = 'Present';
      if (isLate) mappedStatus = 'Late';
      else if (isExcused) mappedStatus = 'Excused';
      else if (r.status === 'absent' || r.status === 'Absent') mappedStatus = 'Absent';

      await S.AttendanceRecord.findOneAndUpdate(
        { session: studentSession._id, student: studentUser._id },
        {
          $set: {
            enrollment: studentEnrollment._id,
            course: studentCohort.course,
            cohort: studentCohort._id,
            status: mappedStatus,
            checkInTime: new Date(),
            checkInMethod: 'Manual_Instructor',
            notes: r.notes || '',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // 4. Sync into Admin DB (esa_academy) attendance collection for institutional reports
    let adminSynced = false;
    let adminError = null;
    try {
      const adminRecords = [];
      for (const r of records) {
        const studentRef = await I.StudentReference.findById(r.studentId).lean();
        if (!studentRef) continue;
        const adminUser = await A.User.findOne({ email: studentRef.email }).lean();
        if (!adminUser) continue;

        const isLate = r.subStatus === 'late' || r.isLate === true || r.status === 'late';
        const isExcused = r.subStatus === 'excused' || r.excused === true || r.status === 'excused';
        let aStatus = 'PRESENT';
        if (isLate) aStatus = 'LATE';
        else if (isExcused) aStatus = 'EXCUSED';
        else if (r.status === 'absent' || r.status === 'Absent') aStatus = 'ABSENT';

        adminRecords.push({
          student: adminUser._id,
          status: aStatus,
          markedAt: new Date(),
          notes: r.notes || '',
        });
      }

      let adminCohort = null;
      if (instructorCohort.externalCohortId && mongoose.Types.ObjectId.isValid(instructorCohort.externalCohortId)) {
        adminCohort = await A.Cohort.findById(instructorCohort.externalCohortId).lean();
      }
      if (!adminCohort) {
        adminCohort = await A.Cohort.findOne({ name: instructorCohort.name }).lean();
      }

      if (adminCohort) {
        await A.Attendance.findOneAndUpdate(
          { cohort: adminCohort._id, sessionNumber: session.sessionNumber || 1 },
          {
            $set: {
              sessionDate: sessionDate,
              sessionTopic: session.title || `Session ${session.sessionNumber || 1}`,
              records: adminRecords,
            },
          },
          { upsert: true }
        );
        adminSynced = true;
      }
    } catch (adminErr) {
      adminError = adminErr.message;
      console.warn('[UNIFIED SYNC] Admin attendance sync notice:', adminErr.message);
    }

    return {
      success: true,
      partial: !adminSynced,
      syncedPools: { instructor: true, student: true, admin: adminSynced },
      adminWarning: adminError,
    };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync attendance from instructor:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Synchronize Assessment Submission from Student Portal into Instructor review queue.
 */
async function syncSubmissionFromStudent({ studentUser, assessment, submission, filePayload, textAnswer }) {
  try {
    const { student: S, instructor: I } = getModels();

    const studentIdStr = studentUser._id.toString();
    const assessmentIdStr = assessment._id.toString();

    // 1. Ensure StudentReference in Instructor DB
    const studentRef = await I.StudentReference.findOneAndUpdate(
      { externalStudentId: studentIdStr },
      { $set: { name: studentUser.fullName, email: studentUser.email.toLowerCase().trim() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Resolve matching Assessment in Instructor DB
    let instAssessment = await I.Assessment.findOne({
      $or: [
        { externalAssessmentId: assessmentIdStr },
        { title: assessment.title },
      ],
    });

    if (!instAssessment) {
      // Find or sync instructor cohort
      const cohortIdStr = (assessment.cohort?._id || assessment.cohort)?.toString();
      let instCohort = null;
      if (cohortIdStr) {
        instCohort = await I.Cohort.findOne({
          $or: [
            { externalCohortId: cohortIdStr },
            { _id: mongoose.Types.ObjectId.isValid(cohortIdStr) ? cohortIdStr : null },
          ],
        });
      }
      if (!instCohort) {
        instCohort = await I.Cohort.findOne();
      }

      const activeInst = await I.User.findOne({ role: 'instructor' });

      instAssessment = await I.Assessment.create({
        externalAssessmentId: assessmentIdStr,
        title: assessment.title,
        description: assessment.description || '',
        instructions: assessment.instructions || '',
        course: instCohort?.course,
        cohort: instCohort?._id,
        dueDate: assessment.dueDate || assessment.assessmentDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'published',
        publishedAt: new Date(),
        createdBy: activeInst?._id,
      });
    }

    // 3. Ensure student is actively enrolled in Instructor DB
    await I.EnrollmentReference.findOneAndUpdate(
      { student: studentRef._id, cohort: instAssessment.cohort },
      { $set: { course: instAssessment.course, status: 'active' } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // 4. Format attachments
    const attachments = [];
    if (filePayload) {
      attachments.push({
        name: filePayload.originalName || filePayload.fileName,
        url: filePayload.fileUrl,
      });
    }

    // 5. Upsert AssessmentSubmission in Instructor DB
    const instSub = await I.AssessmentSubmission.findOneAndUpdate(
      { assessment: instAssessment._id, student: studentRef._id },
      {
        $set: {
          cohort: instAssessment.cohort,
          content: textAnswer || (filePayload ? `File upload: ${filePayload.originalName}` : 'Student work submitted.'),
          attachments,
          externalSubmissionId: submission._id.toString(),
          submittedAt: submission.submittedAt || new Date(),
          status: 'submitted',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 6. Notify instructor (idempotent upsert to avoid duplicate notifications on retry)
    try {
      const cohortDoc = await I.Cohort.findById(instAssessment.cohort).select('instructor').lean();
      const instructorId = instAssessment.createdBy || cohortDoc?.instructor;

      if (instructorId) {
        const studentDisplayName = studentUser.fullName || studentUser.name || 'Cadet';
        const notifTitle = 'New Assignment Submission';
        const notifMessage = `${studentDisplayName} submitted "${assessment.title}".`;
        const link = `/instructor/submissions/${instSub._id}`;

        const notif = await I.Notification.findOneAndUpdate(
          { user: instructorId, dedupeKey: `submission:${instSub._id}` },
          {
            $set: {
              user: instructorId,
              type: 'new_submission',
              title: notifTitle,
              message: notifMessage,
              link,
              dedupeKey: `submission:${instSub._id}`,
              read: false,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Real-time Socket.IO emission to instructor rooms
        try {
          const { getIO } = require('../../socket');
          const io = getIO();
          if (io) {
            const payload = {
              id: notif?._id,
              type: 'new_submission',
              title: notifTitle,
              message: notifMessage,
              link,
              submissionId: instSub._id,
              assessmentId: instAssessment._id,
              studentName: studentDisplayName,
              createdAt: new Date(),
            };
            io.to(`user:${instructorId}`).emit('notification:new', payload);
            io.to(`user:instructor:${instructorId}`).emit('notification:new', payload);
            io.to(`user:${instructorId}`).emit('submission:new', payload);
            io.to(`user:instructor:${instructorId}`).emit('submission:new', payload);
          }
        } catch (sockErr) {
          console.warn('[UNIFIED SYNC] Socket emission to instructor notice:', sockErr.message);
        }
      }
    } catch (notifErr) {
      console.warn('[UNIFIED SYNC] Failed to notify instructor of submission:', notifErr.message);
    }

    return { success: true, instructorSubmissionId: instSub._id };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync student submission:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 4. Synchronize Grade & Published Result from Instructor Portal into Student Portal.
 */
async function syncGradeFromInstructor({ submissionId, resultDoc }) {
  try {
    const { student: S, instructor: I } = getModels();

    // 1. Resolve instructor submission & student reference
    const instSub = await I.AssessmentSubmission.findById(submissionId).populate('student assessment').lean();
    if (!instSub) return { success: false, reason: 'Instructor submission not found' };

    const studentRef = instSub.student;
    if (!studentRef) return { success: false, reason: 'Student reference not found' };

    // 2. Find Student User in egsa_academy
    let studentUser = null;
    if (studentRef.externalStudentId && mongoose.Types.ObjectId.isValid(studentRef.externalStudentId)) {
      studentUser = await S.User.findById(studentRef.externalStudentId).lean();
    }
    if (!studentUser) {
      studentUser = await S.User.findOne({ email: studentRef.email }).lean();
    }
    if (!studentUser) return { success: false, reason: 'Student user not found in student DB' };

    // 3. Find matching Assessment in egsa_academy
    const instAssessment = instSub.assessment;
    let studentAssessment = null;
    if (instAssessment?.externalAssessmentId && mongoose.Types.ObjectId.isValid(instAssessment.externalAssessmentId)) {
      studentAssessment = await S.Assessment.findById(instAssessment.externalAssessmentId).lean();
    }
    if (!studentAssessment && instAssessment?.title) {
      studentAssessment = await S.Assessment.findOne({ title: instAssessment.title }).lean();
    }
    if (!studentAssessment) {
      // Find first available student assessment
      studentAssessment = await S.Assessment.findOne().lean();
    }
    if (!studentAssessment) return { success: false, reason: 'No student assessment found' };

    // 4. Resolve Student Submission & Enrollment in egsa_academy
    let studentSubmission = null;
    if (instSub.externalSubmissionId && mongoose.Types.ObjectId.isValid(instSub.externalSubmissionId)) {
      studentSubmission = await S.StudentSubmission.findById(instSub.externalSubmissionId);
    }
    if (!studentSubmission) {
      studentSubmission = await S.StudentSubmission.findOne({
        assessment: studentAssessment._id,
        student: studentUser._id,
      });
    }

    let studentEnrollment = await S.Enrollment.findOne({
      student: studentUser._id,
      cohort: studentAssessment.cohort,
    }).lean();

    if (!studentEnrollment) {
      studentEnrollment = await S.Enrollment.findOne({ student: studentUser._id }).lean();
    }

    const maxScore = studentAssessment.maxScore || 100;
    const passingScore = studentAssessment.passingScore || 70;
    const score = Number(resultDoc.score) || 0;
    const percentage = Math.round((score / maxScore) * 100);
    const isPublished = resultDoc.status === 'published';
    const resultLabel = score >= passingScore ? 'Passed' : 'Failed';

    // 5. Find instructor in student DB to attribute grading
    let instFacultyUser = await S.User.findOne({ role: 'instructor' });
    if (!instFacultyUser) {
      instFacultyUser = await S.User.findOne({ role: 'admin' });
    }

    // 6. Upsert AssessmentResult in egsa_academy
    const studentResult = await S.AssessmentResult.findOneAndUpdate(
      { assessment: studentAssessment._id, student: studentUser._id },
      {
        $set: {
          submission: studentSubmission?._id,
          enrollment: studentEnrollment?._id,
          instructor: instFacultyUser?._id,
          course: studentAssessment.course,
          cohort: studentAssessment.cohort,
          score,
          maxScore,
          percentage,
          status: isPublished ? 'Published' : 'Draft',
          resultLabel,
          feedback: resultDoc.feedback || '',
          strengths: resultDoc.strengths || '',
          improvementAreas: resultDoc.improvements || '',
          evaluatedAt: resultDoc.evaluatedAt || new Date(),
          publishedAt: isPublished ? (resultDoc.publishedAt || new Date()) : undefined,
          publishedBy: isPublished ? instFacultyUser?._id : undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 7. If published, notify student (idempotent upsert to avoid duplicate notifications on retry)
    if (isPublished) {
      try {
        const notifTitle = `Assessment Evaluated: ${studentAssessment.title}`;
        const notifMessage = `Your score for "${studentAssessment.title}" is ${score}/${maxScore} (${percentage}% - ${resultLabel}). Feedback: "${resultDoc.feedback || 'Good job!'}"`;

        const notif = await S.Notification.findOneAndUpdate(
          { recipient: studentUser._id, title: notifTitle },
          {
            $set: {
              title: notifTitle,
              message: notifMessage,
              type: resultLabel === 'Passed' ? 'success' : 'warning',
              recipient: studentUser._id,
              relatedCourse: studentAssessment.course,
              isRead: false,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Update studentSubmission status to Evaluated if present
        if (studentSubmission && studentSubmission.status !== 'Evaluated') {
          studentSubmission.status = 'Evaluated';
          await studentSubmission.save();
        }

        // Real-time Socket.IO emission to student room
        try {
          const { getIO } = require('../../socket');
          const io = getIO();
          if (io) {
            const studentIdStr = studentUser._id.toString();
            const payload = {
              id: notif?._id,
              title: notifTitle,
              message: notifMessage,
              type: resultLabel === 'Passed' ? 'success' : 'warning',
              relatedCourse: studentAssessment.course,
              assessmentId: studentAssessment._id,
              score,
              maxScore,
              percentage,
              resultLabel,
              feedback: resultDoc.feedback || '',
              createdAt: new Date(),
            };
            io.to(`user:${studentIdStr}`).emit('notification:new', payload);
            io.to(`user:student:${studentIdStr}`).emit('notification:new', payload);
            io.to(`user:${studentIdStr}`).emit('submission:graded', payload);
            io.to(`user:student:${studentIdStr}`).emit('submission:graded', payload);
          }
        } catch (sockErr) {
          console.warn('[UNIFIED SYNC] Socket emission to student notice:', sockErr.message);
        }
      } catch (notifErr) {
        console.warn('[UNIFIED SYNC] Failed to notify student of grade:', notifErr.message);
      }
    }

    return { success: true, studentResultId: studentResult._id };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync grade from instructor:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 4b. Synchronize Assessment created or published by Instructor into Student DB (egsa_academy).
 * Creates persistent notifications for enrolled students and emits Socket.IO real-time events.
 */
async function syncAssessmentFromInstructor({ instructorId, assessmentDoc }) {
  try {
    const { student: S, instructor: I } = getModels();

    if (!assessmentDoc) return { success: false, reason: 'No assessment doc provided' };

    // 1. Resolve instructor details
    let instUser = null;
    if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) {
      instUser = await I.User.findById(instructorId).lean();
    }
    if (!instUser && assessmentDoc.createdBy) {
      instUser = await I.User.findById(assessmentDoc.createdBy).lean();
    }
    const instructorName = instUser?.name || 'EGSA Faculty';

    // 2. Resolve cohort & course in instructor DB
    const instCohort = assessmentDoc.cohort ? await I.Cohort.findById(assessmentDoc.cohort).lean() : null;
    const instCourse = assessmentDoc.course ? await I.Course.findById(assessmentDoc.course).lean() : null;

    // 3. Resolve matching Cohort & Course in Student DB (egsa_academy)
    let studentCohort = null;
    if (instCohort?.externalCohortId && mongoose.Types.ObjectId.isValid(instCohort.externalCohortId)) {
      studentCohort = await S.Cohort.findById(instCohort.externalCohortId);
    }
    if (!studentCohort && instCohort?.name) {
      studentCohort = await S.Cohort.findOne({ name: instCohort.name });
    }

    let studentCourse = null;
    if (instCourse?.externalCourseId && mongoose.Types.ObjectId.isValid(instCourse.externalCourseId)) {
      studentCourse = await S.Course.findById(instCourse.externalCourseId);
    }
    if (!studentCourse && studentCohort?.course) {
      studentCourse = await S.Course.findById(studentCohort.course);
    }
    if (!studentCourse && instCourse?.name) {
      studentCourse = await S.Course.findOne({ title: instCourse.name });
    }
    if (!studentCourse) {
      studentCourse = await S.Course.findOne();
    }

    if (!studentCohort && studentCourse) {
      studentCohort = await S.Cohort.findOne({ course: studentCourse._id });
      if (!studentCohort) {
        studentCohort = await S.Cohort.create({
          name: instCohort?.name || `${studentCourse.title} - Cohort 1`,
          course: studentCourse._id,
          startDate: instCohort?.startDate || new Date(),
          endDate: instCohort?.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          status: 'InProgress',
        });
      }
    }

    if (!studentCourse || !studentCohort) {
      return { success: false, reason: 'Failed to resolve course or cohort in student database' };
    }

    // 4. Resolve instructor user in student DB
    let studentFacultyUser = null;
    if (instUser?.email) {
      studentFacultyUser = await S.User.findOne({ email: instUser.email.toLowerCase().trim() });
    }
    if (!studentFacultyUser) {
      studentFacultyUser = await S.User.findOne({ role: 'instructor' });
    }

    // 5. Format attachments for student schema
    const attachments = (assessmentDoc.attachments || []).map((att) => {
      const url = att.url || '';
      const basename = url.split(/[\\/]/).pop() || att.name || 'attachment';
      return {
        fileName: basename,
        originalName: att.name || basename,
        fileUrl: url,
        mimeType: 'application/octet-stream',
        uploadedAt: new Date(),
      };
    });

    const isPublished = assessmentDoc.status === 'published';
    const maxScore = assessmentDoc.gradingConfig?.maxScore || 100;
    const passingScore = Math.round(maxScore * 0.7);

    // 6. Find or upsert Student Assessment in egsa_academy
    let studentAssessment = await S.Assessment.findOne({
      $or: [
        { externalAssessmentId: assessmentDoc._id.toString() },
        { title: assessmentDoc.title, cohort: studentCohort._id },
      ],
    });

    if (studentAssessment) {
      studentAssessment.title = assessmentDoc.title;
      studentAssessment.description = assessmentDoc.description || '';
      studentAssessment.instructions = assessmentDoc.instructions || '';
      studentAssessment.maxScore = maxScore;
      studentAssessment.passingScore = passingScore;
      studentAssessment.dueDate = assessmentDoc.dueDate || studentAssessment.dueDate;
      studentAssessment.status = isPublished ? 'Scheduled' : 'Draft';
      studentAssessment.instructorName = instructorName;
      if (attachments.length > 0) {
        studentAssessment.attachments = attachments;
      }
      studentAssessment.externalAssessmentId = assessmentDoc._id.toString();
      await studentAssessment.save();
    } else {
      studentAssessment = await S.Assessment.create({
        externalAssessmentId: assessmentDoc._id.toString(),
        title: assessmentDoc.title,
        description: assessmentDoc.description || '',
        instructions: assessmentDoc.instructions || '',
        type: 'Technical Assessment',
        course: studentCourse._id,
        cohort: studentCohort._id,
        instructor: studentFacultyUser?._id,
        instructorName,
        maxScore,
        passingScore,
        weight: 25,
        status: isPublished ? 'Scheduled' : 'Draft',
        dueDate: assessmentDoc.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assessmentDate: assessmentDoc.startDate || new Date(),
        attachments,
        submissionType: 'both',
        allowLateSubmission: true,
        allowResubmission: true,
      });
    }

    // 7. If published, notify all active enrolled students
    if (isPublished) {
      const enrollments = await S.Enrollment.find({
        $or: [{ cohort: studentCohort._id }, { course: studentCourse._id }],
        status: { $in: ['Active', 'Confirmed', 'Completed'] },
      }).select('student course');

      const dueDateStr = assessmentDoc.dueDate
        ? new Date(assessmentDoc.dueDate).toLocaleDateString()
        : 'TBA';

      let io = null;
      try {
        const { getIO } = require('../../socket');
        io = getIO();
      } catch (_) {}

      for (const enr of enrollments) {
        if (!enr.student) continue;
        const studentIdStr = enr.student.toString();

        const notifTitle = `New Assignment: ${assessmentDoc.title}`;
        const notifMessage = `A new assignment "${assessmentDoc.title}" has been published by ${instructorName}. Due date: ${dueDateStr}.`;

        const notifDoc = await S.Notification.findOneAndUpdate(
          { recipient: enr.student, title: notifTitle },
          {
            $set: {
              title: notifTitle,
              message: notifMessage,
              type: 'info',
              recipient: enr.student,
              relatedCourse: studentCourse._id,
              isRead: false,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (io) {
          try {
            const payload = {
              id: notifDoc?._id,
              title: notifTitle,
              message: notifMessage,
              type: 'info',
              relatedCourse: studentCourse._id,
              assessmentId: studentAssessment._id,
              createdAt: new Date(),
            };
            io.to(`user:${studentIdStr}`).emit('notification:new', payload);
            io.to(`user:student:${studentIdStr}`).emit('notification:new', payload);
            io.to(`user:${studentIdStr}`).emit('assignment:published', {
              assessmentId: studentAssessment._id,
              title: assessmentDoc.title,
              courseId: studentCourse._id,
              dueDate: assessmentDoc.dueDate,
            });
            io.to(`user:student:${studentIdStr}`).emit('assignment:published', {
              assessmentId: studentAssessment._id,
              title: assessmentDoc.title,
              courseId: studentCourse._id,
              dueDate: assessmentDoc.dueDate,
            });
          } catch (sockErr) {
            console.warn('[UNIFIED SYNC] Socket error notifying student:', sockErr.message);
          }
        }
      }
    }

    return { success: true, studentAssessmentId: studentAssessment._id };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync assessment from instructor:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 5. Synchronize Cohort creation or Instructor Assignment across all three databases.
 */
async function syncCohortAndInstructor({ cohortId, cohortName, courseId, instructorId, startDate, endDate, status, division }) {
  try {
    const { student: S, instructor: I, admin: A } = getModels();

    // 1. Resolve Admin cohort
    let adminCohort = null;
    if (cohortId && mongoose.Types.ObjectId.isValid(cohortId)) {
      adminCohort = await A.Cohort.findById(cohortId).populate('program instructor').lean();
    }
    const name = cohortName || adminCohort?.name || `Cohort-${(cohortId || Date.now().toString()).slice(-4)}`;
    const start = startDate ? new Date(startDate) : (adminCohort?.startDate || new Date());
    const end = endDate ? new Date(endDate) : (adminCohort?.endDate || new Date(Date.now() + 60 * 24 * 60 * 1000));

    // 2. Resolve Instructor in Instructor DB
    let instUser = null;
    if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) {
      instUser = await I.User.findOne({ externalId: instructorId.toString() });
      if (!instUser) {
        const adminInst = await A.User.findById(instructorId).lean();
        if (adminInst) {
          instUser = await I.User.findOne({ email: adminInst.email.toLowerCase().trim() });
        }
      }
    }
    if (!instUser) {
      instUser = await I.User.findOne({ role: 'instructor' });
    }

    // 3. Resolve or create Course in Instructor DB
    let instCourse = await I.Course.findOne({
      $or: [
        { externalCourseId: (courseId || '').toString() },
        { name: adminCohort?.program?.title },
      ],
    });
    if (!instCourse) {
      instCourse = await I.Course.create({
        externalCourseId: (courseId || '').toString(),
        code: `CRS-${Date.now().toString().slice(-4)}`,
        name: adminCohort?.program?.title || 'Space Systems Training',
        status: 'active',
      });
    }

    // 4. Upsert Cohort in Instructor DB
    const instCohort = await I.Cohort.findOneAndUpdate(
      {
        $or: [
          { externalCohortId: (cohortId || '').toString() },
          { name },
        ],
      },
      {
        $set: {
          externalCohortId: (cohortId || '').toString(),
          name,
          course: instCourse._id,
          instructor: instUser?._id,
          startDate: start,
          endDate: end,
          status: 'active',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Upsert Cohort in Student DB
    let studentCourse = null;
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      studentCourse = await S.Course.findById(courseId).lean();
    }
    if (!studentCourse) {
      studentCourse = await S.Course.findOne({ title: adminCohort?.program?.title || instCourse.name }).lean();
    }
    if (!studentCourse) {
      studentCourse = await S.Course.findOne().lean();
    }

    if (studentCourse) {
      await S.Cohort.findOneAndUpdate(
        {
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(cohortId) ? cohortId : null },
            { course: studentCourse._id, name },
          ],
        },
        {
          $set: {
            course: studentCourse._id,
            name,
            startDate: start,
            endDate: end,
            status: 'Scheduled',
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    const studentSynced = Boolean(studentCourse);
    return {
      success: studentSynced,
      partial: !studentSynced,
      syncedPools: { admin: true, instructor: true, student: studentSynced },
      instructorCohortId: instCohort._id,
    };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync cohort/instructor assignment:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 6. Synchronize a newly registered student to Admin DB (esa_academy) and Instructor StudentReference.
 */
async function syncStudentRegistration({ user, division = 'UNIVERSITY', profile = {} }) {
  try {
    const { instructor: I, admin: A } = getModels();
    const studentIdStr = (user?._id || user?.id || user)?.toString();
    const studentName = user.fullName || user.name || 'Academy Student';
    const studentEmail = (user.email || '').toLowerCase().trim();

    if (!studentEmail) return { success: false, reason: 'Missing email' };

    // Mirror to Instructor StudentReference
    if (studentIdStr) {
      await I.StudentReference.findOneAndUpdate(
        { externalStudentId: studentIdStr },
        { $set: { name: studentName, email: studentEmail } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Mirror to Admin DB (esa_academy)
    const adminUser = await A.User.findOneAndUpdate(
      { email: studentEmail },
      {
        $set: {
          fullName: studentName,
          email: studentEmail,
          role: 'STUDENT',
          division,
          isActive: user.isActive !== false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await A.StudentProfile.findOneAndUpdate(
      { user: adminUser._id },
      {
        $set: {
          user: adminUser._id,
          division,
          phone: user.phone || profile.phone || '',
          nationalId: user.nationalId || profile.nationalId || '',
          institution: profile.institution || profile.university || '',
          educationLevel: profile.educationLevel || '',
          academicYear: profile.academicYear || '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return { success: true, adminUserId: adminUser._id };
  } catch (err) {
    console.warn('[UNIFIED SYNC] syncStudentRegistration notice:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 7. Synchronize all authoritative courses from Student DB (egsa_academy)
 * into Admin DB (esa_academy) with matching _id, ensuring consistent program catalog.
 */
async function syncAuthoritativeCoursesToAdmin() {
  try {
    const { student: S, admin: A } = getModels();
    const studentCourses = await S.Course.find({}).lean();
    let count = 0;

    let adminUser = await A.User.findOne({ role: 'SUPER_ADMIN' }).lean();
    const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId('65f000000000000000000001');

    for (const sc of studentCourses) {
      const isPreUni = sc.division === 'PRE_UNIVERSITY' ||
        (sc.category && (sc.category.toLowerCase().includes('junior') || sc.category.toLowerCase().includes('school')));
      const division = isPreUni ? 'PRE_UNIVERSITY' : 'UNIVERSITY';
      const level = sc.levelTier === 1 ? 'BEGINNER' : (sc.levelTier === 2 ? 'INTERMEDIATE' : 'ADVANCED');
      const deliveryMode = ['ONSITE', 'ONLINE', 'HYBRID'].includes((sc.deliveryMode || '').toUpperCase())
        ? (sc.deliveryMode || '').toUpperCase()
        : 'ONSITE';
      const status = sc.isActive === false ? 'ARCHIVED' : (sc.published ? 'ACTIVE' : 'DRAFT');

      await A.Course.findOneAndUpdate(
        { _id: sc._id },
        {
          $set: {
            title: sc.title,
            description: sc.overview || sc.shortDescription || sc.tagline || 'EGSA accredited space training program',
            division,
            level,
            category: sc.category || '',
            price: sc.price ?? 0,
            capacity: sc.capacity ?? 25,
            occupiedSeats: sc.seatsTaken ?? 0,
            deliveryMode,
            status,
            isArchived: sc.isActive === false || sc.status === 'Archived',
            startDate: sc.startDate,
            registrationStartDate: sc.applicationOpenDate,
            registrationEndDate: sc.applicationCloseDate,
            updatedBy: systemAdminId,
          },
          $setOnInsert: {
            _id: sc._id,
            createdBy: systemAdminId,
            createdAt: sc.createdAt || new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      count++;
    }
    return { success: true, count };
  } catch (err) {
    console.error('[UNIFIED SYNC] syncAuthoritativeCoursesToAdmin error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 8. Synchronize a program created or updated by Admin into Student DB (egsa_academy).
 */
async function syncProgramFromAdmin(adminProgram) {
  try {
    const { student: S } = getModels();
    const progId = adminProgram._id;
    if (!progId) return { success: false, reason: 'Missing program ID' };

    const levelTier = adminProgram.level === 'BEGINNER' ? 1 : (adminProgram.level === 'INTERMEDIATE' ? 2 : 3);
    const levelLabels = S.Course.LEVEL_LABELS || [
      'Awareness / Fundamentals',
      'Core Skills',
      'Specialization/Integration/Applications',
      'Professional/Industry',
    ];
    const level = levelLabels[levelTier - 1] || 'Core Skills';

    const deliveryMode = adminProgram.deliveryMode === 'ONLINE' ? 'Online' : (adminProgram.deliveryMode === 'HYBRID' ? 'Hybrid' : 'Onsite');
    const isActive = adminProgram.status !== 'ARCHIVED' && !adminProgram.isArchived;
    const isProgramOpen = adminProgram.status === 'ACTIVE' || adminProgram.status === 'PUBLISHED';
    const published = isProgramOpen;

    const slug = (adminProgram.title || 'course')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + `-${progId.toString().slice(-4)}`;

    // Resolve instructor name and details if assigned
    let instructorName = 'TBD';
    let assignedInstructorId = '';
    let instructorEmail = '';
    const { admin: A } = getModels();
    const instId = adminProgram.assignedInstructor || (adminProgram.assignedInstructors && adminProgram.assignedInstructors[0]);
    if (instId) {
      try {
        const adminInst = await A.User.findById(instId).lean();
        if (adminInst) {
          instructorName = adminInst.fullName;
          assignedInstructorId = adminInst._id.toString();
          instructorEmail = adminInst.email;
        }
      } catch (_) {}
    }

    await S.Course.findOneAndUpdate(
      { _id: progId },
      {
        $set: {
          instructor: instructorName,
          assignedInstructorId,
          instructorEmail,
          title: adminProgram.title,
          tagline: adminProgram.title,
          overview: adminProgram.description || '',
          shortDescription: adminProgram.description ? adminProgram.description.slice(0, 160) : '',
          division: adminProgram.division,
          level,
          levelTier,
          category: adminProgram.category || 'Space Technologies',
          price: adminProgram.price ?? 0,
          capacity: adminProgram.capacity ?? 25,
          seatsTaken: adminProgram.occupiedSeats ?? 0,
          deliveryMode,
          status: isProgramOpen ? 'Open' : (adminProgram.status === 'ARCHIVED' ? 'Archived' : 'Draft'),
          published,
          isActive,
          active: isActive,
          startDate: adminProgram.startDate,
          applicationOpenDate: adminProgram.registrationStartDate,
          applicationCloseDate: adminProgram.registrationEndDate,
        },
        $setOnInsert: {
          _id: progId,
          slug,
          minReadinessScore: 60,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (instId) {
      try {
        await syncCourseInstructorAssignment({ courseId: progId, instructorId: instId });
      } catch (_) {}
    }
    return { success: true, courseId: progId };
  } catch (err) {
    console.error('[UNIFIED SYNC] syncProgramFromAdmin error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 9. Synchronize an application submitted by a student to Admin DB (esa_academy).
 */
async function syncApplicationFromStudent(studentApp) {
  try {
    const { student: S, admin: A } = getModels();
    const studentAppId = studentApp._id;
    if (!studentAppId) return { success: false, reason: 'Missing application ID' };

    // 1. Resolve Student User in egsa_academy
    let studentUser = studentApp.student;
    if (!studentUser?.email) {
      studentUser = await S.User.findById(studentApp.student).lean();
    }
    if (!studentUser) return { success: false, reason: 'Student user not found' };

    // 2. Ensure student exists in Admin DB
    let adminUser = await A.User.findOne({ email: studentUser.email.toLowerCase().trim() });
    if (!adminUser) {
      await syncStudentRegistration({ user: studentUser, division: studentApp.division || 'UNIVERSITY' });
      adminUser = await A.User.findOne({ email: studentUser.email.toLowerCase().trim() });
    }
    if (!adminUser) return { success: false, reason: 'Could not resolve admin student user' };

    // 3. Resolve Course in egsa_academy and ensure in Admin DB
    let studentCourse = studentApp.course;
    if (!studentCourse?.title) {
      studentCourse = await S.Course.findById(studentApp.course).lean();
    }
    const courseId = studentCourse?._id || studentApp.course;

    let adminCourse = await A.Course.findById(courseId);
    if (!adminCourse && studentCourse) {
      await syncAuthoritativeCoursesToAdmin();
      adminCourse = await A.Course.findById(courseId);
    }

    // 4. Map Application Status
    let adminStatus = 'SUBMITTED';
    if (['Accepted', 'Eligible - Payment Pending'].includes(studentApp.status)) {
      adminStatus = 'ACCEPTED';
    } else if (['Confirmed', 'Active', 'Completed'].includes(studentApp.status)) {
      adminStatus = 'CONFIRMED';
    } else if (studentApp.status === 'Waitlisted') {
      adminStatus = 'WAITLISTED';
    } else if (studentApp.status === 'Rejected') {
      adminStatus = 'REJECTED';
    }

    const division = studentCourse?.division || adminUser.division || 'UNIVERSITY';

    const adminApp = await A.Application.findOneAndUpdate(
      { _id: studentAppId },
      {
        $set: {
          student: adminUser._id,
          program: courseId,
          division,
          status: adminStatus,
          submittedAt: studentApp.submittedAt || studentApp.createdAt || new Date(),
          eligibilityStatus: studentApp.eligibilityStatus || 'ELIGIBLE',
          decision: adminStatus === 'ACCEPTED' ? 'ACCEPT' : (adminStatus === 'REJECTED' ? 'REJECT' : null),
        },
        $setOnInsert: {
          _id: studentAppId,
          createdAt: studentApp.createdAt || new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return { success: true, adminAppId: adminApp._id };
  } catch (err) {
    console.error('[UNIFIED SYNC] syncApplicationFromStudent error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 10. Synchronize an Admin decision on an application back to Student DB (egsa_academy).
 */
async function syncDecisionFromAdmin(adminApp) {
  try {
    const { student: S } = getModels();
    const appId = adminApp._id;
    if (!appId) return { success: false, reason: 'Missing application ID' };

    const studentApp = await S.Application.findById(appId);
    if (!studentApp) return { success: false, reason: 'Student application not found' };

    const decision = adminApp.decision; // 'ACCEPT' | 'REJECT' | 'WAITLIST' | 'REQUEST_INFO'
    const beforeStatus = studentApp.status;

    if (decision === 'ACCEPT') {
      studentApp.status = 'Accepted';
      studentApp.eligibilityStatus = 'Eligible';
      studentApp.adminDecision = {
        decidedBy: adminApp.reviewedBy,
        decidedAt: adminApp.reviewedAt || new Date(),
        outcome: 'ACCEPT',
      };
      if (!Array.isArray(studentApp.statusHistory)) studentApp.statusHistory = [];
      studentApp.statusHistory.push({
        status: 'Accepted',
        note: adminApp.decisionReason || 'Admissions decision approved by Admin.',
      });
      await studentApp.save();

      // Trigger automatic seat reservation and 72h invoice generation
      const admissionService = require('../student/services/admissionService');
      await admissionService.autoAcceptAndReserveSeat({
        application: studentApp,
        studentId: studentApp.student,
        courseId: studentApp.course,
      });
    } else if (decision === 'REJECT') {
      studentApp.status = 'Rejected';
      studentApp.rejectionReason = adminApp.decisionReason || 'Application rejected by admissions committee.';
      if (!Array.isArray(studentApp.statusHistory)) studentApp.statusHistory = [];
      studentApp.statusHistory.push({
        status: 'Rejected',
        note: studentApp.rejectionReason,
      });
      await studentApp.save();
    } else if (decision === 'WAITLIST') {
      studentApp.status = 'Waitlisted';
      if (!Array.isArray(studentApp.statusHistory)) studentApp.statusHistory = [];
      studentApp.statusHistory.push({
        status: 'Waitlisted',
        note: adminApp.decisionReason || 'Placed on waitlist by admissions committee.',
      });
      await studentApp.save();
    } else if (decision === 'REQUEST_INFO') {
      studentApp.status = 'Manual Review';
      if (!Array.isArray(studentApp.statusHistory)) studentApp.statusHistory = [];
      studentApp.statusHistory.push({
        status: 'Manual Review',
        note: adminApp.decisionReason || 'Additional information requested by admissions committee.',
      });
      await studentApp.save();
    }

    return { success: true, beforeStatus, afterStatus: studentApp.status };
  } catch (err) {
    console.error('[UNIFIED SYNC] syncDecisionFromAdmin error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronize course-level instructor assignment across Admin, Instructor, and Student portals.
 */
async function syncCourseInstructorAssignment({ courseId, instructorId, user }) {
  try {
    const { student: S, instructor: I, admin: A } = getModels();
    const courseIdStr = courseId ? courseId.toString() : '';
    const instructorIdStr = instructorId ? instructorId.toString() : '';
    if (!courseIdStr || !instructorIdStr) {
      return { success: false, reason: 'courseId and instructorId required' };
    }

    // 1. Resolve Admin Course & Admin Instructor User
    const adminCourse = await A.Course.findById(courseIdStr);
    if (!adminCourse) return { success: false, reason: 'Admin course not found' };

    let adminInstructor = await A.User.findById(instructorIdStr);
    if (!adminInstructor) {
      const prof = await A.InstructorProfile.findById(instructorIdStr).populate('user');
      if (prof?.user) {
        adminInstructor = prof.user;
      }
    }
    if (!adminInstructor) return { success: false, reason: 'Admin instructor user not found' };

    // 2. Ensure Instructor in Instructor DB
    let instUser = await I.User.findOne({
      $or: [
        { externalId: instructorIdStr },
        { email: adminInstructor.email.toLowerCase().trim() },
      ],
    });

    if (!instUser) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('EgsaInstructor2026!', 10);
      instUser = await I.User.create({
        externalId: instructorIdStr,
        email: adminInstructor.email.toLowerCase().trim(),
        name: adminInstructor.fullName,
        passwordHash: hash,
        role: 'instructor',
        division: adminInstructor.division || adminCourse.division || 'UNIVERSITY',
        status: 'active',
      });
    } else {
      if (instUser.status !== 'active') {
        instUser.status = 'active';
        await instUser.save();
      }
    }

    // 3. Resolve or create Instructor Course in Instructor DB
    let instCourse = await I.Course.findOne({
      $or: [
        { externalCourseId: courseIdStr },
        { name: adminCourse.title },
      ],
    });

    const code = (adminCourse.code || `CRS-${courseIdStr.slice(-4)}`).toUpperCase();
    if (!instCourse) {
      instCourse = await I.Course.create({
        externalCourseId: courseIdStr,
        code,
        name: adminCourse.title,
        description: adminCourse.description || 'EGSA Space Academy Training Program',
        assignedInstructor: instUser._id,
        status: 'active',
      });
    } else {
      instCourse.assignedInstructor = instUser._id;
      if (instCourse.status !== 'active') instCourse.status = 'active';
      await instCourse.save();
    }

    // 4. Update / create Cohort in Instructor DB (Reassigning cohort reassigns course & student roster!)
    let instCohort = await I.Cohort.findOne({ course: instCourse._id });
    if (instCohort) {
      instCohort.instructor = instUser._id;
      instCohort.status = 'active';
      await instCohort.save();
    } else {
      instCohort = await I.Cohort.create({
        externalCohortId: `coh-${courseIdStr.slice(-4)}`,
        name: `${adminCourse.title} - Cohort 1`,
        course: instCourse._id,
        instructor: instUser._id,
        startDate: adminCourse.startDate || new Date(),
        endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'active',
      });
    }

    // 5. Update / create Cohort in Admin DB
    let adminCohort = await A.Cohort.findOne({ program: adminCourse._id });
    if (adminCohort) {
      adminCohort.instructor = adminInstructor._id;
      await adminCohort.save();
    } else {
      const cCode = (adminCourse.code || courseIdStr.slice(-4)).toUpperCase();
      const cohortNumber = `COH-${cCode}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`;
      adminCohort = await A.Cohort.create({
        cohortNumber,
        name: `${adminCourse.title} - Cohort 1`,
        program: adminCourse._id,
        instructor: adminInstructor._id,
        division: adminCourse.division,
        capacity: adminCourse.capacity || 25,
        startDate: adminCourse.startDate || new Date(),
        endDate: adminCourse.endDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        createdBy: user?._id || adminInstructor._id,
      });
    }

    // 6. Update Student DB Course with assigned instructor's name
    await S.Course.findOneAndUpdate(
      { _id: courseIdStr },
      {
        $set: {
          instructor: adminInstructor.fullName,
          assignedInstructorId: instructorIdStr,
          instructorEmail: adminInstructor.email,
        },
      }
    );

    // 7. Update Student DB Cohort if exists
    let studentCohort = await S.Cohort.findOne({ course: courseIdStr });
    if (studentCohort) {
      studentCohort.name = adminCohort.name;
      await studentCohort.save();
    }

    return {
      success: true,
      courseId: courseIdStr,
      instructorId: instructorIdStr,
      instructorName: adminInstructor.fullName,
      instructorCohortId: instCohort._id,
      adminCohortId: adminCohort._id,
    };
  } catch (err) {
    console.error('[UNIFIED SYNC] syncCourseInstructorAssignment error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  syncCourseInstructorAssignment,
  syncEnrollment,
  syncAttendanceFromInstructor,
  syncSubmissionFromStudent,
  syncGradeFromInstructor,
  syncAssessmentFromInstructor,
  syncCohortAndInstructor,
  syncStudentRegistration,
  syncAuthoritativeCoursesToAdmin,
  syncProgramFromAdmin,
  syncApplicationFromStudent,
  syncDecisionFromAdmin,
};
