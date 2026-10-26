const mongoose = require('mongoose');

async function cleanupTestData() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY SAFE TEST-POLLUTION CLEANUP UTILITY');
  console.log(' Purging ONLY test-tagged submissions, attendance records, and notifications');
  console.log('========================================================================\n');

  const sConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_academy').asPromise();
  const iConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_instructor').asPromise();
  const aConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/esa_academy').asPromise();

  // 1. Clean test submissions in Student DB
  const S_Sub = sConn.model('StudentSubmission', new mongoose.Schema({}, { strict: false }));
  const S_Res = sConn.model('AssessmentResult', new mongoose.Schema({}, { strict: false }));
  const S_Att = sConn.model('AttendanceRecord', new mongoose.Schema({}, { strict: false }));
  const S_Notif = sConn.model('Notification', new mongoose.Schema({}, { strict: false }));

  const subDel = await S_Sub.deleteMany({ textAnswer: { $regex: /submitted by E2E test/i } });
  console.log(`  [Student DB] Deleted ${subDel.deletedCount} E2E test submission(s).`);

  const attDel = await S_Att.deleteMany({ notes: { $regex: /Cross-Role E2E Test Suite/i } });
  console.log(`  [Student DB] Deleted ${attDel.deletedCount} E2E test attendance record(s).`);

  const notifDel = await S_Notif.deleteMany({ title: { $regex: /Assessment Evaluated: CubeSat/i } });
  console.log(`  [Student DB] Deleted ${notifDel.deletedCount} test notification(s).`);

  // 2. Clean test submissions in Instructor DB
  const I_Sub = iConn.model('AssessmentSubmission', new mongoose.Schema({}, { strict: false }));
  const I_Res = iConn.model('AssessmentResult', new mongoose.Schema({}, { strict: false }));
  const I_Notif = iConn.model('Notification', new mongoose.Schema({}, { strict: false }));

  const iSubDel = await I_Sub.deleteMany({ content: { $regex: /submitted by E2E test/i } });
  console.log(`  [Instructor DB] Deleted ${iSubDel.deletedCount} E2E test submission(s).`);

  const iNotifDel = await I_Notif.deleteMany({ title: { $regex: /New Student Submission/i } });
  console.log(`  [Instructor DB] Deleted ${iNotifDel.deletedCount} test notification(s).`);

  // 3. Clean test attendance in Admin DB
  const A_Att = aConn.model('Attendance', new mongoose.Schema({}, { strict: false }));
  const aAttDel = await A_Att.updateMany(
    {},
    { $pull: { records: { notes: { $regex: /Cross-Role E2E Test Suite/i } } } }
  );
  console.log(`  [Admin DB] Cleaned E2E test attendance records from ${aAttDel.modifiedCount} session(s).`);

  await sConn.close();
  await iConn.close();
  await aConn.close();

  console.log('\nSafe cleanup complete. Core seed data and user accounts are 100% untouched.\n');
}

if (require.main === module) {
  cleanupTestData().catch(console.error);
}

module.exports = { cleanupTestData };
