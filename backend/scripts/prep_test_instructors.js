const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function checkPasswords() {
  const adminConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/esa_academy').asPromise();
  const instConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_instructor').asPromise();

  const AdminUser = adminConn.model('User', new mongoose.Schema({}, { strict: false }));
  const InstUser = instConn.model('User', new mongoose.Schema({}, { strict: false }));
  const InstructorProfile = adminConn.model('InstructorProfile', new mongoose.Schema({}, { strict: false }));

  const defaultPassword = 'Password123!';
  const defaultInstPassword = 'Instructor#Dev123';
  const hashedAdmin = await bcrypt.hash(defaultPassword, 10);
  const hashedInst = await bcrypt.hash(defaultInstPassword, 10);

  // 1. Instructor A (uni.instructor@esa.dev)
  let uniInst = await AdminUser.findOne({ email: 'uni.instructor@esa.dev' });
  if (uniInst) {
    await AdminUser.updateOne({ _id: uniInst._id }, { $set: { password: hashedAdmin, isActive: true } });
  }

  // 2. Instructor B (uni.instructor.b@esa.dev)
  let uniInstB = await AdminUser.findOne({ email: 'uni.instructor.b@esa.dev' });
  if (!uniInstB) {
    uniInstB = await AdminUser.create({
      fullName: 'Dr. Tarek Orbital',
      email: 'uni.instructor.b@esa.dev',
      password: hashedAdmin,
      role: 'INSTRUCTOR',
      division: 'UNIVERSITY',
      isActive: true,
      permissions: ['COURSES_VIEW', 'STUDENTS_VIEW'],
    });
  } else {
    await AdminUser.updateOne({ _id: uniInstB._id }, { $set: { password: hashedAdmin, isActive: true } });
  }

  // Ensure InstructorProfile exists for uniInstB
  let profB = await InstructorProfile.findOne({ user: uniInstB._id });
  if (!profB) {
    profB = await InstructorProfile.create({
      user: uniInstB._id,
      division: 'UNIVERSITY',
      divisions: ['UNIVERSITY'],
      title: 'Associate Astrodynamics Professor',
      specialization: 'Orbital Mechanics & Maneuvers',
      bio: 'Senior faculty at EGSA Space Academy.',
      isActive: true,
    });
    console.log('Created InstructorProfile for uni.instructor.b@esa.dev');
  }

  // 3. Pre-University Instructor (instructor@esa.dev)
  let preInst = await AdminUser.findOne({ email: 'instructor@esa.dev' });
  if (preInst) {
    await AdminUser.updateOne({ _id: preInst._id }, { $set: { password: hashedAdmin, isActive: true } });
  }

  // 4. Mirror into egsa_instructor
  let instUniUser = await InstUser.findOne({ email: 'uni.instructor@esa.dev' });
  if (!instUniUser) {
    await InstUser.create({
      name: 'Sample University Instructor',
      email: 'uni.instructor@esa.dev',
      password: hashedInst,
      passwordHash: hashedInst,
      role: 'instructor',
      status: 'active',
      isActive: true,
      division: 'UNIVERSITY',
    });
  } else {
    await InstUser.updateOne({ _id: instUniUser._id }, { $set: { password: hashedInst, passwordHash: hashedInst, status: 'active', isActive: true } });
  }

  let instUniUserB = await InstUser.findOne({ email: 'uni.instructor.b@esa.dev' });
  if (!instUniUserB) {
    await InstUser.create({
      name: 'Dr. Tarek Orbital',
      email: 'uni.instructor.b@esa.dev',
      password: hashedInst,
      passwordHash: hashedInst,
      role: 'instructor',
      status: 'active',
      isActive: true,
      division: 'UNIVERSITY',
    });
  } else {
    await InstUser.updateOne({ _id: instUniUserB._id }, { $set: { password: hashedInst, passwordHash: hashedInst, status: 'active', isActive: true } });
  }

  // Instructor C
  let instC = await InstUser.findOne({ email: 'instructor@egsa-dev.test' });
  if (instC) {
    await InstUser.updateOne({ _id: instC._id }, { $set: { password: hashedInst, passwordHash: hashedInst, status: 'active', isActive: true } });
  }

  await adminConn.close();
  await instConn.close();
  console.log('Instructor sync and password prep complete.');
}

checkPasswords().catch(console.error);

