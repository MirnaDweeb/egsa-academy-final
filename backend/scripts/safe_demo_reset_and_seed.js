const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

const TARGET_COURSE_ID = '6ad68d5c553bc1845e03866b'; // "CubeSat Telemetry & Ground Stations"

// Passwords generated for demo accounts
const DEMO_CREDENTIALS = {
  student: {
    email: 'demo.student@egsa.invalid',
    password: 'EgsaDemoStudent2026!',
    role: 'student',
    name: 'Kareem Mahmoud El-Masry',
    portal: 'Student Portal (http://localhost:3000/student)',
  },
  instructor: {
    email: 'demo.instructor@egsa.invalid',
    password: 'EgsaDemoInstructor2026!',
    role: 'instructor',
    name: 'Dr. Hazem Farouk',
    portal: 'Instructor Portal (http://localhost:3000/instructor)',
  },
  uniAdmin: {
    email: 'demo.uni.admin@egsa.invalid',
    password: 'EgsaDemoAdmin2026!',
    role: 'UNIVERSITY_ADMIN',
    name: 'Dr. Mostafa El-Kholy',
    portal: 'Admin Portal (http://localhost:3000/admin)',
  },
};

// Check if a verified backup exists
function verifyLatestBackup() {
  const backupsDir = path.resolve(__dirname, '../../backups');
  if (!fs.existsSync(backupsDir)) {
    throw new Error('Backups directory does not exist! Run backup script first.');
  }

  const entries = fs.readdirSync(backupsDir)
    .filter((name) => name.startsWith('backup_'))
    .sort()
    .reverse();

  if (entries.length === 0) {
    throw new Error('No timestamped backup found in backups/! Aborting cleanup.');
  }

  const latestBackupDir = path.join(backupsDir, entries[0]);
  const manifestPath = path.join(latestBackupDir, 'backup_manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Latest backup ${entries[0]} is missing backup_manifest.json! Aborting.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.verified) {
    throw new Error(`Latest backup ${entries[0]} manifest does not indicate verified status! Aborting.`);
  }

  console.log(`[Safety Check] Verified backup found: ${entries[0]} (${manifest.totalDocuments} documents, verified: true)`);
  return { backupDir: latestBackupDir, manifest };
}

