const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/modules/integration/unifiedSyncService.js');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Replace syncEnrollment function (lines ~55 to 198)
const oldEnrollmentStart = "async function syncEnrollment({ student, course, cohort, enrollmentId, status = 'active' }) {";
const oldEnrollmentEnd = "async function syncAttendanceFromInstructor";

const newSyncEnrollment = `async function syncEnrollment({ student, course, cohort, enrollmentId, status = 'active' }) {
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
      const code = (course?.code || adminCourse?.code || \`CRS-\${(courseIdStr || Date.now().toString()).slice(-4)}\`).toUpperCase();
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
        externalCohortId: cohortIdStr || \`coh-\${Date.now().toString().slice(-4)}\`,
        name: cohort?.name || \`\${instructorCourse.name} - Cohort 1\`,
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
          adminCohort = await A.Cohort.create({
            name: \`\${adminCourse.title} - Cohort 1\`,
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

`;

const startIdx = code.indexOf(oldEnrollmentStart);
const endIdx = code.indexOf(oldEnrollmentEnd);
if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find syncEnrollment boundary');
  process.exit(1);
}

code = code.substring(0, startIdx) + newSyncEnrollment + code.substring(endIdx);

// 2. Add syncCourseInstructorAssignment function before module.exports
const syncAssignmentFunction = `/**
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

    const adminInstructor = await A.User.findById(instructorIdStr);
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

    const code = (adminCourse.code || \`CRS-\${courseIdStr.slice(-4)}\`).toUpperCase();
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
        externalCohortId: \`coh-\${courseIdStr.slice(-4)}\`,
        name: \`\${adminCourse.title} - Cohort 1\`,
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
      adminCohort = await A.Cohort.create({
        name: \`\${adminCourse.title} - Cohort 1\`,
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

`;

// 3. Enhance syncProgramFromAdmin to sync instructor details
const oldSyncProgram = "    await S.Course.findOneAndUpdate(\n      { _id: progId },\n      {\n        $set: {\n          title: adminProgram.title,";
const enhancedSyncProgram = `    // Resolve instructor name and details if assigned
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
          title: adminProgram.title,`;

code = code.replace(oldSyncProgram, enhancedSyncProgram);

// Also in syncProgramFromAdmin, after S.Course upsert, trigger syncCourseInstructorAssignment if instId
const oldAfterSyncProgram = "    return { success: true, courseId: progId };\n  } catch (err) {";
const newAfterSyncProgram = `    if (instId) {
      try {
        await syncCourseInstructorAssignment({ courseId: progId, instructorId: instId });
      } catch (_) {}
    }
    return { success: true, courseId: progId };
  } catch (err) {`;

code = code.replace(oldAfterSyncProgram, newAfterSyncProgram);

// Insert syncCourseInstructorAssignment before module.exports
const moduleExportsIdx = code.indexOf('module.exports = {');
code = code.substring(0, moduleExportsIdx) + syncAssignmentFunction + code.substring(moduleExportsIdx);

// Add syncCourseInstructorAssignment to module.exports
code = code.replace('module.exports = {', 'module.exports = {\n  syncCourseInstructorAssignment,');

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully patched unifiedSyncService.js');

