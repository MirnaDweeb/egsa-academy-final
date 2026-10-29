const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { initDatabases, getStudentConn, getInstructorConn, getAdminConn } = require('../src/config/database');

describe('EGSA Academy — Complete Assignment Lifecycle, Notifications, Grading & Media Verification', () => {
  let sConn, iConn, aConn;
  let SUser, SCourse, SCohort, SEnrollment, SAssessment, SSubmission, SResult, SNotification;
  let IUser, ICourse, ICohort, IAssessment, ISubmission, IResult, INotification, IStudentRef, IEnrollmentRef;

  // Services
  let instructorAssessmentService;
  let studentAssessmentService;
  let studentMediaService;
  let unifiedSyncService;

  // Test Entities
  let testCourse, testCohort;
  let testInstructor, unrelatedInstructor;
  let instCourse, instCohort;
  let enrolledStudent, unenrolledStudent;
  let enrolledEnrollment;
  let createdAssessment;
  let studentSubmissionDoc;
  let testAttachmentFile;
  let sRef, enrRef;

  before(async () => {
    try {
      await initDatabases();
      sConn = getStudentConn();
      iConn = getInstructorConn();
      aConn = getAdminConn();

      // Models
      SUser = require('../src/modules/student/models/User');
      SCourse = require('../src/modules/student/models/Course');
      SCohort = require('../src/modules/student/models/Cohort');
      SEnrollment = require('../src/modules/student/models/Enrollment');
      SAssessment = require('../src/modules/student/models/Assessment');
      SSubmission = require('../src/modules/student/models/StudentSubmission');
      SResult = require('../src/modules/student/models/AssessmentResult');
      SNotification = require('../src/modules/student/models/Notification');

      const iModels = require('../src/modules/instructor/models');
      IUser = iModels.User;
      ICourse = iModels.Course;
      ICohort = iModels.Cohort;
      IAssessment = iModels.Assessment;
      ISubmission = iModels.AssessmentSubmission;
      IResult = iModels.AssessmentResult;
      INotification = iModels.Notification;
      IStudentRef = iModels.StudentReference;
      IEnrollmentRef = iModels.EnrollmentReference;

      // Services
      instructorAssessmentService = require('../src/modules/instructor/services/assessment.service');
      studentAssessmentService = require('../src/modules/student/services/assessmentService');
      studentMediaService = require('../src/modules/student/services/mediaService');
      unifiedSyncService = require('../src/modules/integration/unifiedSyncService');

      const ts = Date.now();

      // 1. Resolve or create test Course & Cohort in Student DB
      testCourse = await SCourse.findOne({ division: 'UNIVERSITY' });
      if (!testCourse) testCourse = await SCourse.findOne({});
      assert.ok(testCourse, 'At least one course must exist in egsa_academy DB');

      testCohort = await SCohort.findOne({ course: testCourse._id });
      if (!testCohort) {
        testCohort = await SCohort.create({
          name: `${testCourse.title} - Cohort Alpha`,
          course: testCourse._id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          status: 'InProgress',
        });
      }

      // 2. Create isolated Test Instructor in egsa_instructor
      testInstructor = await IUser.create({
        name: 'Dr. Test Flight Dynamics',
        email: `inst.flight.${ts}@esa.dev`,
        passwordHash: 'dummyhash',
        role: 'instructor',
        division: 'UNIVERSITY',
        status: 'active',
      });

      unrelatedInstructor = await IUser.create({
        name: 'Dr. Unrelated Faculty',
        email: `unrelated.faculty.${ts}@esa.dev`,
        passwordHash: 'dummyhash',
        role: 'instructor',
        division: 'UNIVERSITY',
        status: 'active',
      });

      // Create isolated instructor Course & Cohort owned by testInstructor
      instCourse = await ICourse.create({
        externalCourseId: testCourse._id.toString(),
        code: `CRS-${ts.toString().slice(-4)}`,
        name: testCourse.title,
        description: 'Test Flight Dynamics Program',
        assignedInstructor: testInstructor._id,
        status: 'active',
      });

      instCohort = await ICohort.create({
        externalCohortId: testCohort._id.toString(),
        name: `${testCohort.name} - Unit Cohort ${ts}`,
        course: instCourse._id,
        instructor: testInstructor._id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'active',
      });

      // 3. Create isolated Enrolled Student
      const randId1 = String(Math.floor(10000000000000 + Math.random() * 90000000000000));
      enrolledStudent = await SUser.create({
        fullName: 'Enrolled Test Cadet',
        email: `cadet.enrolled.${ts}@egsa.test`,
        password: 'StrongPassword123!',
        phone: '+201000000010',
        nationalId: randId1,
        role: 'student',
        accountStatus: 'active',
        isEmailVerified: true,
      });

      enrolledEnrollment = await SEnrollment.create({
        student: enrolledStudent._id,
        course: testCourse._id,
        cohort: testCohort._id,
        application: new mongoose.Types.ObjectId(),
        status: 'Confirmed',
        enrolledAt: new Date(),
      });

      // Enroll in Instructor DB
      sRef = await IStudentRef.create({
        externalStudentId: enrolledStudent._id.toString(),
        name: enrolledStudent.fullName,
        email: enrolledStudent.email,
      });
      enrRef = await IEnrollmentRef.create({
        student: sRef._id,
        cohort: instCohort._id,
        course: instCourse._id,
        status: 'active',
      });

      // 4. Create isolated Unenrolled Student
      const randId2 = String(Math.floor(10000000000000 + Math.random() * 90000000000000));
      unenrolledStudent = await SUser.create({
        fullName: 'Unenrolled Cadet',
        email: `cadet.unenrolled.${ts}@egsa.test`,
        password: 'StrongPassword123!',
        phone: '+201000000011',
        nationalId: randId2,
        role: 'student',
        accountStatus: 'active',
        isEmailVerified: true,
      });

      // 5. Create physical dummy assignment attachment file in uploads/assignments
      const uploadDir = path.resolve(__dirname, '../../uploads/assignments');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      testAttachmentFile = `test-brief-${ts}.pdf`;
      fs.writeFileSync(path.join(uploadDir, testAttachmentFile), '%PDF-1.4 Mock Assignment Brief Content');
      console.log('[TEST BEFORE HOOK] Initialized test fixture successfully.');
    } catch (err) {
      console.error('[TEST BEFORE HOOK ERROR]:', err);
      throw err;
    }
  });

  after(async () => {
    // Teardown: Clean up isolated test records
    try {
      if (testInstructor) {
        await IAssessment.deleteMany({ createdBy: testInstructor._id });
        await INotification.deleteMany({ user: testInstructor._id });
        await IUser.deleteOne({ _id: testInstructor._id });
      }
      if (unrelatedInstructor) {
        await IUser.deleteOne({ _id: unrelatedInstructor._id });
      }
      if (instCohort) {
        await ISubmission.deleteMany({ cohort: instCohort._id });
        await IResult.deleteMany({ cohort: instCohort._id });
        await ICohort.deleteOne({ _id: instCohort._id });
      }
      if (instCourse) {
        await ICourse.deleteOne({ _id: instCourse._id });
      }
      if (sRef) {
        await IStudentRef.deleteOne({ _id: sRef._id });
      }
      if (enrRef) {
        await IEnrollmentRef.deleteOne({ _id: enrRef._id });
      }
      if (enrolledStudent) {
        await SAssessment.deleteMany({ title: { $regex: 'Orbital Mechanics Lab' } });
        await SSubmission.deleteMany({ student: enrolledStudent._id });
        await SResult.deleteMany({ student: enrolledStudent._id });
        await SNotification.deleteMany({ recipient: enrolledStudent._id });
        await SEnrollment.deleteMany({ student: enrolledStudent._id });
        await SUser.deleteOne({ _id: enrolledStudent._id });
      }
      if (unenrolledStudent) {
        await SNotification.deleteMany({ recipient: unenrolledStudent._id });
        await SUser.deleteOne({ _id: unenrolledStudent._id });
      }
      if (testAttachmentFile) {
        const p = path.resolve(__dirname, '../../uploads/assignments', testAttachmentFile);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      console.log('[TEST AFTER HOOK] Cleaned up test fixture.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
  });

  test('Step 1: Instructor creates draft assignment with max score, instructions, and attachment', async () => {
    assert.ok(instCohort, 'Instructor must own a cohort');

    const due = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const body = {
      cohortId: instCohort._id.toString(),
      title: 'Orbital Mechanics Lab Assignment',
      description: 'Compute orbital transfer delta-V and Hohmann transfer burns.',
      instructions: 'Submit a PDF report detailing Hohmann transfer equations and flight parameters.',
      startDate: new Date().toISOString(),
      dueDate: due.toISOString(),
      gradingConfig: { maxScore: 100 },
      attachments: [
        {
          name: 'Orbital_Mechanics_Brief.pdf',
          url: `/uploads/assignments/${testAttachmentFile}`,
        },
      ],
    };

    createdAssessment = await instructorAssessmentService.create(testInstructor._id.toString(), body);

    assert.ok(createdAssessment, 'Assessment should be created');
    assert.equal(createdAssessment.status, 'draft', 'Initial status must be draft');
    assert.equal(createdAssessment.gradingConfig?.maxScore, 100, 'Max score should be 100');
    assert.equal(createdAssessment.attachments.length, 1, 'Should have 1 attachment');

    // Verify NO notifications dispatched while assessment is in draft
    const draftNotif = await SNotification.findOne({ recipient: enrolledStudent._id });
    assert.equal(draftNotif, null, 'No student notification should be sent for draft assessments');
  });

  test('Step 2: Instructor publishes assignment -> triggers multi-DB sync & enrolled student notification', async () => {
    try {
      assert.ok(createdAssessment, 'Precondition: createdAssessment must exist');

      const published = await instructorAssessmentService.publish(
        testInstructor._id.toString(),
        createdAssessment._id.toString()
      );

      assert.equal(published.status, 'published', 'Assessment status must be published');
      assert.ok(published.publishedAt, 'publishedAt must be populated');

      // Verify synced assessment in Student DB (egsa_academy)
      const syncedStudentAssessment = await SAssessment.findOne({
        $or: [
          { externalAssessmentId: createdAssessment._id.toString() },
          { title: 'Orbital Mechanics Lab Assignment' },
        ],
      });

      console.log('syncedStudentAssessment found:', !!syncedStudentAssessment);
      assert.ok(syncedStudentAssessment, 'Assessment must be synced to Student DB');
      assert.equal(syncedStudentAssessment.status, 'Scheduled', 'Student assessment should be Scheduled');
      assert.equal(syncedStudentAssessment.maxScore, 100, 'Max score must be preserved');
      assert.equal(syncedStudentAssessment.attachments.length, 1, 'Attachment must be synced');
      assert.equal(syncedStudentAssessment.attachments[0].fileName, testAttachmentFile, 'Attachment fileName must match');

      // Verify persistent notification for enrolled student
      const studentNotif = await SNotification.findOne({
        recipient: enrolledStudent._id,
        title: { $regex: 'New Assignment' },
      });
      console.log('studentNotif found:', !!studentNotif);
      assert.ok(studentNotif, 'Enrolled student must receive a persistent notification');
      assert.ok(studentNotif.message.includes('Orbital Mechanics Lab Assignment'), 'Notification should mention title');
      assert.equal(studentNotif.isRead, false, 'Notification must be unread initially');

      // Verify unenrolled student received NO notification
      const unenrolledNotif = await SNotification.findOne({
        recipient: unenrolledStudent._id,
        title: { $regex: 'New Assignment' },
      });
      assert.equal(unenrolledNotif, null, 'Unenrolled student must NOT receive notification');
    } catch (e) {
      console.error('STEP 2 FAILED WITH:', e);
      throw e;
    }
  });

  test('Step 3: Student queries assessments -> filtered views, instructions & attachments', async () => {
    const studentView = await studentAssessmentService.getStudentAssessments(enrolledStudent._id);
    assert.ok(studentView.assessments.length >= 1, 'Student should see published assignment');

    const targetItem = studentView.assessments.find((a) => a.title.includes('Orbital Mechanics Lab'));
    assert.ok(targetItem, 'Target assessment must be present in student view');
    assert.equal(targetItem.status, 'Upcoming', 'Status should be Upcoming before submission');
    assert.equal(targetItem.submissionStatus, 'Not Submitted', 'Submission status should be Not Submitted');

    // Query single assessment details
    const details = await studentAssessmentService.getAssessmentById(targetItem._id, enrolledStudent);
    assert.ok(details.assessment, 'Details assessment must exist');
    assert.equal(details.assessment.maxScore, 100, 'Max score must be 100');
    assert.ok(details.assessment.attachments.length >= 1, 'Should include attachment');
    assert.ok(details.assessment.attachments[0].downloadUrl, 'Download URL must be provided');
  });

  test('Step 4: Student submits work -> saves submission, triggers instructor sync & notification', async () => {
    const syncedStudentAssessment = await SAssessment.findOne({
      title: 'Orbital Mechanics Lab Assignment',
    });
    assert.ok(syncedStudentAssessment, 'Synced assessment must exist');

    const submissionPayload = {
      textAnswer: 'Hohmann burn calculations: Delta-V1 = 2.45 km/s, Delta-V2 = 1.48 km/s.',
    };

    const mockFile = {
      filename: `student_submission_${Date.now()}.pdf`,
      originalname: 'Cadet_Orbital_Report.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 50, // 50 KB
    };

    // Create physical dummy submission file
    const subUploadDir = path.resolve(__dirname, '../../uploads/assessments');
    if (!fs.existsSync(subUploadDir)) fs.mkdirSync(subUploadDir, { recursive: true });
    fs.writeFileSync(path.join(subUploadDir, mockFile.filename), '%PDF-1.4 Mock Student Submission');

    const sub = await studentAssessmentService.submitAssessment(
      syncedStudentAssessment._id,
      enrolledStudent,
      submissionPayload,
      mockFile
    );

    assert.ok(sub, 'Submission must be recorded');
    assert.equal(sub.status, 'Submitted', 'Status must be Submitted');
    assert.equal(sub.version, 1, 'Initial version must be 1');
    assert.equal(sub.file?.originalName, 'Cadet_Orbital_Report.pdf', 'File original name must match');
    studentSubmissionDoc = sub;

    // Verify submission synced into Instructor DB (egsa_instructor)
    const instSub = await ISubmission.findOne({
      externalSubmissionId: sub._id.toString(),
    });
    assert.ok(instSub, 'Submission must be synced to Instructor DB');
    assert.equal(instSub.status, 'submitted', 'Instructor submission status must be submitted');

    // Verify instructor received persistent notification in egsa_instructor
    const instNotif = await INotification.findOne({
      user: testInstructor._id,
      type: 'new_submission',
    });
    assert.ok(instNotif, 'Instructor must receive persistent new_submission notification');
    assert.ok(instNotif.message.includes('Enrolled Test Cadet'), 'Notification should mention student name');
    assert.ok(instNotif.link.includes(instSub._id.toString()), 'Notification must link to submission');
  });

  test('Step 5: Instructor reviews submission inbox & grades cadet work (with strict Anti-IDOR check for unrelated instructors)', async () => {
    assert.ok(createdAssessment, 'Precondition: createdAssessment must exist');

    // List submissions for this assessment by authorized instructor
    const subsList = await instructorAssessmentService.listSubmissions(testInstructor._id.toString(), {
      assessmentId: createdAssessment._id.toString(),
    });
    assert.equal(subsList.length, 1, 'Should find 1 submission in authorized instructor queue');
    assert.equal(subsList[0].status, 'submitted', 'Status should be submitted');

    const instSubId = subsList[0]._id.toString();

    // Verify anti-IDOR isolation: unrelated instructor CANNOT access or grade this submission
    await assert.rejects(
      async () => {
        await instructorAssessmentService.getSubmission(unrelatedInstructor._id.toString(), instSubId);
      },
      (err) => err.status === 404 || err.message?.includes('Not Found'),
      'Unrelated instructor must be rejected with 404 when trying to access submission'
    );

    await assert.rejects(
      async () => {
        await instructorAssessmentService.grade(unrelatedInstructor._id.toString(), instSubId, { score: 50 });
      },
      (err) => err.status === 404 || err.message?.includes('Not Found'),
      'Unrelated instructor must be rejected with 404 when trying to grade submission'
    );

    // Authorized instructor grades submission: score 92 / 100 with comprehensive feedback
    const gradeResult = await instructorAssessmentService.grade(
      testInstructor._id.toString(),
      instSubId,
      {
        score: 92,
        feedback: 'Exceptional orbital trajectory analysis and delta-V formulation.',
        strengths: 'Accurate boundary condition derivations.',
        improvements: 'Include second-order perturbation considerations.',
      }
    );

    assert.ok(gradeResult, 'Evaluation result must be returned');
    assert.equal(gradeResult.score, 92, 'Score must be 92');
    assert.equal(gradeResult.status, 'evaluated', 'Status should be evaluated before publish');

    // Publish result to student
    const publishedResult = await instructorAssessmentService.publishResult(
      testInstructor._id.toString(),
      instSubId
    );
    assert.equal(publishedResult.status, 'published', 'Result status must be published');
  });

  test('Step 6: Student receives grade notification & result is visible in student assessment details', async () => {
    // Verify persistent notification for student in egsa_academy
    const gradeNotif = await SNotification.findOne({
      recipient: enrolledStudent._id,
      title: { $regex: 'Assessment Evaluated' },
    });
    assert.ok(gradeNotif, 'Student must receive evaluation notification');
    assert.ok(gradeNotif.message.includes('92/100'), 'Notification must mention score');
    assert.ok(gradeNotif.message.includes('Passed'), 'Notification must mention Passed outcome');

    // Verify synced result in Student DB (egsa_academy)
    const syncedAssessment = await SAssessment.findOne({ title: 'Orbital Mechanics Lab Assignment' });
    const studentResult = await SResult.findOne({
      assessment: syncedAssessment._id,
      student: enrolledStudent._id,
    });
    assert.ok(studentResult, 'AssessmentResult must exist in Student DB');
    assert.equal(studentResult.score, 92, 'Score in student DB must be 92');
    assert.equal(studentResult.resultLabel, 'Passed', 'Result label must be Passed');
    assert.equal(studentResult.status, 'Published', 'Result status must be Published');

    // Check student view
    const studentView = await studentAssessmentService.getStudentAssessments(enrolledStudent._id);
    const evaluatedAssmt = studentView.sections.evaluated.find((a) => a.title.includes('Orbital Mechanics Lab'));
    assert.ok(evaluatedAssmt, 'Assignment must now be in Evaluated section');
    assert.equal(evaluatedAssmt.score, 92, 'Score must be exposed');
    assert.equal(evaluatedAssmt.feedback, 'Exceptional orbital trajectory analysis and delta-V formulation.');
  });

  test('Step 7: Student Media Page (Academic Resources) aggregates all materials correctly', async () => {
    const resourcesData = await studentMediaService.getAcademicResources(enrolledStudent._id);
    assert.ok(resourcesData.resources, 'Must return resources array');
    assert.ok(resourcesData.stats, 'Must return stats object');

    // 1. Verify Assignment Resources tab contains instructor attachment
    const assignResource = resourcesData.resources.find(
      (r) => r.tab === 'assignment_resources' && r.fileName === testAttachmentFile
    );
    assert.ok(assignResource, 'Assignment resource attachment must be present');
    assert.equal(assignResource.fileType, 'pdf', 'File type should be recognized as pdf');
    assert.ok(assignResource.downloadUrl, 'Must have downloadUrl');

    // 2. Verify My Submissions tab contains student submission file
    const mySubResource = resourcesData.resources.find(
      (r) => r.tab === 'my_submissions' && r.fileName === studentSubmissionDoc.file.fileName
    );
    assert.ok(mySubResource, 'Student submission file must be present in My Submissions');
    assert.equal(mySubResource.fileType, 'pdf', 'File type should be recognized as pdf');

    // 3. Verify Instructor Feedback tab contains evaluation result
    const feedbackResource = resourcesData.resources.find(
      (r) => r.tab === 'instructor_feedback' && r.score === 92
    );
    assert.ok(feedbackResource, 'Graded evaluation must be present in Instructor Feedback');
    assert.equal(feedbackResource.percentage, 92, 'Percentage must be 92');
    assert.equal(feedbackResource.resultLabel, 'Passed', 'Outcome must be Passed');

    // 4. Verify search filtering
    const searchFilter = await studentMediaService.getAcademicResources(enrolledStudent._id, {
      search: 'Orbital',
    });
    assert.ok(searchFilter.resources.length >= 1, 'Search by keyword should return matches');

    // 5. Verify course filtering
    const courseFilter = await studentMediaService.getAcademicResources(enrolledStudent._id, {
      courseId: testCourse._id.toString(),
    });
    assert.ok(courseFilter.resources.length >= 1, 'Course filter should return enrolled course materials');
  });
});
