const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5500';

async function main() {
  console.log('=== EGSA ACADEMY LIVE API & DATABASE INTEGRATION VERIFICATION ===\n');

  const { initDatabases, getStudentConn, getInstructorConn, getAdminConn } = require('../src/config/database');
  const env = require('../src/config/env');
  const iEnv = require('../src/modules/instructor/config/env');

  await initDatabases();
  const sConn = getStudentConn();
  const iConn = getInstructorConn();
  const aConn = getAdminConn();

  const User = require('../src/modules/student/models/User');
  const Course = require('../src/modules/student/models/Course');
  const Cohort = require('../src/modules/student/models/Cohort');
  const Enrollment = require('../src/modules/student/models/Enrollment');
  const Evaluation = require('../src/modules/student/models/Evaluation');
  const Certificate = require('../src/modules/student/models/Certificate');

  const iModels = require('../src/modules/instructor/models');
  const ICourse = iModels.Course;
  const ICohort = iModels.Cohort;
  const IUser = iModels.User;

  const AdminUser = require('../src/modules/admin/models/User');

  let liveStudent = null;
  let liveEnrollment = null;
  let unassignedInstructor = null;

  try {
    // 1. Target Course & Setup ISOLATED Synthetic Student
    const targetCourse = await Course.findOne({ division: 'UNIVERSITY' }) || await Course.findOne({});
    assert.ok(targetCourse, 'Target course exists in student DB');
    const targetCohort = await Cohort.findOne({ course: targetCourse._id });

    const liveCadetEmail = `live.cadet.${Date.now()}@egsa.test`;
    const random14 = String(Math.floor(10000000000000 + Math.random() * 90000000000000));
    liveStudent = await User.create({
      fullName: 'Live Verification Cadet',
      email: liveCadetEmail,
      password: 'StrongPassword123!',
      phone: '+201000000002',
      nationalId: random14,
      role: 'student',
      accountStatus: 'active',
      isEmailVerified: true,
    });

    liveEnrollment = await Enrollment.create({
      student: liveStudent._id,
      course: targetCourse._id,
      cohort: targetCohort?._id,
      application: new mongoose.Types.ObjectId(),
      status: 'Confirmed',
    });

    const studentToken = jwt.sign(
      { id: liveStudent._id.toString(), email: liveStudent.email, role: 'student' },
      env.jwt.studentSecret,
      { expiresIn: '1h' }
    );

    const courseId = targetCourse._id.toString();
    console.log(`[Student] Isolated Test Cadet: ${liveStudent.email}`);
    console.log(`[Student] Target Course: "${targetCourse.title}" (${courseId})`);

    // --- 1.1 Verify GET /api/evaluations/status/:courseId ---
    console.log('\n--- Test 1: Student Evaluation Flow & Immutability ---');
    let res = await fetch(`${BASE_URL}/api/evaluations/status/${courseId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    let json = await res.json();
    assert.equal(res.status, 200, 'Status check returned 200');
    assert.equal(json.data.feedbackCompleted, false, 'Initial state: feedback is not completed');
    console.log('✔ Initial Evaluation Status check returned 200 (feedbackCompleted = false)');

    // --- 1.2 Submit Form A: Course & Instructor Feedback ---
    res = await fetch(`${BASE_URL}/api/evaluations/course`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId,
        ratings: {
          content: 5,
          instructor: 5,
          labs: 4,
          organization: 5,
        },
        comments: {
          highlights: 'Exceptional orbital mechanics laboratory exercises.',
          improvements: 'Provide supplementary telemetry dataset links before lectures.',
        },
      }),
    });
    json = await res.json();
    assert.equal(res.status, 201, 'Form A submission returned 201');
    assert.equal(json.courseFeedbackCompleted, true);
    console.log('✔ Form A (Course & Faculty) submitted successfully (HTTP 201)');

    // Verify DB record
    const evalDocAfterA = await Evaluation.findOne({ student: liveStudent._id, course: courseId });
    assert.ok(evalDocAfterA, 'Evaluation saved in MongoDB');
    assert.equal(evalDocAfterA.ratings.content, 5);
    assert.equal(evalDocAfterA.courseFeedbackCompleted, true);
    console.log('✔ MongoDB Evaluation document verified: courseFeedbackCompleted = true');

    // --- 1.3 Final Submission Immutability Check: Duplicate Form A submission MUST return 409 Conflict ---
    res = await fetch(`${BASE_URL}/api/evaluations/course`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId,
        ratings: {
          content: 1,
          instructor: 1,
          labs: 1,
          organization: 1,
        },
        comments: {
          highlights: 'Attempted overwrite of finalized feedback',
          improvements: 'Should be rejected',
        },
      }),
    });
    assert.equal(res.status, 409, 'Duplicate Form A submission rejected with 409 Conflict');
    json = await res.json();
    assert.ok(json.message.includes('final'), 'Response indicates feedback is final and read-only');
    console.log('✔ Final submission immutability verified: Duplicate submission rejected with HTTP 409 Conflict');

    // Verify ratings were not overwritten
    const evalDocUnchanged = await Evaluation.findOne({ student: liveStudent._id, course: courseId });
    assert.equal(evalDocUnchanged.ratings.content, 5, 'Previous rating intact and immutable');

    // --- 1.4 Submit Form B: Egyptian Space Agency Experience ---
    res = await fetch(`${BASE_URL}/api/evaluations/agency`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId,
        agencyRatings: {
          trainingEnvironment: 5,
          facilitiesAndLabs: 5,
          organizationAndStaff: 5,
          platformExperience: 4,
          overallSatisfaction: 5,
        },
        recommendAgency: true,
        comments: 'World-class space agency training infrastructure and hospitable faculty.',
      }),
    });
    json = await res.json();
    assert.equal(res.status, 201, 'Form B submission returned 201');
    assert.equal(json.agencyFeedbackCompleted, true);
    assert.equal(json.feedbackCompleted, true);
    console.log('✔ Form B (Egyptian Space Agency Experience) submitted successfully (HTTP 201)');

    // --- 1.5 Duplicate Form B submission MUST return 409 Conflict ---
    res = await fetch(`${BASE_URL}/api/evaluations/agency`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId,
        agencyRatings: {
          trainingEnvironment: 1,
          facilitiesAndLabs: 1,
          organizationAndStaff: 1,
          platformExperience: 1,
          overallSatisfaction: 1,
        },
      }),
    });
    assert.equal(res.status, 409, 'Duplicate Form B submission rejected with 409 Conflict');
    console.log('✔ Final submission immutability verified for Agency Feedback (HTTP 409 Conflict)');

    // Refresh status from backend
    res = await fetch(`${BASE_URL}/api/evaluations/status/${courseId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    json = await res.json();
    assert.equal(json.data.feedbackCompleted, true, 'Backend status confirms all feedback completed');
    console.log('✔ Backend status successfully refreshed: feedbackCompleted = true');

    // --- 1.6 Unauthorized student submission test (non-enrolled) ---
    const otherCourse = await Course.findOne({ _id: { $ne: targetCourse._id } });
    if (otherCourse) {
      const unauthRes = await fetch(`${BASE_URL}/api/evaluations/course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          courseId: otherCourse._id.toString(),
          ratings: { content: 5, instructor: 5, labs: 5, organization: 5 },
        }),
      });
      assert.equal(unauthRes.status, 403, 'Non-enrolled course submission rejected with 403 Forbidden');
      console.log('✔ Non-enrolled course submission rejected with 403 Forbidden');
    }

    // --- 2. Instructor Portal Flow & Anonymity ---
    console.log('\n--- Test 2: Instructor Portal Flow & Anonymity ---');
    const iCourse = await ICourse.findOne({});
    const iCohort = await ICohort.findOne({ course: iCourse._id });
    assert.ok(iCohort && iCohort.instructor, 'Assigned instructor exists in instructor DB');

    const instructorToken = jwt.sign(
      { sub: iCohort.instructor.toString(), role: 'instructor' },
      iEnv.jwt.accessSecret,
      { expiresIn: '1h' }
    );

    // 2.1 Authorized instructor requests course evaluations
    res = await fetch(`${BASE_URL}/api/v1/instructor/courses/${iCourse._id}/evaluations`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.equal(res.status, 200, 'Assigned instructor can access course evaluations');
    json = await res.json();
    assert.equal(json.success, true);
    assert.equal(typeof json.data.totalEvaluations, 'number');
    assert.equal(typeof json.data.overallAverage, 'number');
    assert.ok(json.data.privacyNotice.includes('anonymous'), 'Anonymity policy returned');

    // Verify NO student identity is returned in instructor payload
    if (json.data.recentQuotes?.length > 0) {
      for (const q of json.data.recentQuotes) {
        assert.equal(q.student, undefined);
        assert.equal(q.email, undefined);
        assert.equal(q.fullName, undefined);
        assert.ok(q.author.startsWith('Cadet #'), 'Author is anonymized');
      }
    }
    console.log(`✔ Assigned instructor feedback verified: ${json.data.totalEvaluations} evaluations, average: ${json.data.overallAverage}/5`);
    console.log('✔ Anonymity verified: Instructor payload has zero student names, emails, or IDs');

    // 2.2 Unassigned instructor requests course evaluations
    unassignedInstructor = await IUser.create({
      name: 'Unassigned Test Prof',
      email: `unassigned.${Date.now()}@egsa.test`,
      passwordHash: 'dummy',
      role: 'instructor',
      status: 'active',
    });
    const unassignedToken = jwt.sign(
      { sub: unassignedInstructor._id.toString(), role: 'instructor' },
      iEnv.jwt.accessSecret,
      { expiresIn: '1h' }
    );
    const forbiddenRes = await fetch(`${BASE_URL}/api/v1/instructor/courses/${iCourse._id}/evaluations`, {
      headers: { Authorization: `Bearer ${unassignedToken}` },
    });
    assert.equal(forbiddenRes.status, 403, 'Unassigned instructor denied access with 403 Forbidden');
    console.log('✔ Unassigned instructor correctly denied access with 403 Forbidden');

    // --- 3. Admin Portal Flow & Division Scoping ---
    console.log('\n--- Test 3: Admin Portal Flow & Division Scoping ---');
    let superAdmin = await AdminUser.findOne({ role: 'SUPER_ADMIN' });
    if (!superAdmin) {
      superAdmin = await AdminUser.findOne({ email: 'reg.admin.5101@esa.dev' });
    }
    assert.ok(superAdmin, 'Admin account exists in esa_academy DB');

    const adminSecret = process.env.ADMIN_JWT_SECRET || 'replace_this_with_a_long_random_secret';
    const superAdminToken = jwt.sign(
      { id: superAdmin._id.toString(), email: superAdmin.email, role: superAdmin.role },
      adminSecret,
      { expiresIn: '1h' }
    );

    res = await fetch(`${BASE_URL}/admin-api/admin/evaluations`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(res.status, 200, 'Admin can access evaluations endpoint');
    json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.stats, 'Completion statistics present');
    console.log('✔ Admin Completion Stats:', json.data.stats);

    // Check anonymity in admin evaluations list
    for (const ev of json.data.evaluations) {
      assert.equal(ev.student, undefined, 'Student ObjectId not present');
      assert.equal(ev.email, undefined, 'Student email not present');
      assert.equal(ev.fullName, undefined, 'Student fullName not present');
      assert.ok(ev.anonymousCadetTag.startsWith('Cadet #'), 'Anonymized cadet tag present');
      assert.ok(ev._id.startsWith('anon-eval-'), 'Sanitized pseudonym ID present');
      if (ev.submittedDate) {
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(ev.submittedDate), 'Exact timestamp truncated to date-only');
      }
    }
    console.log(`✔ Admin anonymization verified across ${json.data.evaluations.length} evaluation records`);

    // 3.2 Division Admin Scoping Test: Pre-University Admin cannot access cross-division evaluations
    let preUniAdmin = await AdminUser.findOne({ role: 'PRE_UNIVERSITY_ADMIN' });
    if (!preUniAdmin) {
      preUniAdmin = await AdminUser.findOne({ division: 'PRE_UNIVERSITY' });
    }
    assert.ok(preUniAdmin, 'Division admin exists in DB');
    const preUniAdminToken = jwt.sign(
      { id: preUniAdmin._id.toString(), email: preUniAdmin.email, role: preUniAdmin.role, division: preUniAdmin.division },
      adminSecret,
      { expiresIn: '1h' }
    );
    const crossDivRes = await fetch(`${BASE_URL}/admin-api/admin/evaluations?division=UNIVERSITY`, {
      headers: { Authorization: `Bearer ${preUniAdminToken}` },
    });
    assert.equal(crossDivRes.status, 403, 'Cross-division query by division admin rejected with 403 Forbidden');
    console.log('✔ Admin Division Scoping verified: Division admin rejected with 403 Forbidden when requesting cross-division data');

    // --- 4. Server-Side Certificate Eligibility Gate ---
    console.log('\n--- Test 4: Server-Side Certificate Eligibility Gate ---');
    const certificateService = require('../src/modules/student/services/certificateService');
    const eligibility = await certificateService.checkCertificateEligibility(liveStudent._id, liveEnrollment._id);
    console.log('✔ Certificate Eligibility result for Isolated Cadet:');
    console.log('   - Course Feedback Completed:', eligibility.criteria.courseFeedbackSubmitted);
    console.log('   - Agency Feedback Completed:', eligibility.criteria.agencyFeedbackSubmitted);
    console.log('   - Evaluation Blocking Reasons:', eligibility.evaluationReasons);
    console.log('   - Overall Eligible for Issuance:', eligibility.isEligibleForIssuance);

    assert.equal(eligibility.evaluationReasons.length, 0, 'Evaluations gate passed');
    assert.equal(eligibility.isEligibleForIssuance, false, 'Completing evaluations does NOT bypass graduation gates (attendance, passes)');
    console.log('✔ Verified: Completing evaluations does NOT bypass attendance, passing grade, or assessment gates');

    console.log('\n=== ALL SCENARIOS VERIFIED SUCCESSFULLY ===');
  } finally {
    // Teardown: Remove all isolated records and ensure demo data is pristine
    console.log('\n--- Teardown & Data Integrity Cleanup ---');
    if (liveStudent) {
      await Evaluation.deleteMany({ student: liveStudent._id });
      await Enrollment.deleteMany({ student: liveStudent._id });
      await User.deleteOne({ _id: liveStudent._id });
      console.log('✔ Cleaned isolated test student and evaluations');
    }
    if (unassignedInstructor) {
      await IUser.deleteOne({ _id: unassignedInstructor._id });
      console.log('✔ Cleaned temporary test instructor');
    }

    // Double-check Sara Ahmed's demo account remains clean
    const sara = await User.findOne({ email: 'sara.demo@egsa-academy.example' });
    if (sara) {
      const saraEvals = await Evaluation.countDocuments({ student: sara._id });
      console.log(`✔ Verified Sara Ahmed demo account preserved (evaluations: ${saraEvals})`);
    }

    await Promise.all([sConn.close(), iConn.close(), aConn.close()]);
  }
}

main().catch((err) => {
  console.error('\n✖ Verification failed:', err);
  process.exit(1);
});
