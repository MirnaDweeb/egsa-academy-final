const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const PORT = 5500;

function httpRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buffer.toString('utf8'));
          } catch (_) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer,
            body: json,
            text: buffer.toString('utf8'),
          });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

function jsonRequest({ method = 'GET', path, headers = {}, body = null }) {
  const payload = body ? JSON.stringify(body) : null;
  const reqHeaders = {
    Accept: 'application/json',
    ...headers,
  };
  if (payload) {
    reqHeaders['Content-Type'] = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(payload);
  }
  return httpRequest({ method, path, headers: reqHeaders, body: payload });
}

test('EGSA Academy: Course Enrollment Application Window Lifecycle & Regression Suite', async (t) => {
  let adminToken = null;
  let studentToken = null;
  const testSuffix = Date.now();
  const testStudentEmail = `cadet.window.${testSuffix}@egsa.gov.eg`;

  // 1. Authenticate Admin and Student
  await t.test('1. Multi-Role Authentication', async () => {
    // Admin login
    const aRes = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    assert.equal(aRes.status, 200, 'Admin login succeeded');
    adminToken = aRes.body.token || aRes.body.data?.token;
    assert.ok(adminToken, 'Admin token obtained');

    // Student registration & login
    const regRes = await jsonRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        fullName: `Cadet Window Tester ${testSuffix}`,
        email: testStudentEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeToTerms: true,
        phone: '010' + String(testSuffix).slice(-8),
        nationalId: '298' + String(testSuffix).slice(-11),
        division: 'UNIVERSITY',
        track: 'Space Technologies',
      },
    });
    assert.equal(regRes.status, 201, 'Student registered');

    const sLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testStudentEmail, password: 'Password123!' },
    });
    assert.equal(sLogin.status, 200, 'Student login succeeded');
    studentToken = sLogin.body.data?.token || sLogin.body.token;
    assert.ok(studentToken, 'Student token obtained');
  });

  // 2. Draft Course Rejects Enrollment
  let draftCourseId = null;
  await t.test('2. Draft Course Rejection: Applications are currently closed', async () => {
    const createRes = await jsonRequest({
      method: 'POST',
      path: '/admin-api/programs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: `Draft Satellite Systems ${testSuffix}`,
        description: 'Testing draft application closure',
        division: 'UNIVERSITY',
        level: 'BEGINNER',
        status: 'DRAFT',
        capacity: 20,
        price: 3500,
        deliveryMode: 'ONSITE',
      },
    });
    assert.equal(createRes.status, 201, 'Draft program created');
    draftCourseId = createRes.body.data?.program?._id;
    assert.ok(draftCourseId, 'Draft program ID obtained');

    // Attempt enrollment while DRAFT
    const enrollRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: draftCourseId,
        directEnroll: true,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
      },
    });
    assert.equal(enrollRes.status, 400, 'Enrollment rejected for DRAFT course');
    assert.match(
      enrollRes.body.message,
      /applications are currently closed/i,
      'Exact error message: Applications are currently closed for this course.'
    );
  });

  // 3. Publishing Course Opens Applications Legitimately
  await t.test('3. Admin Publishes Course: Applications Open & Enrollment Succeeds', async () => {
    // Admin publishes course via PATCH /admin-api/programs/:id/status
    const pubRes = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/programs/${draftCourseId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'ACTIVE', reason: 'Official publication for open enrollment' },
    });
    assert.equal(pubRes.status, 200, 'Course published to ACTIVE');
    assert.equal(pubRes.body.data?.program?.status, 'ACTIVE');

    // Student now successfully applies and reserves seat
    const enrollRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: draftCourseId,
        directEnroll: true,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
      },
    });
    assert.equal(enrollRes.status, 201, 'Enrollment succeeded once published');
    assert.equal(enrollRes.body.data?.status, 'Accepted');
    assert.ok(enrollRes.body.invoice?.invoiceNumber, 'Tuition invoice issued');
  });

  // 4. Admin Pauses Admissions: Reverts Course from ACTIVE to DRAFT
  let newStudentToken = null;
  await t.test('4. Admin Pauses Admissions (ACTIVE -> DRAFT) & Verifies Closure', async () => {
    // Register another student to test subsequent closure
    const subStudentEmail = `cadet.sub.${testSuffix}@egsa.gov.eg`;
    await jsonRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        fullName: `Cadet Sub Tester ${testSuffix}`,
        email: subStudentEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeToTerms: true,
        phone: '011' + String(testSuffix).slice(-8),
        nationalId: '299' + String(testSuffix).slice(-11),
        division: 'UNIVERSITY',
        track: 'Space Technologies',
      },
    });
    const subLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: subStudentEmail, password: 'Password123!' },
    });
    newStudentToken = subLogin.body.data?.token || subLogin.body.token;

    // Admin pauses admissions by transitioning status to DRAFT
    const pauseRes = await jsonRequest({
      method: 'PATCH',
      path: `/admin-api/programs/${draftCourseId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'DRAFT', reason: 'Pausing admissions for cohort reallocation' },
    });
    assert.equal(pauseRes.status, 200, 'Status reverted to DRAFT');
    assert.equal(pauseRes.body.data?.program?.status, 'DRAFT');

    // Sub student attempts to enroll and is blocked
    const blockedRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${newStudentToken}` },
      body: {
        courseId: draftCourseId,
        directEnroll: true,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
      },
    });
    assert.equal(blockedRes.status, 400, 'Enrollment blocked after pausing');
    assert.match(blockedRes.body.message, /applications are currently closed/i);
  });

  // 5. Scheduled Application Window (Future Opening Date)
  await t.test('5. Scheduled Application Window: Future Opening Date', async () => {
    const futureOpenDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const futureCloseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const schedRes = await jsonRequest({
      method: 'POST',
      path: '/admin-api/programs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: `Scheduled Astrodynamics ${testSuffix}`,
        description: 'Applications open in 14 days',
        division: 'UNIVERSITY',
        level: 'INTERMEDIATE',
        status: 'ACTIVE',
        capacity: 25,
        price: 4500,
        deliveryMode: 'HYBRID',
        registrationStartDate: futureOpenDate,
        registrationEndDate: futureCloseDate,
      },
    });
    assert.equal(schedRes.status, 201, 'Scheduled course created');
    const schedCourseId = schedRes.body.data?.program?._id;

    // Student attempts to apply before opening date
    const earlyRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${newStudentToken}` },
      body: {
        courseId: schedCourseId,
        directEnroll: false,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
      },
    });
    assert.equal(earlyRes.status, 400, 'Early application rejected');
    assert.match(
      earlyRes.body.message,
      /applications for this course have not opened yet/i,
      'Clear validation: Applications have not opened yet'
    );
  });

  // 6. Expired Application Window (Past Deadline)
  await t.test('6. Expired Application Window: Past Deadline', async () => {
    const pastOpenDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const pastCloseDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const expiredRes = await jsonRequest({
      method: 'POST',
      path: '/admin-api/programs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: `Past Cycle Propulsion ${testSuffix}`,
        description: 'Deadline passed 2 days ago',
        division: 'UNIVERSITY',
        level: 'ADVANCED',
        status: 'ACTIVE',
        capacity: 15,
        price: 5000,
        deliveryMode: 'ONSITE',
        registrationStartDate: pastOpenDate,
        registrationEndDate: pastCloseDate,
      },
    });
    assert.equal(expiredRes.status, 201, 'Expired window course created');
    const expiredCourseId = expiredRes.body.data?.program?._id;

    // Student attempts to apply after deadline
    const lateRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${newStudentToken}` },
      body: {
        courseId: expiredCourseId,
        directEnroll: false,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
      },
    });
    assert.equal(lateRes.status, 400, 'Late application rejected');
    assert.match(
      lateRes.body.message,
      /the application deadline for this course has passed/i,
      'Clear validation: Application deadline has passed'
    );
  });

  // 7. Verify Preserved Active Course (6ad68d5c553bc1845e03866b)
  await t.test('7. Preserved Active Course (6ad68d5c553bc1845e03866b) Verification', async () => {
    const targetCourseId = '6ad68d5c553bc1845e03866b';

    // Verify course is ACTIVE in Admin
    const getProg = await jsonRequest({
      method: 'GET',
      path: `/admin-api/programs/${targetCourseId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(getProg.status, 200);
    const prog = getProg.body.data?.program || getProg.body.data;
    assert.equal(prog.status, 'ACTIVE', 'Preserved demo course is ACTIVE');
    const basePrice = prog.price || 3500;

    // Register a fresh student cadet to enroll in the preserved course
    const targetCadetEmail = `cadet.integration.target.${testSuffix}@egsa.gov.eg`;
    await jsonRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        fullName: `Target Cadet ${testSuffix}`,
        email: targetCadetEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeToTerms: true,
        phone: '012' + String(testSuffix).slice(-8),
        nationalId: '297' + String(testSuffix).slice(-11),
        division: 'UNIVERSITY',
        track: 'Space Technologies',
      },
    });
    const targetLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: targetCadetEmail, password: 'Password123!' },
    });
    const targetCadetToken = targetLogin.body.data?.token || targetLogin.body.token;

    // Student enrolls with standard package
    const enrollTargetRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${targetCadetToken}` },
      body: {
        courseId: targetCourseId,
        directEnroll: true,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
        notes: 'Enrolling in Preserved Demo Course',
      },
    });
    assert.equal(enrollTargetRes.status, 201, 'Target course enrollment accepted (201)');
    assert.equal(enrollTargetRes.body.data?.status, 'Accepted');
    assert.equal(enrollTargetRes.body.invoice?.amount, basePrice, `Tuition amount is ${basePrice} EGP`);
    assert.equal(enrollTargetRes.body.invoice?.status, 'Invoice Issued');

    // Also register a student opting for transportation
    const transCadetEmail = `cadet.integration.trans.${testSuffix}@egsa.gov.eg`;
    await jsonRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        fullName: `Trans Cadet ${testSuffix}`,
        email: transCadetEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeToTerms: true,
        phone: '015' + String(testSuffix).slice(-8),
        nationalId: '296' + String(testSuffix).slice(-11),
        division: 'UNIVERSITY',
        track: 'Space Technologies',
      },
    });
    const transLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: transCadetEmail, password: 'Password123!' },
    });
    const transCadetToken = transLogin.body.data?.token || transLogin.body.token;

    const enrollTransRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${transCadetToken}` },
      body: {
        courseId: targetCourseId,
        directEnroll: true,
        selectedPackage: 'WITH_TRANSPORTATION',
        notes: 'Enrolling with daily transportation',
      },
    });
    assert.equal(enrollTransRes.status, 201, 'Transportation package enrollment accepted (201)');
    assert.equal(enrollTransRes.body.data?.status, 'Accepted');
    assert.equal(enrollTransRes.body.invoice?.amount, basePrice + 500, `Tuition + Transportation amount is ${basePrice + 500} EGP`);
  });
});

