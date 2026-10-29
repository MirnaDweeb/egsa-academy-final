const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

// Configure three dedicated connection pools for Student, Instructor, and Admin
let studentConn = null;
let instructorConn = null;
let adminConn = null;

function createScopedConnection(name, uri) {
  const timeoutMs = Number(process.env.MONGO_TIMEOUT_MS) || 15000;
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: timeoutMs,
  });

  conn.on('connected', () => {
    if (!env.isTest) {
      console.log(`[Database] ${name} connected to database: ${conn.name}`);
    }
  });

  conn.on('error', (err) => {
    console.error(`[Database] ${name} connection error:`, err.message);
  });

  conn.on('disconnected', () => {
    if (!env.isTest) {
      console.warn(`[Database] ${name} disconnected`);
    }
  });

  return conn;
}

function getStudentConn() {
  if (!studentConn) {
    studentConn = createScopedConnection('Student', env.db.studentUri);
  }
  return studentConn;
}

function getInstructorConn() {
  if (!instructorConn) {
    instructorConn = createScopedConnection('Instructor', env.db.instructorUri);
  }
  return instructorConn;
}

function getAdminConn() {
  if (!adminConn) {
    adminConn = createScopedConnection('Admin', env.db.adminUri);
  }
  return adminConn;
}

async function initDatabases(maxRetries = 3, retryDelayMs = 2000) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const s = getStudentConn();
      const i = getInstructorConn();
      const a = getAdminConn();

      await Promise.all([
        s.asPromise(),
        i.asPromise(),
        a.asPromise(),
      ]);

      return { studentConn: s, instructorConn: i, adminConn: a };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        if (!env.isTest) {
          console.warn(`[Database] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in ${retryDelayMs / 1000}s...`);
        }
        try {
          if (studentConn) await studentConn.close().catch(() => {});
          if (instructorConn) await instructorConn.close().catch(() => {});
          if (adminConn) await adminConn.close().catch(() => {});
        } finally {
          studentConn = null;
          instructorConn = null;
          adminConn = null;
        }
        await new Promise((res) => setTimeout(res, retryDelayMs));
      }
    }
  }

  throw lastError;
}

async function closeDatabases() {
  const promises = [];
  if (studentConn) promises.push(studentConn.close());
  if (instructorConn) promises.push(instructorConn.close());
  if (adminConn) promises.push(adminConn.close());
  await Promise.all(promises);
}

module.exports = {
  getStudentConn,
  getInstructorConn,
  getAdminConn,
  initDatabases,
  closeDatabases,
};
