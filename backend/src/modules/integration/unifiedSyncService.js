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

    // 2. Resolve or sync Course in Instructor DB
    const courseIdStr = (course?._id || course?.id || course)?.toString();
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
      const code = (course?.code || `CRS-${(courseIdStr || Date.now().toString()).slice(-4)}`).toUpperCase();
      instructorCourse = await I.Course.create({
        externalCourseId: courseIdStr || '',
        code,
        name: course?.title || 'Academy Space Program',
        description: course?.shortDescription || course?.overview || 'Accredited training program',
        status: 'active',
      });
    }

    // 3. Resolve or sync Cohort in Instructor DB
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
    if (!instructorCohort && cohort?.name) {
      instructorCohort = await I.Cohort.findOne({ name: cohort.name, course: instructorCourse._id });
    }
    if (!instructorCohort) {
      // Find an active instructor
      let instUser = await I.User.findOne({ role: 'instructor', status: 'active' });
      if (!instUser) {
        instUser = await I.User.findOne({ role: 'instructor' });
      }

      instructorCohort = await I.Cohort.create({
        externalCohortId: cohortIdStr || `coh-${Date.now().toString().slice(-4)}`,
        name: cohort?.name || `${instructorCourse.name} - Cohort 1`,
        course: instructorCourse._id,
        instructor: instUser?._id,
        startDate: cohort?.startDate ? new Date(cohort.startDate) : new Date(),
        endDate: cohort?.endDate ? new Date(cohort.endDate) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'active',
      });
    }

    // 4. Upsert EnrollmentReference in Instructor DB
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

    // 5. Ensure Student User & Profile in Admin DB (esa_academy) if absent
    let adminSynced = false;
    let adminError = null;
    try {
      const adminUser = await A.User.findOneAndUpdate(
        { email: studentEmail },
        {
          $setOnInsert: {
            fullName: studentName,
            email: studentEmail,
            role: 'STUDENT',
            division: 'UNIVERSITY',
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
            division: 'UNIVERSITY',
            academicLevel: 'Undergraduate',
          },
        },
        { upsert: true }
      );
      adminSynced = true;
    } catch (adminErr) {
      adminError = adminErr.message;
      console.warn('[UNIFIED SYNC] Admin user enrollment mirror notice:', adminErr.message);
    }

    return {
      success: adminSynced,
      partial: !adminSynced,
      syncedPools: { instructor: true, admin: adminSynced },
      adminWarning: adminError,
      studentRefId: studentRef._id,
      cohortId: instructorCohort._id,
      enrollmentRefId: enrollmentRef._id,
    };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync enrollment:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Synchronize Attendance recorded by Instructor into Student DB and Admin DB.
 */
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
      if (cohortDoc?.instructor) {
        await I.Notification.findOneAndUpdate(
          { recipient: cohortDoc.instructor, link: `/instructor/submissions/${instSub._id}` },
          {
            $set: {
              type: 'new_submission',
              title: 'New Student Submission',
              message: `${studentUser.fullName} submitted "${assessment.title}".`,
              link: `/instructor/submissions/${instSub._id}`,
              read: false,
            },
          },
          { upsert: true }
        );
      }
    } catch (_) {}

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
        await S.Notification.findOneAndUpdate(
          { recipient: studentUser._id, title: `Assessment Evaluated: ${studentAssessment.title}` },
          {
            $set: {
              message: `Your score for "${studentAssessment.title}" is ${score}/${maxScore} (${percentage}% - ${resultLabel}). Feedback: "${resultDoc.feedback || 'Good job!'}"`,
              type: resultLabel === 'Passed' ? 'success' : 'warning',
              relatedCourse: studentAssessment.course,
            },
          },
          { upsert: true }
        );
      } catch (_) {}
    }

    return { success: true, studentResultId: studentResult._id };
  } catch (err) {
    console.error('[UNIFIED SYNC] Failed to sync grade from instructor:', err.message);
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

module.exports = {
  syncEnrollment,
  syncAttendanceFromInstructor,
  syncSubmissionFromStudent,
  syncGradeFromInstructor,
  syncCohortAndInstructor,
};
