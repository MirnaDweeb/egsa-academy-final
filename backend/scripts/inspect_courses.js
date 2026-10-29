const mongoose = require('mongoose');
const env = require('../src/config/env');

async function inspectCourses() {
  const studentConn = mongoose.createConnection(env.db.studentUri);
  const instructorConn = mongoose.createConnection(env.db.instructorUri);
  const adminConn = mongoose.createConnection(env.db.adminUri);

  await Promise.all([
    new Promise((r) => studentConn.once('connected', r)),
    new Promise((r) => instructorConn.once('connected', r)),
    new Promise((r) => adminConn.once('connected', r)),
  ]);

  const sCourses = await studentConn.db.collection('courses').find({}).toArray();
  const aCourses = await adminConn.db.collection('courses').find({}).toArray();
  const iCourses = await instructorConn.db.collection('courses').find({}).toArray();

  console.log(`Student courses count: ${sCourses.length}`);
  console.log(`Admin courses count: ${aCourses.length}`);
  console.log(`Instructor courses count: ${iCourses.length}`);

  // Check IDs overlap
  const sMap = new Map(sCourses.map(c => [c._id.toString(), c]));
  const aMap = new Map(aCourses.map(c => [c._id.toString(), c]));
  const iMap = new Map(iCourses.map(c => [c._id.toString(), c]));

  let inBothStudentAndAdmin = 0;
  for (const [id, c] of sMap.entries()) {
    if (aMap.has(id)) inBothStudentAndAdmin++;
  }
  console.log(`Courses in Student DB that exist with same _id in Admin DB: ${inBothStudentAndAdmin}`);

  // Check admin courses that don't exist in student DB
  const adminOnly = aCourses.filter(c => !sMap.has(c._id.toString()));
  console.log(`Courses in Admin DB not in Student DB: ${adminOnly.length}`);
  console.log('Sample Admin-only courses:');
  adminOnly.slice(0, 10).forEach(c => {
    console.log(`  ID: ${c._id} | Title: "${c.title}" | Status: ${c.status} | Division: ${c.division} | Code: ${c.code}`);
  });

  // Check test courses in Admin DB
  const testPatterns = [/integration/i, /window test/i, /cadet/i, /test/i, /draft satellite/i, /scheduled astrodynamics/i, /past cycle/i];
  const aTest = aCourses.filter(c => testPatterns.test(c.title || '') || testPatterns.test(c.code || ''));
  console.log(`\nAdmin courses matching test patterns: ${aTest.length}`);
  aTest.slice(0, 15).forEach(c => {
    console.log(`  ID: ${c._id} | Title: "${c.title}" | CreatedAt: ${c.createdAt}`);
  });

  // Check Instructor DB courses
  console.log('\nInstructor DB courses:');
  iCourses.forEach(c => {
    console.log(`  ID: ${c._id} | Title: "${c.title}" | CourseId: ${c.courseId} | ProgramId: ${c.programId} | Status: ${c.status}`);
  });

  await studentConn.close();
  await instructorConn.close();
  await adminConn.close();
}

inspectCourses().catch(console.error);

