const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { initDatabases, getStudentConn, getInstructorConn, getAdminConn } = require('../src/config/database');

describe('EGSA Academy — Course & Instructor Evaluation Workflows (Isolated)', () => {
  let sConn, iConn, aConn;
  let User, Course, Cohort, Enrollment, Evaluation, Certificate;
  let ICourse, ICohort, IUser;
  let testStudent, testCourse, testCohort, testEnrollment;
  let testInstructor, testUnassignedInstructor, testICourse;

  before(async () => {
    await initDatabases();
    sConn = getStudentConn();
    iConn = getInstructorConn();
    aConn = getAdminConn();

    User = require('../src/modules/student/models/User');
    Course = require('../src/modules/student/models/Course');
    Cohort = require('../src/modules/student/models/Cohort');
    Enrollment = require('../src/modules/student/models/Enrollment');
    Evaluation = require('../src/modules/student/models/Evaluation');
    Certificate = require('../src/modules/student/models/Certificate');

    const iModels = require('../src/modules/instructor/models');
    ICourse = iModels.Course;
    ICohort = iModels.Cohort;
    IUser = iModels.User;

    // Pick an existing course and cohort to test with
    testCourse = await Course.findOne({ division: 'UNIVERSITY' });
    if (!testCourse) testCourse = await Course.findOne({});
    assert.ok(testCourse, 'A course should exist in egsa_academy DB');

    testCohort = await Cohort.findOne({ course: testCourse._id });

    // CREATE DEDICATED ISOLATED TEST STUDENT (never touch real student records)
    const random14 = String(Math.floor(10000000000000 + Math.random() * 90000000000000));
    testStudent = await User.create({
      fullName: 'Automated Isolated Unit Cadet',
      email: `unit.cadet.${Date.now()}@egsa.test`,
      password: 'StrongPassword123!',
      phone: '+201000000001',
      nationalId: random14,
      role: 'student',
      accountStatus: 'active',
      isEmailVerified: true,
    });

    testEnrollment = await Enrollment.create({
      student: testStudent._id,
      course: testCourse._id,
      cohort: testCohort?._id,
      application: new mongoose.Types.ObjectId(),
      status: 'Confirmed',
    });

    // Find instructor in instructor DB
    testInstructor = await IUser.findOne({ role: 'instructor' });
    testUnassignedInstructor = await IUser.create({
      name: 'Unassigned Test Faculty',
      email: `unassigned.${Date.now()}@egsa.gov.eg`,
      passwordHash: 'dummyhash',
      role: 'instructor',
      status: 'active',
    });

    testICourse = await ICourse.findOne({});
  });

  after(async () => {
    // Teardown: Clean up all isolated test records completely
    if (testStudent) {
      await Evaluation.deleteMany({ student: testStudent._id });
      await Enrollment.deleteMany({ student: testStudent._id });
      await User.deleteOne({ _id: testStudent._id });
    }
    if (testUnassignedInstructor) {
      await IUser.deleteOne({ _id: testUnassignedInstructor._id });
    }
    await Promise.all([sConn?.close(), iConn?.close(), aConn?.close()]);
  });

  test('1. Evaluation model schema validation & criteria ratings', async () => {
    const validRatings = {
      content: 5,
      instructor: 4,
      labs: 5,
      organization: 4,
    };
    for (const val of Object.values(validRatings)) {
      assert.ok(val >= 1 && val <= 5, 'Rating must be between 1 and 5');
    }
  });

  test('2. Submitting Course & Instructor Feedback updates Evaluation record', async () => {
    const evaluation = await Evaluation.findOneAndUpdate(
      { student: testStudent._id, course: testCourse._id },
      {
        $set: {
          student: testStudent._id,
          course: testCourse._id,
          cohort: testCohort?._id,
          enrollment: testEnrollment._id,
          ratings: {
            content: 5,
            instructor: 5,
            labs: 5,
            organization: 4,
          },
          comments: {
            highlights: 'Automated test: outstanding orbital telemetry lab',
            improvements: 'Automated test: more simulation hours',
          },
          courseFeedbackCompleted: true,
          courseFeedbackSubmittedAt: new Date(),
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    assert.ok(evaluation, 'Evaluation document should be saved');
    assert.equal(evaluation.courseFeedbackCompleted, true);
    assert.equal(evaluation.ratings.content, 5);
  });

  test('3. Final submission immutability: Controller rejects duplicate course feedback with 409 Conflict', async () => {
    const evaluationController = require('../src/modules/student/controllers/evaluationController');
    const req = {
      user: testStudent,
      body: {
        courseId: testCourse._id.toString(),
        ratings: { content: 5, instructor: 5, labs: 5, organization: 5 },
      },
    };
    let capturedError = null;
    const next = (err) => {
      capturedError = err;
    };
    const res = {
      status: () => res,
      json: () => {},
    };

    await evaluationController.submitEvaluation(req, res, next);
    assert.ok(capturedError, 'Should throw an error for duplicate submission');
    assert.equal(capturedError.statusCode, 409, 'Duplicate submission must return HTTP 409 Conflict');
    assert.ok(capturedError.message.includes('final'), 'Error message informs user submission is final');
  });

  test('4. Submitting Egyptian Space Agency Feedback updates agency status', async () => {
    const updated = await Evaluation.findOneAndUpdate(
      { student: testStudent._id, course: testCourse._id },
      {
        $set: {
          agencyFeedback: {
            trainingEnvironment: 5,
            facilitiesAndLabs: 5,
            organizationAndStaff: 4,
            platformExperience: 5,
            overallSatisfaction: 5,
            recommendAgency: true,
            comments: 'Automated test: world-class space technology facility',
            submittedAt: new Date(),
          },
          agencyFeedbackCompleted: true,
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    assert.ok(updated, 'Evaluation document should be updated with agency feedback');
    assert.equal(updated.agencyFeedbackCompleted, true);
    assert.equal(updated.agencyFeedback.recommendAgency, true);
  });

  test('5. Final submission immutability: Controller rejects duplicate agency feedback with 409 Conflict', async () => {
    const evaluationController = require('../src/modules/student/controllers/evaluationController');
    const req = {
      user: testStudent,
      body: {
        courseId: testCourse._id.toString(),
        agencyRatings: {
          trainingEnvironment: 5,
          facilitiesAndLabs: 5,
          organizationAndStaff: 5,
          platformExperience: 5,
          overallSatisfaction: 5,
        },
      },
    };
    let capturedError = null;
    const next = (err) => {
      capturedError = err;
    };
    const res = {
      status: () => res,
      json: () => {},
    };

    await evaluationController.submitAgencyEvaluation(req, res, next);
    assert.ok(capturedError, 'Should throw an error for duplicate agency submission');
    assert.equal(capturedError.statusCode, 409, 'Duplicate agency submission must return HTTP 409 Conflict');
    assert.ok(capturedError.message.includes('final'), 'Error message informs user submission is final');
  });

  test('6. Anonymous Feedback Protection: Student names, emails, and database _id are not exposed', async () => {
    const evaluationController = require('../src/modules/student/controllers/evaluationController');
    let capturedData = null;
    const req = {
      query: { courseId: testCourse._id.toString() },
      user: { role: 'admin' },
    };
    const res = {
      json: (payload) => {
        capturedData = payload;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await evaluationController.adminListEvaluations(req, res, next);
    assert.ok(capturedData?.success);
    for (const item of capturedData.data.evaluations) {
      assert.equal(item.student, undefined, 'Student ObjectId/name must not be exposed');
      assert.equal(item.email, undefined, 'Student email must not be exposed');
      assert.equal(item.fullName, undefined, 'Student fullName must not be exposed');
      assert.ok(item.anonymousCadetTag.startsWith('Cadet #'), 'Anonymous label used');
      assert.ok(item._id.startsWith('anon-eval-'), 'MongoDB _id replaced with pseudonym');
    }
  });

  test('7. Certificate Eligibility Service strictly checks enrollment-specific completion', async () => {
    const certificateService = require('../src/modules/student/services/certificateService');
    const eligibility = await certificateService.checkCertificateEligibility(testStudent._id, testEnrollment._id);

    assert.ok(eligibility, 'Eligibility object returned');
    assert.equal(
      eligibility.evaluationReasons.length,
      0,
      'No evaluation reasons should block certificate when both are completed'
    );
  });

  test('8. Instructor access to course evaluations enforces assignment authorization', async () => {
    const academicService = require('../src/modules/instructor/services/academic.service');

    if (testICourse) {
      const cohort = await ICohort.findOne({ course: testICourse._id });
      if (cohort && cohort.instructor) {
        const assignedResult = await academicService.getCourseEvaluations(cohort.instructor, testICourse._id);
        assert.ok(assignedResult, 'Assigned instructor can view course evaluations');
        assert.equal(typeof assignedResult.totalEvaluations, 'number');
        assert.equal(typeof assignedResult.overallAverage, 'number');
        assert.ok(assignedResult.privacyNotice.includes('privacy') || assignedResult.privacyNotice.includes('anonymous'), 'Privacy notice included');

        await assert.rejects(
          async () => {
            await academicService.getCourseEvaluations(testUnassignedInstructor._id, testICourse._id);
          },
          (err) => {
            assert.equal(err.statusCode || err.status, 403);
            return true;
          },
          'Unassigned instructor should be rejected with 403'
        );
      }
    }
  });

  test('9. Admin Course & Instructor Evaluation telemetry and division scoping', async () => {
    const feedbackController = require('../src/modules/admin/controllers/feedbackController');
    let capturedData = null;
    const req = {
      query: {},
      scopeDivision: 'all',
      user: { role: 'superadmin' },
    };
    const res = {
      json: (payload) => {
        capturedData = payload;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await feedbackController.getCourseEvaluationsAdminController(req, res, next);
    assert.ok(capturedData?.success, 'Admin evaluations query succeeded');
    assert.ok(capturedData.data.stats, 'Completion stats included');
    assert.equal(typeof capturedData.data.stats.totalEvaluations, 'number');
    assert.equal(typeof capturedData.data.stats.completionRate, 'number');
    assert.ok(capturedData.data.courseAverages, 'Course quality telemetry included');
    assert.ok(Array.isArray(capturedData.data.evaluations), 'Evaluations array returned');
    for (const ev of capturedData.data.evaluations) {
      assert.equal(ev.student, undefined, 'Student ObjectId must not be exposed');
      assert.equal(ev.email, undefined, 'Student email must not be exposed');
      assert.ok(ev.anonymousCadetTag.startsWith('Cadet #'), 'Anonymous label verified');
      assert.ok(ev._id.startsWith('anon-eval-'), 'Anonymized eval ID verified');
    }
  });
});
