const mongoose = require('mongoose');
const env = require('../src/config/env');

async function inspect() {
  console.log('Connecting to databases...');
  const studentConn = mongoose.createConnection(env.db.studentUri);
  const instructorConn = mongoose.createConnection(env.db.instructorUri);
  const adminConn = mongoose.createConnection(env.db.adminUri);

  await Promise.all([
    new Promise((resolve) => studentConn.once('connected', resolve)),
    new Promise((resolve) => instructorConn.once('connected', resolve)),
    new Promise((resolve) => adminConn.once('connected', resolve)),
  ]);

  console.log('\n========================================');
  console.log('DATABASE INVENTORY');
  console.log('========================================');

  const dbs = [
    { name: 'egsa_academy (Student DB)', conn: studentConn },
    { name: 'egsa_instructor (Instructor DB)', conn: instructorConn },
    { name: 'esa_academy (Admin DB)', conn: adminConn },
  ];

  for (const { name, conn } of dbs) {
    console.log(`\n--- Database: ${name} (${conn.name}) ---`);
    const collections = await conn.db.listCollections().toArray();
    const sortedCols = collections.map((c) => c.name).sort();

    for (const colName of sortedCols) {
      const count = await conn.db.collection(colName).countDocuments();
      console.log(`  - ${colName.padEnd(25)} : ${count} docs`);
    }
  }

  // Inspect Courses
  console.log('\n========================================');
  console.log('COURSES INSPECTION');
  console.log('========================================');

  const studentCourses = await studentConn.db.collection('courses').find({}).toArray();
  const adminCourses = await adminConn.db.collection('courses').find({}).toArray();
  const instructorCourses = await instructorConn.db.collection('courses').find({}).toArray();

  console.log(`Total courses in student DB: ${studentCourses.length}`);
  console.log(`Total courses in admin DB: ${adminCourses.length}`);
  console.log(`Total courses in instructor DB: ${instructorCourses.length}`);

  // Classify courses: Core vs Test
  const testCoursePatterns = [
    /integration/i,
    /window test/i,
    /draft satellite/i,
    /scheduled astrodynamics/i,
    /past cycle/i,
    /cadet/i,
    /test/i,
  ];

  const coreCourses = [];
  const testCourses = [];

  for (const c of studentCourses) {
    const isTest = testCoursePatterns.some((p) => p.test(c.title || '') || p.test(c.slug || '') || p.test(c.code || ''));
    if (isTest) {
      testCourses.push(c);
    } else {
      coreCourses.push(c);
    }
  }

  console.log(`\nCore courses identified in Student DB: ${coreCourses.length}`);
  console.log(`Test/temporary courses identified in Student DB: ${testCourses.length}`);
  console.log('\nSample Core Courses (first 5):');
  coreCourses.slice(0, 5).forEach((c) => {
    console.log(`  ID: ${c._id} | Title: "${c.title}" | Division: ${c.division} | Status: ${c.status} | Published: ${c.published}`);
  });

  if (testCourses.length > 0) {
    console.log('\nTest Courses found in Student DB:');
    testCourses.forEach((c) => {
      console.log(`  ID: ${c._id} | Title: "${c.title}" | Division: ${c.division} | Status: ${c.status}`);
    });
  }

  // Inspect Users
  console.log('\n========================================');
  console.log('USERS INSPECTION');
  console.log('========================================');

  for (const { name, conn } of dbs) {
    console.log(`\nUsers in ${name}:`);
    const users = await conn.db.collection('users').find({}).toArray();
    users.forEach((u) => {
      console.log(`  ID: ${u._id} | Email: ${u.email.padEnd(35)} | Role: ${(u.role || 'n/a').padEnd(12)} | Name: ${u.fullName || u.name || 'n/a'}`);
    });
  }

  // Inspect Enrollments & Applications
  console.log('\n========================================');
  console.log('APPLICATIONS & ENROLLMENTS & INVOICES');
  console.log('========================================');

  const apps = await studentConn.db.collection('applications').find({}).toArray();
  console.log(`\nStudent Applications: ${apps.length}`);
  apps.forEach((a) => {
    console.log(`  App ID: ${a._id} | User: ${a.userId || a.user} | Course: ${a.courseId || a.course} | Status: ${a.status}`);
  });

  const enrollments = await studentConn.db.collection('enrollments').find({}).toArray();
  console.log(`\nStudent Enrollments: ${enrollments.length}`);
  enrollments.forEach((e) => {
    console.log(`  Enrollment ID: ${e._id} | User: ${e.userId || e.user} | Course: ${e.courseId || e.course} | Status: ${e.status}`);
  });

  const invoices = await studentConn.db.collection('invoices').find({}).toArray();
  console.log(`\nStudent Invoices: ${invoices.length}`);
  invoices.forEach((inv) => {
    console.log(`  Invoice ID: ${inv._id} | User: ${inv.userId || inv.user} | Course: ${inv.courseId || inv.course} | Status: ${inv.status} | Total: ${inv.totalAmount || inv.amount}`);
  });

  // Admin Enrollments
  const adminEnrollments = await adminConn.db.collection('enrollments').find({}).toArray();
  console.log(`\nAdmin Enrollments: ${adminEnrollments.length}`);

  // Admin Invoices
  const adminInvoices = await adminConn.db.collection('invoices').find({}).toArray();
  console.log(`\nAdmin Invoices: ${adminInvoices.length}`);

  await studentConn.close();
  await instructorConn.close();
  await adminConn.close();
  console.log('\nInspection complete.');
}

inspect().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});

