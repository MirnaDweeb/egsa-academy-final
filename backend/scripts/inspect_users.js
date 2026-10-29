const mongoose = require('mongoose');
const env = require('../src/config/env');

async function inspectUsers() {
  const studentConn = mongoose.createConnection(env.db.studentUri);
  const instructorConn = mongoose.createConnection(env.db.instructorUri);
  const adminConn = mongoose.createConnection(env.db.adminUri);

  await Promise.all([
    new Promise((r) => studentConn.once('connected', r)),
    new Promise((r) => instructorConn.once('connected', r)),
    new Promise((r) => adminConn.once('connected', r)),
  ]);

  console.log('=== STUDENT USERS ===');
  const sUsers = await studentConn.db.collection('users').find({}).toArray();
  const sSystem = [];
  const sTest = [];
  const sOther = [];
  for (const u of sUsers) {
    if (u.email === 'sara.demo@egsa-academy.example') {
      sSystem.push(u);
    } else if (
      u.email.includes('test') ||
      u.email.includes('cadet') ||
      u.email.includes('browser') ||
      u.email.includes('fresh') ||
      u.email.endsWith('@example.com') ||
      u.email.endsWith('@egsa.gov.eg')
    ) {
      sTest.push(u);
    } else {
      sOther.push(u);
    }
  }
  console.log(`Student Users total: ${sUsers.length}`);
  console.log(`System/Baseline: ${sSystem.length}`, sSystem.map(u => u.email));
  console.log(`Test users: ${sTest.length}`, sTest.slice(0, 10).map(u => u.email));
  console.log(`Other users: ${sOther.length}`, sOther.map(u => u.email));

  console.log('\n=== INSTRUCTOR USERS ===');
  const iUsers = await instructorConn.db.collection('users').find({}).toArray();
  for (const u of iUsers) {
    console.log(`ID: ${u._id} | Email: ${u.email} | Name: ${u.name || u.fullName} | Role: ${u.role}`);
  }

  console.log('\n=== ADMIN USERS ===');
  const aUsers = await adminConn.db.collection('users').find({}).toArray();
  const aAdmin = [];
  const aTest = [];
  const aInstructor = [];
  const aOther = [];
  for (const u of aUsers) {
    if (u.role === 'admin' || u.role === 'superadmin') {
      aAdmin.push(u);
    } else if (u.role === 'instructor') {
      aInstructor.push(u);
    } else if (
      u.email.includes('test') ||
      u.email.includes('cadet') ||
      u.email.includes('browser')
    ) {
      aTest.push(u);
    } else {
      aOther.push(u);
    }
  }
  console.log(`Admin Users total: ${aUsers.length}`);
  console.log(`Admin/Superadmin: ${aAdmin.length}`, aAdmin.map(u => `${u.email} (${u.role})`));
  console.log(`Instructors in admin db: ${aInstructor.length}`, aInstructor.map(u => `${u.email} (${u.name || u.fullName})`));
  console.log(`Test users in admin db: ${aTest.length}`);
  console.log(`Other users in admin db: ${aOther.length}`, aOther.slice(0, 10).map(u => `${u.email} (${u.role})`));

  await studentConn.close();
  await instructorConn.close();
  await adminConn.close();
}

inspectUsers().catch(console.error);

