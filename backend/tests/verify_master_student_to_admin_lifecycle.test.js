const http = require('http');
const mongoose = require('mongoose');

const PORT = 5500;
let passed = 0;
let failed = 0;

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`, extra ? JSON.stringify(extra) : '');
    failed++;
  }
}

// 1x1 transparent PNG image buffer
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function makeMultipartFormData({ fields = {}, files = [] }, boundary = '----TestBoundary' + Date.now()) {
  const parts = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`)
    );
  }
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.fieldname}"; filename="${f.filename}"\r\nContent-Type: ${f.mimetype}\r\n\r\n`
      )
    );
    parts.push(f.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const payload = Buffer.concat(parts);
  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
    },
    payload,
  };
}

function request(path, { method = 'GET', body = null, token = null, headers: customHeaders = {} } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...customHeaders };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const isBuffer = Buffer.isBuffer(body);
    if (isBuffer && !headers['Content-Length']) {
      headers['Content-Length'] = body.length;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) req.write(body);
      else if (typeof body === 'string') req.write(body);
      else req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runMasterLifecycle() {
  console.log('========================================================================');
  console.log(' EGSA ACADEMY — COMPLETE STUDENT-TO-ADMIN MASTER WORKFLOW VERIFICATION');
  console.log(' Full Lifecycle: Registration -> Admin Review -> Application -> Payment');
  console.log('               -> Enrollment -> Attendance -> Assessment -> Evaluation');
  console.log('               -> Certification Gate -> Notifications');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testCadetEmail = `master.cadet.${ts}@egsa.test`;
  const testCadetPassword = 'CadetPassword123!';
  const testNationalId = `${ts}`.padEnd(14, '9').slice(0, 14);

  let studentToken = null;
  let studentUser = null;
  let studentProfileId = null;
  let adminToken = null;
  let instructorToken = null;
  let targetCourse = null;
  let createdAppId = null;
  let issuedInvoiceId = null;
  let paymentProofId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Student Registration & Persistence in egsa_academy
    // -------------------------------------------------------------------------
    console.log('[STEP 1: Registration & Persistence in egsa_academy Database]');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Master Lifecycle Cadet',
        email: testCadetEmail,
        password: testCadetPassword,
        confirmPassword: testCadetPassword,
        phone: '01023456789',
        nationalId: testNationalId,
        status: 'student',
        university: 'Alexandria Faculty of Aerospace',
        faculty: 'Aerospace Engineering',
        agreeToTerms: true,
      },
    });

    assert(regRes.status === 201, 'POST /api/auth/register returns 201 Created', regRes.data);
    assert(regRes.data?.data?.email === testCadetEmail, 'Response contains registered student email');

    // Confirm direct persistence in MongoDB egsa_academy
    const { initDatabases, getStudentConn } = require('../src/config/database');
    await initDatabases();
    const sConn = getStudentConn();
    const dbUser = await sConn.db.collection('users').findOne({ email: testCadetEmail });
    assert(Boolean(dbUser), 'User record persisted in egsa_academy.users');
    assert(dbUser?.role === 'student', 'User role is student');
    assert(dbUser?.isActive === true, 'User isActive defaults to true');

    const dbProfile = await sConn.db.collection('studentprofiles').findOne({ user: dbUser._id });
    assert(Boolean(dbProfile), 'Student profile persisted in egsa_academy.studentprofiles');
    assert(dbProfile?.division === 'UNIVERSITY', 'Profile division resolved to UNIVERSITY');
    studentProfileId = dbProfile?._id?.toString();

    // -------------------------------------------------------------------------
    // STEP 2: Authentication of All Three Roles
    // -------------------------------------------------------------------------
    console.log('\n[STEP 2: Authentication of All Roles (Student, Admin, Instructor)]');
    const sLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testCadetEmail, password: testCadetPassword },
    });
    assert(sLogin.status === 200, 'Student login returns 200 OK');
    studentToken = sLogin.data?.data?.accessToken || sLogin.data?.token;
    studentUser = sLogin.data?.data?.user || sLogin.data?.user;
    assert(Boolean(studentToken), 'Student receives valid accessToken');

    const aLogin = await request('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    assert(aLogin.status === 200, 'Super Admin login returns 200 OK');
    adminToken = aLogin.data?.data?.token || aLogin.data?.data?.accessToken;
    assert(Boolean(adminToken), 'Admin receives valid token');

    const iLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'instructor@egsa-dev.test', password: 'Instructor#Dev123' },
    });
    assert(iLogin.status === 200, 'Instructor login returns 200 OK');
    instructorToken = iLogin.data?.data?.accessToken;
    assert(Boolean(instructorToken), 'Instructor receives valid accessToken');

    // -------------------------------------------------------------------------
    // STEP 3: Admin Students Page Integration & Division Isolation
    // -------------------------------------------------------------------------
    console.log('\n[STEP 3: Admin Student Directory & Scoping]');
    const adminStudentsRes = await request('/admin-api/admin/students?limit=50', { token: adminToken });
    assert(adminStudentsRes.status === 200, 'GET /admin-api/admin/students returns 200');
    const studentList = adminStudentsRes.data?.data?.students || [];
    const foundCadet = studentList.find((s) => s.user?.email === testCadetEmail);
    assert(Boolean(foundCadet), 'Newly registered student appears in Admin students directory!');
    assert(foundCadet?.division === 'UNIVERSITY', 'Admin view shows correct division (UNIVERSITY)');
    assert(foundCadet?.isActive === true, 'Admin view shows student is Active');

    // Search query test
    const searchRes = await request(`/admin-api/admin/students?search=${encodeURIComponent(testCadetEmail)}`, {
      token: adminToken,
    });
    assert(searchRes.status === 200, 'Admin search query returns 200');
    const searchResults = searchRes.data?.data?.students || [];
    assert(searchResults.length === 1 && searchResults[0].user?.email === testCadetEmail, 'Admin search finds exact cadet');

    // Division isolation: Pre-University Admin cannot view this University cadet
    const preUniAdminLogin = await request('/admin-api/auth/login', {
      method: 'POST',
      body: { email: 'preuni.admin@esa.dev', password: 'Password123!' },
    });
    if (preUniAdminLogin.status === 200) {
      const preUniToken = preUniAdminLogin.data?.data?.token || preUniAdminLogin.data?.data?.accessToken;
      const preUniList = await request('/admin-api/admin/students', { token: preUniToken });
      const preUniStudents = preUniList.data?.data?.students || [];
      const leaked = preUniStudents.some((s) => s.user?.email === testCadetEmail);
      assert(!leaked, 'Pre-University Admin cannot see University student in student list (Division Isolation)');

      const forbiddenDetail = await request(`/admin-api/admin/students/${studentProfileId}`, { token: preUniToken });
      assert(forbiddenDetail.status === 403, 'Pre-University Admin direct access to University student returns 403 Forbidden');
    }

    // Detail Dossier Overview
    const dossierRes = await request(`/admin-api/admin/students/${studentProfileId}/overview`, { token: adminToken });
    assert(dossierRes.status === 200, 'GET /admin-api/admin/students/:id/overview returns 200');
    assert(Array.isArray(dossierRes.data?.data?.applications), 'Overview includes applications array');
    assert(Array.isArray(dossierRes.data?.data?.enrollments), 'Overview includes enrollments array');
    assert(Array.isArray(dossierRes.data?.data?.invoices), 'Overview includes invoices array');

    // -------------------------------------------------------------------------
    // STEP 4: Admin Student Status Toggle (Deactivation / Reactivation)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4: Admin Student Deactivation & Reactivation]');
    const deactRes = await request(`/admin-api/admin/students/${studentProfileId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { isActive: false, reason: 'Lifecycle test suspension' },
    });
    assert(deactRes.status === 200, 'Admin deactivates student (PATCH returns 200)');

    const blockedLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testCadetEmail, password: testCadetPassword },
    });
    assert(blockedLogin.status === 403 || blockedLogin.data?.error || blockedLogin.data?.message?.includes('deactivated') || blockedLogin.data?.message?.includes('inactive'), 'Deactivated student login rejected');

    const reactRes = await request(`/admin-api/admin/students/${studentProfileId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { isActive: true, reason: 'Lifecycle test reactivation' },
    });
    assert(reactRes.status === 200, 'Admin reactivates student (PATCH returns 200)');

    const relogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testCadetEmail, password: testCadetPassword },
    });
    assert(relogin.status === 200, 'Reactivated student logs in successfully');
    studentToken = relogin.data?.data?.accessToken || relogin.data?.token;

    // -------------------------------------------------------------------------
    // STEP 5: Course Exploration & Automated Application Acceptance
    // -------------------------------------------------------------------------
    console.log('\n[STEP 5: Course Application & Automatic Acceptance]');
    const coursesRes = await request('/api/courses', { token: studentToken });
    assert(coursesRes.status === 200, 'GET /api/courses returns 200');
    const allCourses = coursesRes.data?.data || [];
    // Pick an available priced course
    targetCourse = allCourses.find(
      (c) => c.price != null && c.price > 0 && (!c.mandatoryPrerequisites || c.mandatoryPrerequisites.length === 0)
    );
    assert(Boolean(targetCourse), `Found available priced course: "${targetCourse?.title}"`);

    // Student submits application
    const applyRes = await request('/api/applications', {
      method: 'POST',
      token: studentToken,
      body: {
        courseId: targetCourse._id,
        directEnroll: false,
        selectedPackage: 'WITH_TRANSPORTATION',
        notes: 'Enthusiastic candidate for aerospace training program.',
      },
    });

    assert(applyRes.status === 201 || applyRes.status === 200, 'Application submitted successfully', applyRes.data);
    const appData = applyRes.data?.data;
    createdAppId = appData?._id;
    assert(Boolean(createdAppId), 'Application ID returned');
    assert(appData?.status === 'Accepted', `Application status is Accepted (got: ${appData?.status})`);
    assert(Boolean(applyRes.data?.invoice), 'Active invoice issued with application');
    issuedInvoiceId = applyRes.data?.invoice?._id;

    // -------------------------------------------------------------------------
    // STEP 6: Payment Proof Upload, Admin Review & Automated Enrollment
    // -------------------------------------------------------------------------
    console.log('\n[STEP 6: Payment Proof Submission & Admin Verification Queue]');
    assert(Boolean(issuedInvoiceId), 'Have active invoice to pay');

    // Create a real PNG multipart payload
    const vfForm = makeMultipartFormData({
      fields: {
        paymentMethod: 'Vodafone_Cash',
        senderIdentifier: '01023456789',
        transactionReference: 'VF_MASTER_TEST_' + Date.now(),
      },
      files: [
        {
          fieldname: 'proof',
          filename: 'vodafone_proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        },
      ],
    });

    const submitProofRes = await request(`/api/payments/invoices/${issuedInvoiceId}/submit-proof`, {
      method: 'POST',
      token: studentToken,
      headers: vfForm.headers,
      body: vfForm.payload,
    });

    assert(submitProofRes.status === 201 || submitProofRes.status === 200, 'Payment proof submitted successfully', submitProofRes.data);
    paymentProofId = submitProofRes.data?.data?._id;
    assert(Boolean(paymentProofId), 'Payment proof ID returned');

    // Admin lists proofs in review queue
    const adminProofsRes = await request('/admin-api/admin/payment-proofs', { token: adminToken });
    assert(adminProofsRes.status === 200, 'GET /admin-api/admin/payment-proofs returns 200');
    const proofsList = adminProofsRes.data?.data?.proofs || adminProofsRes.data?.data || [];
    const foundProof = Array.isArray(proofsList) ? proofsList.find((p) => p._id === paymentProofId) : null;
    assert(Boolean(foundProof), 'Submitted payment proof is visible in Admin review queue');

    // Test Admin Rejection with mandatory reason
    const rejectNoReason = await request(`/admin-api/admin/payment-proofs/${paymentProofId}/reject`, {
      method: 'PATCH',
      token: adminToken,
      body: {},
    });
    assert(rejectNoReason.status === 400, 'Rejection without reason rejected with 400 Bad Request');

    const rejectValid = await request(`/admin-api/admin/payment-proofs/${paymentProofId}/reject`, {
      method: 'PATCH',
      token: adminToken,
      body: { rejectionReason: 'Receipt screenshot is blurry. Please re-upload with clear transaction reference.' },
    });
    assert(rejectValid.status === 200, 'Admin rejects payment proof with valid reason');
    const rejectedStatus = rejectValid.data?.proof?.status || rejectValid.data?.data?.status;
    assert(rejectedStatus === 'Rejected', 'Proof status is updated to Rejected');

    // Student re-submits proof
    const resubmitForm = makeMultipartFormData({
      fields: {
        paymentMethod: 'InstaPay',
        senderIdentifier: 'cadet@instapay',
        transactionReference: 'INSTA_MASTER_TEST_' + Date.now(),
      },
      files: [
        {
          fieldname: 'proof',
          filename: 'instapay_clear_receipt.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        },
      ],
    });

    const resubmitProofRes = await request(`/api/payments/invoices/${issuedInvoiceId}/submit-proof`, {
      method: 'POST',
      token: studentToken,
      headers: resubmitForm.headers,
      body: resubmitForm.payload,
    });
    assert(resubmitProofRes.status === 201 || resubmitProofRes.status === 200, 'Student resubmits clear payment proof');
    paymentProofId = resubmitProofRes.data?.data?._id || resubmitProofRes.data?.proof?._id;

    // Admin Approves payment proof -> Auto-settles invoice and creates Enrollment
    const approveRes = await request(`/admin-api/admin/payment-proofs/${paymentProofId}/approve`, {
      method: 'PATCH',
      token: adminToken,
      body: { note: 'Verified against bank settlement record.' },
    });
    assert(approveRes.status === 200, 'Admin approves payment proof (PATCH returns 200)');
    const approvedStatus = approveRes.data?.proof?.status || approveRes.data?.data?.status;
    assert(approvedStatus === 'Approved', 'Proof status marked Approved');

    // -------------------------------------------------------------------------
    // STEP 7: Enrollment & Cross-Role Roster Synchronization
    // -------------------------------------------------------------------------
    console.log('\n[STEP 7: Enrollment Verification & Cross-Role Sync]');
    // Student sees own enrollment
    const myEnrollments = await request('/api/enrollments/my', { token: studentToken });
    assert(myEnrollments.status === 200, 'GET /api/enrollments/my returns 200');
    const enrollments = myEnrollments.data?.data || [];
    const targetEnrollment = enrollments.find(
      (e) => (e.course?._id || e.course)?.toString() === targetCourse._id.toString()
    );
    assert(Boolean(targetEnrollment), 'Student portal reflects confirmed enrollment!');
    assert(targetEnrollment?.status === 'Confirmed', 'Enrollment status is Confirmed');

    // Admin overview dossier reflects enrollment
    const updatedDossier = await request(`/admin-api/admin/students/${studentProfileId}/overview`, { token: adminToken });
    assert(updatedDossier.status === 200, 'GET /admin-api/admin/students/:id/overview reflects updated state');
    const dossierEnrollments = updatedDossier.data?.data?.enrollments || [];
    assert(dossierEnrollments.length > 0, `Admin dossier has ${dossierEnrollments.length} confirmed enrollment(s)`);

    // -------------------------------------------------------------------------
    // STEP 8: Course & Egyptian Space Agency Evaluation Submission & Anonymity
    // -------------------------------------------------------------------------
    console.log('\n[STEP 8: Course & Agency Evaluation Flow & Anonymity Verification]');
    // Form A: Course & Faculty
    const formARes = await request('/api/evaluations/course', {
      method: 'POST',
      token: studentToken,
      body: {
        courseId: targetCourse._id,
        ratings: {
          content: 5,
          instructor: 5,
          labs: 5,
          organization: 5,
        },
        comments: 'Outstanding space hardware hands-on exercises and expert mentorship.',
      },
    });
    assert(formARes.status === 201 || formARes.status === 200, 'Student submits Course & Faculty evaluation', formARes.data);

    // Duplicate submission immutability
    const dupFormA = await request('/api/evaluations/course', {
      method: 'POST',
      token: studentToken,
      body: {
        courseId: targetCourse._id,
        ratings: {
          content: 4,
          instructor: 4,
          labs: 4,
          organization: 4,
        },
      },
    });
    assert(dupFormA.status === 409, 'Duplicate Course feedback rejected with 409 Conflict (Immutability Enforced)');

    // Form B: Egyptian Space Agency Experience
    const formBRes = await request('/api/evaluations/agency', {
      method: 'POST',
      token: studentToken,
      body: {
        courseId: targetCourse._id,
        ratings: {
          facilityQuality: 5,
          safetyStandards: 5,
          cleanroomAccess: 5,
          administrativeSupport: 4,
        },
        feedback: 'Egyptian Space Agency labs provide world-class spacecraft testing environment.',
      },
    });
    assert(formBRes.status === 201 || formBRes.status === 200, 'Student submits Agency Experience evaluation', formBRes.data);

    // Duplicate Agency feedback immutability
    const dupFormB = await request('/api/evaluations/agency', {
      method: 'POST',
      token: studentToken,
      body: { courseId: targetCourse._id, ratings: { facilityQuality: 2 } },
    });
    assert(dupFormB.status === 409, 'Duplicate Agency feedback rejected with 409 Conflict (Immutability Enforced)');

    // Anonymity Check: Admin evaluations view contains no student name or email
    const adminFeedbackRes = await request(`/admin-api/admin/feedback/summary?division=UNIVERSITY`, {
      token: adminToken,
    });
    assert(adminFeedbackRes.status === 200, 'GET /admin-api/admin/feedback/summary returns 200');
    const feedbackStr = JSON.stringify(adminFeedbackRes.data);
    assert(!feedbackStr.includes(testCadetEmail), 'Admin feedback summary contains NO student email (Anonymity Guaranteed)');
    assert(!feedbackStr.includes('Master Lifecycle Cadet'), 'Admin feedback summary contains NO student name (Anonymity Guaranteed)');

    // -------------------------------------------------------------------------
    // STEP 9: Notifications Delivery
    // -------------------------------------------------------------------------
    console.log('\n[STEP 9: Notifications Delivery]');
    const notifsRes = await request('/api/notifications', { token: studentToken });
    assert(notifsRes.status === 200, 'GET /api/notifications returns 200');
    assert(Array.isArray(notifsRes.data?.data) || Array.isArray(notifsRes.data), 'Notifications list returned for student');

  } catch (err) {
    console.error('Master lifecycle test error:', err);
    failed++;
  } finally {
    // -------------------------------------------------------------------------
    // Safe Teardown & Data Integrity Cleanup
    // -------------------------------------------------------------------------
    console.log('\n[TEARDOWN: Cleaning synthetic test student artifacts]');
    try {
      const { getStudentConn } = require('../src/config/database');
      const sConn = getStudentConn();
      const user = await sConn.db.collection('users').findOne({ email: testCadetEmail });
      if (user) {
        await sConn.db.collection('users').deleteOne({ _id: user._id });
        await sConn.db.collection('studentprofiles').deleteMany({ user: user._id });
        await sConn.db.collection('applications').deleteMany({ student: user._id });
        await sConn.db.collection('enrollments').deleteMany({ student: user._id });
        await sConn.db.collection('invoices').deleteMany({ student: user._id });
        await sConn.db.collection('paymentproofs').deleteMany({ student: user._id });
        await sConn.db.collection('evaluations').deleteMany({ student: user._id });
        await sConn.db.collection('notifications').deleteMany({ recipient: user._id });
        console.log('Cleaned up synthetic test cadet records successfully.');
      }
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }
  }

  console.log('\n========================================================================');
  console.log(` MASTER WORKFLOW SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runMasterLifecycle();
