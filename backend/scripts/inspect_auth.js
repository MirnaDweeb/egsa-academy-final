const mongoose = require('mongoose');

async function testAuth() {
  const adminConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/esa_academy').asPromise();
  const instConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_instructor').asPromise();

  const AdminUser = adminConn.model('User', new mongoose.Schema({}, { strict: false }));
  const InstUser = instConn.model('User', new mongoose.Schema({}, { strict: false }));

  const admins = await AdminUser.find(
    { role: { $in: ['SUPER_ADMIN', 'UNIVERSITY_ADMIN', 'PRE_UNIVERSITY_ADMIN', 'INSTRUCTOR'] } },
    'fullName email role division'
  );
  console.log('Admins & Instructors in esa_academy:\n', admins);

  const insts = await InstUser.find({}, 'name email role');
  console.log('Instructors in egsa_instructor:\n', insts);

  await adminConn.close();
  await instConn.close();
}

testAuth().catch(console.error);