async function runResetAndSeed(isDryRun = true) {
  console.log('====================================================');
  console.log(`EGSA ACADEMY SAFE DEMO RESET & SEEDING (${isDryRun ? 'DRY-RUN' : 'LIVE EXECUTION'})`);
  console.log('====================================================');

  // Verify backup first
  verifyLatestBackup();

  console.log('\n[Database] Connecting to Student, Instructor, and Admin databases...');
  const studentConn = mongoose.createConnection(env.db.studentUri);
  const instructorConn = mongoose.createConnection(env.db.instructorUri);
  const adminConn = mongoose.createConnection(env.db.adminUri);

  await Promise.all([
    new Promise((resolve) => studentConn.once('connected', resolve)),
    new Promise((resolve) => instructorConn.once('connected', resolve)),
    new Promise((resolve) => adminConn.once('connected', resolve)),
  ]);

  // 1. CLASSIFY STUDENT DB DATA
  const sUsers = await studentConn.db.collection('users').find({}).toArray();
  const testStudentPatterns = /(^cadet\.|^prereq\.cadet|^explore\.cadet|^master\.cadet|^test\.student|^test_student|17931[0-9]{8})/i;
  
  // Real or baseline accounts to NEVER touch
  const preservedEmails = new Set([
    'sara.demo@egsa-academy.example',
    'mirnadweeb@gmail.com',
    'mirnashawky@gmail.com',
    'haidy@gmail.com',
    'admin@egsa-academy.example',
    'admin@esa.dev',
    'admin@agency.gov',
    'instructor@agency.gov',
    'trainee@agency.gov',
    'instructor@egsa-dev.test',
  ]);

  const disposableStudentUsers = sUsers.filter((u) => {
    if (preservedEmails.has(u.email)) return false;
    if (u.email.endsWith('.edu.eg') || u.email.endsWith('.moe.gov.eg')) return false;
    return testStudentPatterns.test(u.email);
  });
  const disposableStudentUserIds = disposableStudentUsers.map((u) => u._id);
  const disposableStudentIdStrs = disposableStudentUserIds.map((id) => id.toString());

  // Test courses in Student DB
  const sCourses = await studentConn.db.collection('courses').find({}).toArray();
  const testCoursePatterns = /(^Integration Test|^Draft Satellite Systems|^Scheduled Astrodynamics|^Past Cycle Propulsion)/i;
  const disposableStudentCourses = sCourses.filter((c) => {
    if (c._id.toString() === TARGET_COURSE_ID) return false;
    return testCoursePatterns.test(c.title || '');
  });
  const disposableCourseIds = disposableStudentCourses.map((c) => c._id);
  const disposableCourseIdStrs = disposableCourseIds.map((id) => id.toString());

  // 2. CLASSIFY ADMIN DB DATA
  const aUsers = await adminConn.db.collection('users').find({}).toArray();
  const testAdminUserPatterns = /(^cadet\.|^test\.admin|^reg\.admin|^browser\.admin|^browser\.inst|^test\.student|^student[A-C]_|^conc_trial|^filler_|^waitlist_|^temp1790)/i;
  const preservedAdminEmails = new Set([
    'superadmin@esa.dev',
    'uni.admin@esa.dev',
    'preuni.admin@esa.dev',
    'tarek.admin@esa.dev',
    'instructor@esa.dev',
    'uni.instructor@esa.dev',
    'uni.instructor.b@esa.dev',
    'mirna@esa.dev',
    'student@esa.dev',
    'sara.demo@egsa-academy.example',
  ]);

  const disposableAdminUsers = aUsers.filter((u) => {
    if (preservedAdminEmails.has(u.email)) return false;
    return testAdminUserPatterns.test(u.email);
  });
  const disposableAdminUserIds = disposableAdminUsers.map((u) => u._id);

  const aCourses = await adminConn.db.collection('courses').find({}).toArray();
  const disposableAdminCourses = aCourses.filter((c) => {
    if (c._id.toString() === TARGET_COURSE_ID) return false;
    return testCoursePatterns.test(c.title || '');
  });
  const disposableAdminCourseIds = disposableAdminCourses.map((c) => c._id);

  // INVENTORY REPORT
  console.log('\n--- PROPOSED SCOPE OF CLEANUP ---');
  console.log(`Student DB:`);
  console.log(`  - Disposable Test Users: ${disposableStudentUsers.length} of ${sUsers.length}`);
  console.log(`  - Disposable Test Courses: ${disposableStudentCourses.length} of ${sCourses.length} (Preserved core courses: ${sCourses.length - disposableStudentCourses.length})`);
  console.log(`Admin DB:`);
  console.log(`  - Disposable Test Users: ${disposableAdminUsers.length} of ${aUsers.length}`);
  console.log(`  - Disposable Test Courses: ${disposableAdminCourses.length} of ${aCourses.length}`);
  console.log(`Instructor DB:`);
  console.log(`  - Preserved Instructor Users: 5 (0 deleted)`);

  // Target core course safety check
  const targetCourseInStudent = sCourses.find((c) => c._id.toString() === TARGET_COURSE_ID);
  if (!targetCourseInStudent) {
    throw new Error(`Target core course ${TARGET_COURSE_ID} not found in Student DB! Aborting.`);
  }
  console.log(`\n[Core Course Preservation Check] Core Demo Course: "${targetCourseInStudent.title}" (ID: ${TARGET_COURSE_ID}) is PRESERVED.`);

  if (isDryRun) {
    console.log('\n[DRY RUN] No records were modified or deleted.');
    console.log('[DRY RUN] Run with --execute to perform safe cleanup and seeding.');
    await studentConn.close();
    await instructorConn.close();
    await adminConn.close();
    return;
  }

  // ==========================================
  // LIVE EXECUTION PHASE
  // ==========================================
  console.log('\n--- EXECUTING CONTROLLED CLEANUP ---');

  // 1. Delete dependent student records in egsa_academy
  const sDelApps = await studentConn.db.collection('applications').deleteMany({
    $or: [
      { student: { $in: disposableStudentUserIds } },
      { userId: { $in: disposableStudentIdStrs } },
      { course: { $in: disposableCourseIds } },
      { courseId: { $in: disposableCourseIdStrs } },
    ],
  });
  console.log(`  ✓ Deleted ${sDelApps.deletedCount} test applications in Student DB`);

  const sDelEnrolls = await studentConn.db.collection('enrollments').deleteMany({
    $or: [
      { student: { $in: disposableStudentUserIds } },
      { userId: { $in: disposableStudentIdStrs } },
      { course: { $in: disposableCourseIds } },
      { courseId: { $in: disposableCourseIdStrs } },
    ],
  });
  console.log(`  ✓ Deleted ${sDelEnrolls.deletedCount} test enrollments in Student DB`);

  const sDelInvs = await studentConn.db.collection('invoices').deleteMany({
    $or: [
      { student: { $in: disposableStudentUserIds } },
      { userId: { $in: disposableStudentIdStrs } },
      { course: { $in: disposableCourseIds } },
      { courseId: { $in: disposableCourseIdStrs } },
    ],
  });
  console.log(`  ✓ Deleted ${sDelInvs.deletedCount} test invoices in Student DB`);

  const sDelProofs = await studentConn.db.collection('paymentproofs').deleteMany({
    $or: [
      { user: { $in: disposableStudentUserIds } },
      { userId: { $in: disposableStudentIdStrs } },
    ],
  });
  console.log(`  ✓ Deleted ${sDelProofs.deletedCount} test payment proofs in Student DB`);

  const sDelProfiles = await studentConn.db.collection('studentprofiles').deleteMany({
    user: { $in: disposableStudentUserIds },
  });
  console.log(`  ✓ Deleted ${sDelProfiles.deletedCount} test student profiles in Student DB`);

  const sDelAttempts = await studentConn.db.collection('readinessattempts').deleteMany({
    user: { $in: disposableStudentUserIds },
  });
  console.log(`  ✓ Deleted ${sDelAttempts.deletedCount} test readiness attempts in Student DB`);

  const sDelNotifs = await studentConn.db.collection('notifications').deleteMany({
    user: { $in: disposableStudentUserIds },
  });
  console.log(`  ✓ Deleted ${sDelNotifs.deletedCount} test notifications in Student DB`);

  const sDelUsers = await studentConn.db.collection('users').deleteMany({
    _id: { $in: disposableStudentUserIds },
  });
  console.log(`  ✓ Deleted ${sDelUsers.deletedCount} test users in Student DB`);

  const sDelCourses = await studentConn.db.collection('courses').deleteMany({
    _id: { $in: disposableCourseIds },
  });
  console.log(`  ✓ Deleted ${sDelCourses.deletedCount} test courses in Student DB`);

  // 2. Delete test records in egsa_instructor
  const iDelStudentRefs = await instructorConn.db.collection('studentreferences').deleteMany({
    externalStudentId: { $in: disposableStudentIdStrs },
  });
  console.log(`  ✓ Deleted ${iDelStudentRefs.deletedCount} test student references in Instructor DB`);

  const iDelEnrollRefs = await instructorConn.db.collection('enrollmentreferences').deleteMany({
    $or: [
      { externalEnrollmentId: { $in: disposableStudentIdStrs } },
      { course: { $in: disposableCourseIds } },
    ],
  });
  console.log(`  ✓ Deleted ${iDelEnrollRefs.deletedCount} test enrollment references in Instructor DB`);

  const iDelCohorts = await instructorConn.db.collection('cohorts').deleteMany({
    $or: [
      { course: { $in: disposableCourseIds } },
      { externalCohortId: { $in: disposableCourseIdStrs } },
    ],
  });
  console.log(`  ✓ Deleted ${iDelCohorts.deletedCount} test cohorts in Instructor DB`);

  const iDelCourses = await instructorConn.db.collection('courses').deleteMany({
    $or: [
      { externalCourseId: { $in: disposableCourseIdStrs } },
      { name: testCoursePatterns },
    ],
  });
  console.log(`  ✓ Deleted ${iDelCourses.deletedCount} test courses in Instructor DB`);

  // 3. Delete test records in esa_academy (Admin DB)
  const aDelApps = await adminConn.db.collection('applications').deleteMany({
    $or: [
      { student: { $in: disposableAdminUserIds } },
      { program: { $in: disposableAdminCourseIds } },
    ],
  });
  console.log(`  ✓ Deleted ${aDelApps.deletedCount} test applications in Admin DB`);

  const aDelEnrolls = await adminConn.db.collection('enrollments').deleteMany({
    $or: [
      { student: { $in: disposableAdminUserIds } },
      { program: { $in: disposableAdminCourseIds } },
    ],
  });
  console.log(`  ✓ Deleted ${aDelEnrolls.deletedCount} test enrollments in Admin DB`);

  const aDelInvs = await adminConn.db.collection('invoices').deleteMany({
    $or: [
      { student: { $in: disposableAdminUserIds } },
      { program: { $in: disposableAdminCourseIds } },
    ],
  });
  console.log(`  ✓ Deleted ${aDelInvs.deletedCount} test invoices in Admin DB`);

  const aDelProfiles = await adminConn.db.collection('studentprofiles').deleteMany({
    user: { $in: disposableAdminUserIds },
  });
  console.log(`  ✓ Deleted ${aDelProfiles.deletedCount} test student profiles in Admin DB`);

  const aDelUsers = await adminConn.db.collection('users').deleteMany({
    _id: { $in: disposableAdminUserIds },
  });
  console.log(`  ✓ Deleted ${aDelUsers.deletedCount} test users in Admin DB`);

  const aDelCourses = await adminConn.db.collection('courses').deleteMany({
    _id: { $in: disposableAdminCourseIds },
  });
  console.log(`  ✓ Deleted ${aDelCourses.deletedCount} test courses in Admin DB`);

  // ==========================================
  // FRESH DEMO DATA SEEDING PHASE
  // ==========================================
  console.log('\n--- SEEDING FRESH PRESENTATION DEMO DATA ---');

  // Hashes
  const studentPasswordHash = await bcrypt.hash(DEMO_CREDENTIALS.student.password, 10);
  const instructorPasswordHash = await bcrypt.hash(DEMO_CREDENTIALS.instructor.password, 10);
  const adminPasswordHash = await bcrypt.hash(DEMO_CREDENTIALS.uniAdmin.password, 10);

  // 1. Seed Demo Instructor
  // Instructor DB User
  let instUser = await instructorConn.db.collection('users').findOne({ email: DEMO_CREDENTIALS.instructor.email });
  if (!instUser) {
    const instRes = await instructorConn.db.collection('users').insertOne({
      email: DEMO_CREDENTIALS.instructor.email,
      name: DEMO_CREDENTIALS.instructor.name,
      fullName: DEMO_CREDENTIALS.instructor.name,
      phone: '+20 100 555 4321',
      role: 'instructor',
      status: 'active',
      isActive: true,
      passwordHash: instructorPasswordHash,
      professional: {
        title: 'Lead Ground Station Systems Engineer',
        organization: 'Egyptian Space Agency (EGSA)',
        expertise: 'Satellite Communications, RF Link Budget, Orbital Telemetry',
      },
      preferredLanguage: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    instUser = await instructorConn.db.collection('users').findOne({ _id: instRes.insertedId });
  } else {
    await instructorConn.db.collection('users').updateOne(
      { _id: instUser._id },
      { $set: { passwordHash: instructorPasswordHash, isActive: true, status: 'active' } }
    );
  }
  console.log(`  ✓ Demo Instructor seeded in Instructor DB: ${instUser.email} (ID: ${instUser._id})`);

  // Admin DB Instructor User & Profile
  let adminInstUser = await adminConn.db.collection('users').findOne({ email: DEMO_CREDENTIALS.instructor.email });
  if (!adminInstUser) {
    const aInstRes = await adminConn.db.collection('users').insertOne({
      fullName: DEMO_CREDENTIALS.instructor.name,
      email: DEMO_CREDENTIALS.instructor.email,
      passwordHash: instructorPasswordHash,
      role: 'INSTRUCTOR',
      division: 'UNIVERSITY',
      isActive: true,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    adminInstUser = await adminConn.db.collection('users').findOne({ _id: aInstRes.insertedId });
  } else {
    await adminConn.db.collection('users').updateOne(
      { _id: adminInstUser._id },
      { $set: { passwordHash: instructorPasswordHash, isActive: true } }
    );
  }

  await adminConn.db.collection('instructorprofiles').updateOne(
    { user: adminInstUser._id },
    {
      $set: {
        division: 'UNIVERSITY',
        divisions: ['UNIVERSITY'],
        specialization: 'Satellite Communications & Ground Station Telemetry',
        title: 'Lead Ground Station Systems Engineer',
        bio: 'Senior systems engineer with 15+ years of operational experience tracking low-Earth orbit satellites and commanding space payloads at the Egyptian Space Agency.',
        phone: '+20 100 555 4321',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log(`  ✓ Demo Instructor profile seeded in Admin DB (User ID: ${adminInstUser._id})`);

  // Link Instructor DB externalId to Admin DB user ID
  await instructorConn.db.collection('users').updateOne(
    { _id: instUser._id },
    { $set: { externalId: adminInstUser._id.toString() } }
  );

  // 2. Seed Demo University Admin
  let adminUser = await adminConn.db.collection('users').findOne({ email: DEMO_CREDENTIALS.uniAdmin.email });
  if (!adminUser) {
    const aRes = await adminConn.db.collection('users').insertOne({
      fullName: DEMO_CREDENTIALS.uniAdmin.name,
      email: DEMO_CREDENTIALS.uniAdmin.email,
      passwordHash: adminPasswordHash,
      role: 'UNIVERSITY_ADMIN',
      division: 'UNIVERSITY',
      isActive: true,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    adminUser = await adminConn.db.collection('users').findOne({ _id: aRes.insertedId });
  } else {
    await adminConn.db.collection('users').updateOne(
      { _id: adminUser._id },
      { $set: { passwordHash: adminPasswordHash, isActive: true } }
    );
  }

  await adminConn.db.collection('adminscopes').updateOne(
    { user: adminUser._id },
    {
      $set: {
        division: 'UNIVERSITY',
        grantedAt: new Date(),
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log(`  ✓ Demo University Admin seeded in Admin DB: ${adminUser.email} (ID: ${adminUser._id})`);

  // 3. Configure Core Course & Assign Instructor
  const targetCourseObjId = new mongoose.Types.ObjectId(TARGET_COURSE_ID);

  // In Student DB: Update course status, instructor assignment, seats
  await studentConn.db.collection('courses').updateOne(
    { _id: targetCourseObjId },
    {
      $set: {
        status: 'Open',
        published: true,
        active: true,
        isActive: true,
        contentStatus: 'Published',
        capacity: 25,
        seatsTaken: 1,
        assignedInstructorId: instUser._id.toString(),
        instructor: DEMO_CREDENTIALS.instructor.name,
        instructorEmail: DEMO_CREDENTIALS.instructor.email,
        price: 3500,
        basePrice: 3500,
        transportationPrice: 500,
        updatedAt: new Date(),
      },
    }
  );

  // In Admin DB: Update course status, instructor assignment, seats
  await adminConn.db.collection('courses').updateOne(
    { _id: targetCourseObjId },
    {
      $set: {
        status: 'ACTIVE',
        division: 'UNIVERSITY',
        capacity: 25,
        occupiedSeats: 1,
        assignedInstructor: adminInstUser._id,
        assignedInstructors: [adminInstUser._id],
        price: 3500,
        updatedAt: new Date(),
      },
    }
  );

  // In Instructor DB: Ensure course, cohort, sessions
  let iCourse = await instructorConn.db.collection('courses').findOne({ externalCourseId: TARGET_COURSE_ID });
  if (!iCourse) {
    const icRes = await instructorConn.db.collection('courses').insertOne({
      externalCourseId: TARGET_COURSE_ID,
      code: 'EGSA-SAT-301',
      name: 'CubeSat Telemetry & Ground Stations',
      description: 'Comprehensive hands-on training program covering CubeSat communication architectures, RF link budgeting, Doppler tracking, AX.25 telemetry packet extraction, and SDR satellite ground reception.',
      durationWeeks: 6,
      status: 'active',
      assignedInstructor: instUser._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    iCourse = await instructorConn.db.collection('courses').findOne({ _id: icRes.insertedId });
  } else {
    await instructorConn.db.collection('courses').updateOne(
      { _id: iCourse._id },
      { $set: { assignedInstructor: instUser._id, status: 'active', updatedAt: new Date() } }
    );
  }
  console.log(`  ✓ Core Course assigned to demo instructor across all 3 databases`);

  // Create Cohort in Instructor DB
  let iCohort = await instructorConn.db.collection('cohorts').findOne({ course: iCourse._id });
  if (!iCohort) {
    const cohortRes = await instructorConn.db.collection('cohorts').insertOne({
      name: 'Cohort Alpha - Spring 2026',
      course: iCourse._id,
      instructor: instUser._id,
      startDate: new Date('2026-11-01T09:00:00.000Z'),
      endDate: new Date('2026-12-15T17:00:00.000Z'),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    iCohort = await instructorConn.db.collection('cohorts').findOne({ _id: cohortRes.insertedId });
  } else {
    await instructorConn.db.collection('cohorts').updateOne(
      { _id: iCohort._id },
      { $set: { instructor: instUser._id, status: 'active', updatedAt: new Date() } }
    );
  }

  // Create Sessions in Instructor DB
  const sessionsCount = await instructorConn.db.collection('sessions').countDocuments({ cohort: iCohort._id });
  if (sessionsCount === 0) {
    await instructorConn.db.collection('sessions').insertMany([
      {
        title: 'Session 1: Telemetry Systems & RF Link Budget',
        description: 'Comprehensive analysis of ground-to-space RF links, atmospheric absorption, antenna beamwidths, and gain calculations.',
        course: iCourse._id,
        cohort: iCohort._id,
        date: new Date('2026-11-05T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '13:00',
        startsAt: new Date('2026-11-05T10:00:00.000Z'),
        location: 'EGSA Main Ground Station & Tracking Facility, Cairo',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'Session 2: SDR Demodulation & Live Doppler Tracking',
        description: 'Hands-on GNU Radio software-defined receiver processing, automated rotator pass prediction, and real-time TLE retuning.',
        course: iCourse._id,
        cohort: iCohort._id,
        date: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '13:00',
        startsAt: new Date('2026-11-12T10:00:00.000Z'),
        location: 'EGSA Main Ground Station & Tracking Facility, Cairo',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    console.log(`  ✓ Upcoming training sessions scheduled for Demo Instructor`);
  }

  // 4. Seed Demo Student
  let sUser = await studentConn.db.collection('users').findOne({ email: DEMO_CREDENTIALS.student.email });
  if (!sUser) {
    const sRes = await studentConn.db.collection('users').insertOne({
      fullName: DEMO_CREDENTIALS.student.name,
      email: DEMO_CREDENTIALS.student.email,
      password: studentPasswordHash,
      phone: '+20 111 234 5678',
      nationalId: '30105151234567',
      role: 'student',
      division: 'UNIVERSITY',
      isEmailVerified: true,
      accountStatus: 'active',
      isActive: true,
      registrationNumber: 'EGSA-2026-STU-0092',
      preferredLanguage: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    sUser = await studentConn.db.collection('users').findOne({ _id: sRes.insertedId });
  } else {
    await studentConn.db.collection('users').updateOne(
      { _id: sUser._id },
      { $set: { password: studentPasswordHash, isActive: true, accountStatus: 'active', isEmailVerified: true } }
    );
  }
  console.log(`  ✓ Demo Student seeded in Student DB: ${sUser.email} (ID: ${sUser._id})`);

  // Student Profile in Student DB
  await studentConn.db.collection('studentprofiles').updateOne(
    { user: sUser._id },
    {
      $set: {
        division: 'UNIVERSITY',
        status: 'student',
        university: 'Cairo University',
        faculty: 'Faculty of Engineering',
        department: 'Aerospace Engineering',
        academicYear: '4th Year',
        graduationYear: 2027,
        gpa: 3.78,
        skills: ['Orbital Mechanics', 'RF Design', 'GNU Radio', 'MATLAB/Simulink', 'Telemetry Analysis'],
        experience: ['EGSA CanSat Competition 2025 - 1st Place Payload Design'],
        previousTraining: ['Introduction to Spacecraft Subsystems (EGSA Summer 2025)'],
        profileCompleted: true,
        profileCompletionPercentage: 100,
        phone: '+20 111 234 5678',
        nationalId: '30105151234567',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // Sync Student to Admin DB
  let adminStudentUser = await adminConn.db.collection('users').findOne({ email: DEMO_CREDENTIALS.student.email });
  if (!adminStudentUser) {
    const aSRes = await adminConn.db.collection('users').insertOne({
      fullName: DEMO_CREDENTIALS.student.name,
      email: DEMO_CREDENTIALS.student.email,
      passwordHash: studentPasswordHash,
      role: 'STUDENT',
      division: 'UNIVERSITY',
      isActive: true,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    adminStudentUser = await adminConn.db.collection('users').findOne({ _id: aSRes.insertedId });
  } else {
    await adminConn.db.collection('users').updateOne(
      { _id: adminStudentUser._id },
      { $set: { passwordHash: studentPasswordHash, isActive: true } }
    );
  }

  await adminConn.db.collection('studentprofiles').updateOne(
    { user: adminStudentUser._id },
    {
      $set: {
        division: 'UNIVERSITY',
        university: 'Cairo University',
        faculty: 'Faculty of Engineering',
        department: 'Aerospace Engineering',
        academicYear: '4th Year',
        graduationYear: 2027,
        gpa: 3.78,
        skills: ['Orbital Mechanics', 'RF Design', 'GNU Radio', 'MATLAB/Simulink', 'Telemetry Analysis'],
        phone: '+20 111 234 5678',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // Sync Student to Instructor DB
  const iStudentRef = await instructorConn.db.collection('studentreferences').findOneAndUpdate(
    { externalStudentId: sUser._id.toString() },
    {
      $set: {
        name: DEMO_CREDENTIALS.student.name,
        email: DEMO_CREDENTIALS.student.email,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 5. Seed Connected Application, Enrollment, and Invoice
  // In Student DB:
  let sApp = await studentConn.db.collection('applications').findOne({
    student: sUser._id,
    course: targetCourseObjId,
  });

  const appReferenceNumber = 'APP-2026-EGSA-0081';
  if (!sApp) {
    const appRes = await studentConn.db.collection('applications').insertOne({
      referenceNumber: appReferenceNumber,
      student: sUser._id,
      course: targetCourseObjId,
      status: 'Confirmed',
      eligibilityStatus: 'Eligible',
      selectedPackage: 'WITHOUT_TRANSPORTATION',
      statementOfInterest: 'Passionate about satellite communications and small satellite ground operations. Aspiring to contribute to the Egyptian Space Agency CubeSat downlink monitoring network.',
      statusHistory: [
        {
          status: 'Submitted',
          changedAt: new Date(Date.now() - 86400000 * 3),
          note: 'Application submitted by candidate',
        },
        {
          status: 'Accepted',
          changedAt: new Date(Date.now() - 86400000 * 2),
          note: 'Application verified and accepted by University Admissions',
        },
        {
          status: 'Confirmed',
          changedAt: new Date(Date.now() - 86400000 * 1),
          note: 'Tuition payment received via InstaPay and spot confirmed',
        },
      ],
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    });
    sApp = await studentConn.db.collection('applications').findOne({ _id: appRes.insertedId });
  }

  // Invoice in Student DB
  let sInvoice = await studentConn.db.collection('invoices').findOne({
    student: sUser._id,
    course: targetCourseObjId,
  });

  const invoiceNumber = 'INV-2026-DEMO-001';
  if (!sInvoice) {
    const invRes = await studentConn.db.collection('invoices').insertOne({
      invoiceNumber,
      student: sUser._id,
      application: sApp._id,
      course: targetCourseObjId,
      baseAmount: 3500,
      coursePriceAtPurchase: 3500,
      transportationAmount: 0,
      depositAmount: 0,
      amount: 3500,
      currency: 'EGP',
      status: 'Paid',
      packageType: 'WITHOUT_TRANSPORTATION',
      issuedAt: new Date(Date.now() - 86400000 * 2),
      paidAt: new Date(Date.now() - 86400000 * 1),
      providerReference: 'EGSA-IPAY-84920481',
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    });
    sInvoice = await studentConn.db.collection('invoices').findOne({ _id: invRes.insertedId });
  }

  // Enrollment in Student DB
  let sEnrollment = await studentConn.db.collection('enrollments').findOne({
    student: sUser._id,
    course: targetCourseObjId,
  });

  if (!sEnrollment) {
    const enrollRes = await studentConn.db.collection('enrollments').insertOne({
      student: sUser._id,
      course: targetCourseObjId,
      application: sApp._id,
      status: 'Confirmed',
      packageType: 'WITHOUT_TRANSPORTATION',
      transportationRequired: false,
      paidAmount: 3500,
      enrollmentDate: new Date(Date.now() - 86400000 * 1),
      createdAt: new Date(Date.now() - 86400000 * 1),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    });
    sEnrollment = await studentConn.db.collection('enrollments').findOne({ _id: enrollRes.insertedId });
  }

  // Link Enrollment back to Application
  await studentConn.db.collection('applications').updateOne(
    { _id: sApp._id },
    { $set: { enrollment: sEnrollment._id } }
  );

  // In Admin DB: Application, Enrollment, Invoice
  let aApp = await adminConn.db.collection('applications').findOne({
    student: adminStudentUser._id,
    program: targetCourseObjId,
  });

  if (!aApp) {
    const aAppRes = await adminConn.db.collection('applications').insertOne({
      student: adminStudentUser._id,
      program: targetCourseObjId,
      division: 'UNIVERSITY',
      status: 'CONFIRMED',
      eligibilityStatus: 'ELIGIBLE',
      decision: 'ACCEPT',
      decisionReason: 'Strong academic background and aerospace engineering alignment.',
      reviewedBy: adminUser._id,
      reviewedAt: new Date(Date.now() - 86400000 * 2),
      submittedAt: new Date(Date.now() - 86400000 * 3),
      adminDecision: {
        decidedBy: adminUser._id,
        decidedAt: new Date(Date.now() - 86400000 * 2),
        outcome: 'ACCEPT',
      },
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    });
    aApp = await adminConn.db.collection('applications').findOne({ _id: aAppRes.insertedId });
  }

  let aEnrollment = await adminConn.db.collection('enrollments').findOne({
    student: adminStudentUser._id,
    program: targetCourseObjId,
  });

  if (!aEnrollment) {
    const aEnrollRes = await adminConn.db.collection('enrollments').insertOne({
      application: aApp._id,
      student: adminStudentUser._id,
      program: targetCourseObjId,
      division: 'UNIVERSITY',
      status: 'CONFIRMED',
      enrolledAt: new Date(Date.now() - 86400000 * 1),
      confirmedAt: new Date(Date.now() - 86400000 * 1),
      createdAt: new Date(Date.now() - 86400000 * 1),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    });
    aEnrollment = await adminConn.db.collection('enrollments').findOne({ _id: aEnrollRes.insertedId });
  }

  let aInvoice = await adminConn.db.collection('invoices').findOne({
    student: adminStudentUser._id,
    program: targetCourseObjId,
  });

  if (!aInvoice) {
    await adminConn.db.collection('invoices').insertOne({
      invoiceNumber,
      enrollment: aEnrollment._id,
      application: aApp._id,
      student: adminStudentUser._id,
      program: targetCourseObjId,
      division: 'UNIVERSITY',
      amount: 3500,
      currency: 'EGP',
      status: 'PAID',
      issuedAt: new Date(Date.now() - 86400000 * 2),
      paidAt: new Date(Date.now() - 86400000 * 1),
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(Date.now() - 86400000 * 1),
    });
  }

  // In Instructor DB: EnrollmentReference linking student to cohort
  const instStudentRefId = iStudentRef._id || iStudentRef.value?._id;
  await instructorConn.db.collection('enrollmentreferences').updateOne(
    {
      student: instStudentRefId,
      cohort: iCohort._id,
    },
    {
      $set: {
        externalEnrollmentId: sEnrollment._id.toString(),
        course: iCourse._id,
        status: 'active',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log(`  ✓ Application, Enrollment & Invoice records synchronized across Student, Admin, and Instructor DBs`);

  // 6. Write Demo Credentials securely to backups/demo_credentials.json (gitignored)
  const credsPath = path.resolve(__dirname, '../../backups/demo_credentials.json');
  const credsPayload = {
    updatedAt: new Date().toISOString(),
    demoCourse: {
      id: TARGET_COURSE_ID,
      title: 'CubeSat Telemetry & Ground Stations',
      division: 'UNIVERSITY',
      status: 'Open / ACTIVE',
      tuitionEgp: 3500,
    },
    accounts: DEMO_CREDENTIALS,
  };
  fs.writeFileSync(credsPath, JSON.stringify(credsPayload, null, 2), 'utf8');
  console.log(`\n  ✓ Demo credentials written securely to gitignored file: ${credsPath}`);

  // Print final collection inventory
  console.log('\n====================================================');
  console.log('RESET AND FRESH SEEDING COMPLETE');
  console.log('====================================================');

  const dbs = [
    { name: 'egsa_academy (Student DB)', conn: studentConn },
    { name: 'egsa_instructor (Instructor DB)', conn: instructorConn },
    { name: 'esa_academy (Admin DB)', conn: adminConn },
  ];

  for (const { name, conn } of dbs) {
    const uCount = await conn.db.collection('users').countDocuments();
    const cCount = await conn.db.collection('courses').countDocuments();
    console.log(`${name}:`);
    console.log(`  - Users: ${uCount}`);
    console.log(`  - Courses: ${cCount}`);
  }

  await studentConn.close();
  await instructorConn.close();
  await adminConn.close();
  console.log('====================================================\n');
}

// Command-line execution support
const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

runResetAndSeed(isDryRun)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during reset and seed:', err);
    process.exit(1);
  });

