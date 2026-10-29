const assert = require('assert');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

const TARGET_COURSE_ID = '6ad68d5c553bc1845e03866b';

async function verify() {
  console.log('Connecting to databases to verify fresh demo state...');
  const studentConn = mongoose.createConnection(env.db.studentUri);
  const instructorConn = mongoose.createConnection(env.db.instructorUri);
  const adminConn = mongoose.createConnection(env.db.adminUri);

  await Promise.all([
    new Promise((resolve) => studentConn.once('connected', resolve)),
    new Promise((resolve) => instructorConn.once('connected', resolve)),
    new Promise((resolve) => adminConn.once('connected', resolve)),
  ]);

  console.log('\n--- 1. VERIFY CORE COURSES PRESERVATION ---');
  const studentCourses = await studentConn.db.collection('courses').find({}).toArray();
  assert.ok(studentCourses.length >= 126, `Expected at least 126 preserved core courses, got ${studentCourses.length}`);
  console.log(`✓ Preserved core courses count: ${studentCourses.length}`);

  const targetCourse = studentCourses.find((c) => c._id.toString() === TARGET_COURSE_ID);
  assert.ok(targetCourse, 'Target demo course must exist in student DB');
  assert.strictEqual(targetCourse.status, 'Open', 'Target course status must be Open');
  assert.strictEqual(targetCourse.published, true, 'Target course must be published');
  assert.strictEqual(targetCourse.active, true, 'Target course must be active');
  console.log(`✓ Target demo course "${targetCourse.title}" is Open, Published, Active.`);

  console.log('\n--- 2. VERIFY DEMO STUDENT ACCOUNT & ENROLLMENT ---');
  const studentUser = await studentConn.db.collection('users').findOne({ email: 'demo.student@egsa.invalid' }, { projection: { password: 1, email: 1, fullName: 1, role: 1, division: 1 } });
  assert.ok(studentUser, 'demo.student@egsa.invalid must exist in Student DB');
  const studentPwMatch = await bcrypt.compare('EgsaDemoStudent2026!', studentUser.password);
  assert.ok(studentPwMatch, 'Student password must match bcrypt hash');
  console.log(`✓ Student authenticated successfully (${studentUser.fullName})`);

  const studentProfile = await studentConn.db.collection('studentprofiles').findOne({ user: studentUser._id });
  assert.ok(studentProfile, 'Student profile must exist');
  assert.strictEqual(studentProfile.profileCompleted, true, 'Student profile must be complete');
  console.log(`✓ Student profile verified: ${studentProfile.university} - ${studentProfile.faculty}`);

  const studentApp = await studentConn.db.collection('applications').findOne({ student: studentUser._id, course: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(studentApp, 'Student application must exist');
  assert.strictEqual(studentApp.status, 'Confirmed', 'Application status must be Confirmed');
  console.log(`✓ Application verified: Ref ${studentApp.referenceNumber}, status ${studentApp.status}`);

  const studentInvoice = await studentConn.db.collection('invoices').findOne({ student: studentUser._id, course: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(studentInvoice, 'Student invoice must exist');
  assert.strictEqual(studentInvoice.status, 'Paid', 'Invoice status must be Paid');
  assert.strictEqual(studentInvoice.amount, 3500, 'Invoice amount must match course price');
  console.log(`✓ Invoice verified: ${studentInvoice.invoiceNumber}, status ${studentInvoice.status}, total ${studentInvoice.amount} ${studentInvoice.currency}`);

  const studentEnrollment = await studentConn.db.collection('enrollments').findOne({ student: studentUser._id, course: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(studentEnrollment, 'Student enrollment must exist');
  assert.strictEqual(studentEnrollment.status, 'Confirmed', 'Enrollment status must be Confirmed');
  console.log(`✓ Enrollment verified: ID ${studentEnrollment._id}, status ${studentEnrollment.status}`);

  console.log('\n--- 3. VERIFY DEMO INSTRUCTOR & SESSIONS ---');
  const instUser = await instructorConn.db.collection('users').findOne({ email: 'demo.instructor@egsa.invalid' }, { projection: { passwordHash: 1, email: 1, name: 1, role: 1 } });
  assert.ok(instUser, 'demo.instructor@egsa.invalid must exist in Instructor DB');
  const instPwMatch = await bcrypt.compare('EgsaDemoInstructor2026!', instUser.passwordHash);
  assert.ok(instPwMatch, 'Instructor password must match bcrypt hash');
  console.log(`✓ Instructor authenticated successfully in Instructor DB (${instUser.name})`);

  const instCourse = await instructorConn.db.collection('courses').findOne({ externalCourseId: TARGET_COURSE_ID });
  assert.ok(instCourse, 'Course must exist in Instructor DB');
  assert.strictEqual(instCourse.assignedInstructor.toString(), instUser._id.toString(), 'Course must be assigned to demo instructor');
  console.log(`✓ Course "${instCourse.name}" assigned to demo instructor in Instructor DB`);

  const instCohort = await instructorConn.db.collection('cohorts').findOne({ course: instCourse._id });
  assert.ok(instCohort, 'Cohort must exist in Instructor DB');
  console.log(`✓ Cohort verified: "${instCohort.name}"`);

  const instSessions = await instructorConn.db.collection('sessions').find({ cohort: instCohort._id }).toArray();
  assert.ok(instSessions.length >= 2, 'Must have at least 2 scheduled sessions');
  console.log(`✓ Scheduled sessions verified (${instSessions.length} sessions upcoming)`);

  const studentRef = await instructorConn.db.collection('studentreferences').findOne({ externalStudentId: studentUser._id.toString() });
  assert.ok(studentRef, 'Student reference must exist in Instructor DB');
  const enrollRef = await instructorConn.db.collection('enrollmentreferences').findOne({ student: studentRef._id, cohort: instCohort._id });
  assert.ok(enrollRef, 'Enrollment reference must link student to cohort in Instructor DB');
  console.log(`✓ Enrolled student appears in Instructor roster: ${studentRef.name} (${studentRef.email})`);

  console.log('\n--- 4. VERIFY DEMO UNIVERSITY ADMIN ---');
  const adminUser = await adminConn.db.collection('users').findOne({ email: 'demo.uni.admin@egsa.invalid' }, { projection: { passwordHash: 1, email: 1, fullName: 1, role: 1, division: 1 } });
  assert.ok(adminUser, 'demo.uni.admin@egsa.invalid must exist in Admin DB');
  const adminPwMatch = await bcrypt.compare('EgsaDemoAdmin2026!', adminUser.passwordHash);
  assert.ok(adminPwMatch, 'Admin password must match bcrypt hash');
  assert.strictEqual(adminUser.role, 'UNIVERSITY_ADMIN', 'Role must be UNIVERSITY_ADMIN');
  assert.strictEqual(adminUser.division, 'UNIVERSITY', 'Division must be UNIVERSITY');
  console.log(`✓ University Admin authenticated successfully in Admin DB (${adminUser.fullName})`);

  const adminScope = await adminConn.db.collection('adminscopes').findOne({ user: adminUser._id });
  assert.ok(adminScope, 'Admin scope must exist');
  assert.strictEqual(adminScope.division, 'UNIVERSITY', 'Admin scope division must be UNIVERSITY');
  console.log(`✓ AdminScope verified: division ${adminScope.division}`);

  const adminCourse = await adminConn.db.collection('courses').findOne({ _id: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(adminCourse, 'Admin course must exist');
  assert.strictEqual(adminCourse.status, 'ACTIVE', 'Admin course status must be ACTIVE');
  assert.ok(adminCourse.occupiedSeats >= 1, `Occupied seats must be at least 1, got ${adminCourse.occupiedSeats}`);
  console.log(`✓ Admin course verified: "${adminCourse.title}" (status ${adminCourse.status}, occupiedSeats: ${adminCourse.occupiedSeats})`);

  const adminStudentUser = await adminConn.db.collection('users').findOne({ email: 'demo.student@egsa.invalid' });
  assert.ok(adminStudentUser, 'Demo student must exist in Admin DB');

  const adminApp = await adminConn.db.collection('applications').findOne({ student: adminStudentUser._id, program: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(adminApp, 'Admin application must exist');
  assert.strictEqual(adminApp.status, 'CONFIRMED', 'Admin application status must be CONFIRMED');
  console.log(`✓ Admin application verified: status ${adminApp.status}, decision ${adminApp.decision}`);

  const adminEnroll = await adminConn.db.collection('enrollments').findOne({ student: adminStudentUser._id, program: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(adminEnroll, 'Admin enrollment must exist');
  assert.strictEqual(adminEnroll.status, 'CONFIRMED', 'Admin enrollment status must be CONFIRMED');
  console.log(`✓ Admin enrollment verified: status ${adminEnroll.status}`);

  const adminInv = await adminConn.db.collection('invoices').findOne({ student: adminStudentUser._id, program: new mongoose.Types.ObjectId(TARGET_COURSE_ID) });
  assert.ok(adminInv, 'Admin invoice must exist');
  assert.strictEqual(adminInv.status, 'PAID', 'Admin invoice status must be PAID');
  console.log(`✓ Admin invoice verified: status ${adminInv.status}, amount ${adminInv.amount}`);

  console.log('\n--- 5. RELATIONAL INTEGRITY / ORPHAN CHECK ---');
  // Check no orphan enrollments in Student DB
  const allStudentEnrolls = await studentConn.db.collection('enrollments').find({}).toArray();
  const allStudentUserIds = new Set((await studentConn.db.collection('users').find({}).toArray()).map((u) => u._id.toString()));
  for (const e of allStudentEnrolls) {
    const uid = (e.student || e.userId)?.toString();
    if (uid) {
      assert.ok(allStudentUserIds.has(uid), `Found orphan enrollment ${e._id} pointing to non-existent user ${uid}`);
    }
  }
  console.log(`✓ All ${allStudentEnrolls.length} enrollments in Student DB have valid user references.`);

  await studentConn.close();
  await instructorConn.close();
  await adminConn.close();

  console.log('\n====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('====================================================\n');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
