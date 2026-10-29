const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const PORT = 5500;

async function jsonRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Accept': 'application/json',
      ...headers,
    };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (_) {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

test('EGSA Academy — Student Application & Enrollment Flow Verification', async (t) => {
  let studentToken = null;
  let otherStudentToken = null;
  let adminToken = null;
  let studentUser = null;
  let otherStudentUser = null;

  await t.test('Acquire authentication tokens', async () => {
    // 1. Student 1 login (Sara)
    const sLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
    });
    assert.equal(sLogin.status, 200, 'Student login succeeds');
    studentToken = sLogin.body.token || sLogin.body.data?.token;
    studentUser = sLogin.body.data?.user || sLogin.body.user;
    assert.ok(studentToken, 'Student token received');

    // 2. Student 2 (Omar) login for cross-access test
    const oLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'omar.student@egsa.gov.eg', password: 'Password123!' },
    });
    assert.equal(oLogin.status, 200, 'Student 2 login succeeds');
    otherStudentToken = oLogin.body.token || oLogin.body.data?.token;
    otherStudentUser = oLogin.body.data?.user || oLogin.body.user;
    assert.ok(otherStudentToken, 'Student 2 token received');

    // 3. Super Admin login
    const aLogin = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    assert.equal(aLogin.status, 200, 'Admin login succeeds');
    adminToken = aLogin.body.token || aLogin.body.data?.token;
    assert.ok(adminToken, 'Admin token received');
  });

  let pricedCourse = null;
  let unpricedCourse = null;
  let prereqCourse = null;

  await t.test('Inspect Course Catalog to find test courses', async () => {
    const res = await jsonRequest({
      method: 'GET',
      path: '/api/courses',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    const courses = res.body.data || [];
    assert.ok(courses.length > 0, 'Course catalog populated');

    // Find a priced course where student has no active application or enrollment
    const myAppsRes = await jsonRequest({
      method: 'GET',
      path: '/api/applications/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const existingAppCourseIds = (myAppsRes.body.data || []).map((a) => (a.course?._id || a.course)?.toString());
    const myEnrollmentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const enrolledCourseIds = (myEnrollmentsRes.body.data || []).map((e) => (e.course?._id || e.course)?.toString());
    const unavailable = new Set([...existingAppCourseIds, ...enrolledCourseIds]);
    pricedCourse = courses.find((c) => c.price != null && (!c.mandatoryPrerequisites || c.mandatoryPrerequisites.length === 0) && !unavailable.has(c._id.toString()));
    assert.ok(pricedCourse, 'Priced course found');

    // Find an unpriced course (price == null)
    unpricedCourse = courses.find((c) => c.price == null);
    assert.ok(unpricedCourse, 'Unpriced course found (Cybersecurity or PgMP)');

    // Find course with mandatory prerequisites
    prereqCourse = courses.find((c) => c.mandatoryPrerequisites && c.mandatoryPrerequisites.length > 0);
    assert.ok(prereqCourse, 'Course with mandatory prerequisites found');
  });

  let standardAppId = null;
  await t.test('Student can submit standard application (Apply Now) for a priced course', async () => {
    const res = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: pricedCourse._id,
        directEnroll: false,
        selectedPackage: 'WITH_TRANSPORTATION',
        notes: 'Interested in advancing my orbital mechanics background for EGSA mission operations.',
      },
    });

    assert.ok(res.status === 201 || res.status === 200, 'Application accepted or returns existing');
    assert.equal(res.body.success, true);
    assert.ok(res.body.data._id, 'Application ID returned');
    assert.ok(res.body.data.referenceNumber, 'Reference number generated');
    standardAppId = res.body.data._id;
  });

  await t.test('Student can apply for a course with unpriced tuition (price == null)', async () => {
    // Calling directEnroll: true on unpriced course should be cleanly rejected with clear guidance
    const directRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: unpricedCourse._id,
        directEnroll: true,
      },
    });
    assert.equal(directRes.status, 400, 'Direct enroll rejected for unpriced course');
    assert.match(directRes.body.message, /published pricing|admissions review/i);

    // Calling standard Apply Now should succeed with status Under Review
    const applyRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: unpricedCourse._id,
        directEnroll: false,
        notes: 'Applying for technical cybersecurity track.',
      },
    });

    assert.ok(applyRes.status === 201 || applyRes.status === 200, 'Unpriced course application accepted');
    assert.equal(applyRes.body.success, true);
    assert.ok(['Under Review', 'Submitted'].includes(applyRes.body.data.status));
    assert.equal(applyRes.body.invoice, null, 'No invoice forced for unpriced course');
  });

  await t.test('Student applying for course with missing prerequisites receives Foundation Recommended guidance', async () => {
    // Register a fresh cadet to ensure zero existing application history
    const freshEmail = `prereq.cadet.${Date.now()}@egsa.test`;
    await jsonRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        fullName: 'Prereq Test Cadet',
        email: freshEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        phone: '01055554444',
        nationalId: `${Date.now()}`.padEnd(14, '1').slice(0, 14),
        status: 'student',
        university: 'Engineering Academy',
        faculty: 'Space Tech',
        agreeToTerms: true,
      },
    });
    const loginRes = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: freshEmail, password: 'Password123!' },
    });
    const freshToken = loginRes.body?.data?.accessToken || loginRes.body?.token;

    const res = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${freshToken}` },
      body: {
        courseId: prereqCourse._id,
        directEnroll: false,
      },
    });

    assert.ok(res.status === 201 || res.status === 200, 'Application processed');
    assert.ok(['Foundation Required', 'Foundation Recommended'].includes(res.body.data.status), 'Status reflects foundation requirement');
  });

  await t.test('Duplicate application submissions are handled safely and idempotently', async () => {
    const res = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: pricedCourse._id,
        directEnroll: false,
      },
    });

    assert.equal(res.status, 200, 'Duplicate submission returns existing app with 200');
    assert.equal(res.body.success, true);
    assert.equal(res.body.data._id, standardAppId);
    assert.match(res.body.message, /already exists|accepted and seat reserved|already enrolled/i);
  });

  await t.test('Student can list own applications via GET /api/applications/my', async () => {
    const res = await jsonRequest({
      method: 'GET',
      path: '/api/applications/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), 'Array of applications returned');
    const found = res.body.data.find((a) => a._id === standardAppId);
    assert.ok(found, 'Created application found in student account list');
    assert.ok(found.course, 'Course populated');
  });

  await t.test('Cross-student access is strictly blocked (Security & Data Integrity)', async () => {
    // Omar tries to access Sara's application
    const res = await jsonRequest({
      method: 'GET',
      path: `/api/applications/${standardAppId}`,
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });

    assert.equal(res.status, 404, 'Accessing other student application returns 404');
  });

  await t.test('Admin can view applications in administrative review workflow', async () => {
    const res = await jsonRequest({
      method: 'GET',
      path: '/admin-api/admin/applications',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200, 'Admin can access applications queue');
    const apps = Array.isArray(res.body.data) ? res.body.data : res.body.data?.applications;
    assert.ok(Array.isArray(apps), 'Array of applications returned to admin');
    assert.ok(apps.length > 0, 'Applications queue contains records');
  });

  await t.test('Application to nonexistent or invalid course is rejected with 404', async () => {
    const res = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: '6ad68d5c553bc1845e039999',
        directEnroll: false,
      },
    });

    assert.equal(res.status, 404, 'Nonexistent course returns 404');
    assert.match(res.body.message, /not found/i);
  });
});
