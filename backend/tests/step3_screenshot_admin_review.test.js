const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

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

// Minimal valid PNG (1x1 pixel)
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('EGSA Academy Step 3: Complete Screenshot Upload, Admin Review & Enrollment Workflow', async (t) => {
  let studentToken = null;
  let otherStudentToken = null;
  let studentAdminToken = null;
  let esaAdminToken = null;
  let testCourse = null;

  await t.test('Authentication & Multi-Role Provisioning', async () => {
    // 1. Primary student (Sara)
    const sLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'sara.demo@egsa-academy.example', password: 'Password123!' },
    });
    assert.equal(sLogin.status, 200, 'Student login succeeded');
    studentToken = sLogin.body.token || sLogin.body.data?.token;
    assert.ok(studentToken, 'Student token obtained');

    // 2. Secondary student (Omar) for cross-access & rejection tests
    const oLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'omar.student@egsa.gov.eg', password: 'Password123!' },
    });
    assert.equal(oLogin.status, 200, 'Secondary student login succeeded');
    otherStudentToken = oLogin.body.token || oLogin.body.data?.token;
    assert.ok(otherStudentToken, 'Secondary student token obtained');

    // 3. Student Module Admin (admin@egsa-academy.example)
    const saLogin = await jsonRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'admin@egsa-academy.example', password: 'AdminPass123!' },
    });
    assert.equal(saLogin.status, 200, 'Student admin login succeeded');
    studentAdminToken = saLogin.body.token || saLogin.body.data?.token;
    assert.ok(studentAdminToken, 'Student admin token obtained');

    // 4. ESA Super Admin (superadmin@esa.dev)
    const eaLogin = await jsonRequest({
      method: 'POST',
      path: '/admin-api/auth/login',
      body: { email: 'superadmin@esa.dev', password: 'Password123!' },
    });
    assert.equal(eaLogin.status, 200, 'ESA Super Admin login succeeded');
    esaAdminToken = eaLogin.body.token || eaLogin.body.data?.token;
    assert.ok(esaAdminToken, 'ESA admin token obtained');
  });

  await t.test('Locate active priced course for testing', async () => {
    const res = await jsonRequest({
      method: 'GET',
      path: '/api/courses',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 200);
    const courses = res.body.data || [];
    assert.ok(courses.length > 0, 'Course catalog populated');
    testCourse = courses.find((c) => c.price != null && c.price > 0 && (!c.mandatoryPrerequisites || c.mandatoryPrerequisites.length === 0));
    assert.ok(testCourse, 'Priced test course found');
  });

  await t.test('Isolate and prepare fresh application state for test run', async () => {
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_academy').asPromise();
    try {
      const AppModel = conn.model('Application', new mongoose.Schema({}, { strict: false }));
      const InvModel = conn.model('Invoice', new mongoose.Schema({}, { strict: false }));
      const ProofModel = conn.model('PaymentProof', new mongoose.Schema({}, { strict: false }));
      const EnrModel = conn.model('Enrollment', new mongoose.Schema({}, { strict: false }));
      const UserModel = conn.model('User', new mongoose.Schema({}, { strict: false }));

      const sara = await UserModel.findOne({ email: 'sara.demo@egsa-academy.example' });
      const omar = await UserModel.findOne({ email: 'omar.student@egsa.gov.eg' });

      for (const u of [sara, omar]) {
        if (!u) continue;
        const studentOid = new mongoose.Types.ObjectId(u._id);
        const courseOid = new mongoose.Types.ObjectId(testCourse._id);
        const apps = await AppModel.find({ student: studentOid, course: courseOid });
        for (const a of apps) {
          await InvModel.deleteMany({ application: a._id });
          await ProofModel.deleteMany({ application: a._id });
          await AppModel.deleteOne({ _id: a._id });
        }
        await EnrModel.deleteMany({ student: studentOid, course: courseOid });
      }
    } finally {
      await conn.close();
    }
  });

  let app1Id = null;
  let app2Id = null;

  // 1. Student submits an application
  await t.test('Scenario 1: Student submits application', async () => {
    const res = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: testCourse._id,
        directEnroll: false,
        selectedPackage: 'WITH_TRANSPORTATION',
        notes: 'Applying for training cohort with transport.',
      },
    });
    assert.ok([200, 201].includes(res.status), `Application submitted: status ${res.status}`);
    const app = res.body.data || res.body;
    app1Id = app._id;
    assert.ok(app1Id, 'Application 1 created');
  });

  // 2. Student uploads the required screenshot / document
  await t.test('Scenario 2: Student uploads required screenshot / document', async () => {
    // 2a. Reject corrupted/fake file via magic bytes validation
    const invalidMultipart = makeMultipartFormData({
      fields: { documentType: 'National ID / Passport' },
      files: [
        {
          fieldname: 'document',
          filename: 'fake.png',
          mimetype: 'image/png',
          buffer: Buffer.from('NOT_A_VALID_IMAGE_CONTENT'),
        },
      ],
    });
    const badUploadRes = await httpRequest({
      method: 'POST',
      path: `/api/applications/${app1Id}/document`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...invalidMultipart.headers,
      },
      body: invalidMultipart.payload,
    });
    assert.equal(badUploadRes.status, 400, 'Invalid file rejected by magic-bytes validation');

    // 2b. Valid upload with genuine PNG screenshot
    const validMultipart = makeMultipartFormData({
      fields: { documentType: 'Student ID / Verification Screenshot' },
      files: [
        {
          fieldname: 'document',
          filename: 'student_verification_screenshot.png',
          mimetype: 'image/png',
          buffer: SAMPLE_PNG_BUFFER,
        },
      ],
    });
    const goodUploadRes = await httpRequest({
      method: 'POST',
      path: `/api/applications/${app1Id}/document`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...validMultipart.headers,
      },
      body: validMultipart.payload,
    });
    assert.equal(goodUploadRes.status, 200, 'Screenshot uploaded successfully');
    assert.equal(goodUploadRes.body.success, true);
    assert.equal(goodUploadRes.body.data?.supportingDocument?.originalName, 'student_verification_screenshot.png');
    assert.equal(goodUploadRes.body.data?.supportingDocument?.documentType, 'Student ID / Verification Screenshot');
  });

  // 3. Admin opens the correct application and views its screenshot
  await t.test('Scenario 3: Admin opens application and streams its uploaded screenshot', async () => {
    // 3a. Student Admin via /api/admin/applications/:id/document
    const studentAdminDocRes = await httpRequest({
      method: 'GET',
      path: `/api/admin/applications/${app1Id}/document`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
    });
    assert.equal(studentAdminDocRes.status, 200, 'Student Admin can access document stream');
    assert.equal(studentAdminDocRes.headers['content-type'], 'image/png');
    assert.deepEqual(studentAdminDocRes.buffer, SAMPLE_PNG_BUFFER, 'Streamed bytes match uploaded file');

    // 3b. ESA Super Admin via /admin-api/admin/applications/:id/document (proxy bridge)
    const esaAdminDocRes = await httpRequest({
      method: 'GET',
      path: `/admin-api/admin/applications/${app1Id}/document`,
      headers: { Authorization: `Bearer ${esaAdminToken}` },
    });
    assert.equal(esaAdminDocRes.status, 200, 'ESA Admin can access document stream through proxy');
    assert.equal(esaAdminDocRes.headers['content-type'], 'image/png');
    assert.deepEqual(esaAdminDocRes.buffer, SAMPLE_PNG_BUFFER, 'Proxy stream matches file');
  });

  // 4. Admin rejects an application and the student can see the reason
  await t.test('Scenario 4: Admin rejects application and student sees reason', async () => {
    // Create application for secondary student (Omar) to test rejection cleanly
    const resApp2 = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${otherStudentToken}` },
      body: {
        courseId: testCourse._id,
        directEnroll: false,
        selectedPackage: 'WITHOUT_TRANSPORTATION',
        notes: 'Application by Omar to test rejection flow.',
      },
    });
    app2Id = (resApp2.body.data || resApp2.body)._id;
    assert.ok(app2Id);

    const rejectionReasonText = 'Prerequisites do not align with advanced aerospace mechanics requirement.';
    const rejectRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/applications/${app2Id}/reject`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
      body: { reason: rejectionReasonText },
    });
    assert.equal(rejectRes.status, 200, 'Admin rejection succeeded');
    const rejectedApp = rejectRes.body.data?.application || rejectRes.body.data;
    assert.equal(rejectedApp.status, 'Rejected');

    // Student checks application status and rejection reason
    const studentCheckRes = await jsonRequest({
      method: 'GET',
      path: `/api/applications/${app2Id}`,
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert.equal(studentCheckRes.status, 200);
    assert.equal(studentCheckRes.body.data?.status, 'Rejected');
    assert.equal(studentCheckRes.body.data?.rejectionReason, rejectionReasonText, 'Student sees reason for rejection');

    // Verify document upload is rejected on this rejected application
    const rejectedUploadMultipart = makeMultipartFormData({
      fields: { documentType: 'Student ID / Verification Screenshot' },
      files: [
        {
          fieldname: 'document',
          filename: 'upload_on_rejected.png',
          mimetype: 'image/png',
          buffer: SAMPLE_PNG_BUFFER,
        },
      ],
    });
    const rejectedUploadRes = await httpRequest({
      method: 'POST',
      path: `/api/applications/${app2Id}/document`,
      headers: {
        Authorization: `Bearer ${otherStudentToken}`,
        ...rejectedUploadMultipart.headers,
      },
      body: rejectedUploadMultipart.payload,
    });
    assert.equal(rejectedUploadRes.status, 400, 'Document upload blocked on rejected application');
  });

  // 5. Admin approves an eligible application
  let invoiceId = null;
  await t.test('Scenario 5: Admin approves eligible application', async () => {
    const acceptRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/applications/${app1Id}/accept`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
      body: { note: 'Approved by Space Systems Admission Board.' },
    });
    assert.equal(acceptRes.status, 200, 'Admin acceptance succeeded');
    const updatedApp = acceptRes.body.data?.application || acceptRes.body.data;
    assert.equal(updatedApp.status, 'Accepted', 'Application status updated to Accepted');
    invoiceId = acceptRes.body.data?.invoice?._id || updatedApp.invoice?._id || updatedApp.invoice;
    assert.ok(invoiceId, 'Invoice generated for tuition settlement');
  });

  // 6. Payment verification workflow for priced course
  let proofId = null;
  await t.test('Scenario 6: Payment verification workflow for priced course', async () => {
    // 6a. Student submits payment proof for the issued invoice
    const proofMultipart = makeMultipartFormData({
      fields: {
        paymentMethod: 'Vodafone_Cash',
        senderIdentifier: '01012345678',
        transactionReference: 'TRX-STEP3-' + Date.now(),
      },
      files: [
        {
          fieldname: 'proof',
          filename: 'vodafone_cash_receipt.png',
          mimetype: 'image/png',
          buffer: SAMPLE_PNG_BUFFER,
        },
      ],
    });
    const submitProofRes = await httpRequest({
      method: 'POST',
      path: `/api/payments/invoices/${invoiceId}/submit-proof`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
        ...proofMultipart.headers,
      },
      body: proofMultipart.payload,
    });
    assert.equal(submitProofRes.status, 201, 'Student payment proof submission succeeded');
    proofId = submitProofRes.body.data?._id;
    assert.ok(proofId, 'Payment proof ID recorded');

    // 6b. Admin reviews and approves the payment proof
    const approveProofRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/payment-proofs/${proofId}/approve`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
    });
    assert.equal(approveProofRes.status, 200, 'Finance Admin approved payment proof');
    const approvedProofObj = approveProofRes.body.proof || approveProofRes.body.data;
    assert.equal(approvedProofObj?.status, 'Approved');
  });

  // 7. Confirm student becomes enrolled only when all required conditions are met
  await t.test('Scenario 7: Student confirmed and officially enrolled after payment confirmation', async () => {
    const studentAppRes = await jsonRequest({
      method: 'GET',
      path: `/api/applications/${app1Id}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentAppRes.status, 200);
    const app = studentAppRes.body.data;
    assert.equal(app.status, 'Confirmed', 'Application status is Confirmed');
    assert.ok(app.enrollment, 'Enrollment reference present on application');

    // Verify student enrollments list
    const myEnrollmentsRes = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(myEnrollmentsRes.status, 200);
    const enrollments = myEnrollmentsRes.body.data || [];
    const found = enrollments.find(
      (e) => (e.course?._id || e.course) === testCourse._id
    );
    assert.ok(found, 'Course enrollment found in student enrollments');
    assert.ok(['Enrolled', 'Active', 'Confirmed'].includes(found.status), 'Enrollment is active');
  });

  // 8. Verify repeated approval does not create duplicate enrollments or double seats
  await t.test('Scenario 8: Repeated approval idempotency guard', async () => {
    const enrollsBefore = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const countBefore = (enrollsBefore.body.data || []).length;

    // Call accept again
    const repeatAcceptRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/applications/${app1Id}/accept`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
      body: { note: 'Repeated approval attempt' },
    });
    assert.equal(repeatAcceptRes.status, 200, 'Repeated accept handled gracefully');

    const enrollsAfter = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const countAfter = (enrollsAfter.body.data || []).length;
    assert.equal(countAfter, countBefore, 'No duplicate enrollment record created');
  });

  // 9. Verify unauthorized users cannot access private screenshots or other students' records
  await t.test('Scenario 9: Security & access control enforcement', async () => {
    // 9a. Another student cannot access app 1's document
    const crossStudentDocRes = await httpRequest({
      method: 'GET',
      path: `/api/applications/${app1Id}/document`,
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert.equal(crossStudentDocRes.status, 403, 'Cross-student document access forbidden (403)');

    // 9b. Unauthenticated user cannot access document
    const unauthDocRes = await httpRequest({
      method: 'GET',
      path: `/api/applications/${app1Id}/document`,
    });
    assert.equal(unauthDocRes.status, 401, 'Unauthenticated document access unauthorized (401)');

    // 9c. Non-admin student cannot access admin document route
    const studentOnAdminRoute = await httpRequest({
      method: 'GET',
      path: `/api/admin/applications/${app1Id}/document`,
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    assert.ok([401, 403].includes(studentOnAdminRoute.status), 'Student denied on admin document route');
  });

  // 10. A genuinely free course follows approved free-course policy (immediate confirmed enrollment without invoice/payment)
  let freeCourse = null;
  let freeAppId = null;
  await t.test('Scenario 10: Genuinely free course policy verification', async () => {
    // Connect to MongoDB to prepare a dedicated free course
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_academy').asPromise();
    try {
      const CourseModel = conn.model('Course', new mongoose.Schema({}, { strict: false }));
      const AppModel = conn.model('Application', new mongoose.Schema({}, { strict: false }));
      const EnrModel = conn.model('Enrollment', new mongoose.Schema({}, { strict: false }));
      const UserModel = conn.model('User', new mongoose.Schema({}, { strict: false }));

      // Upsert course with price: 0, status: 'Open', and published: true
      await CourseModel.updateOne(
        { slug: 'intro-space-systems-free' },
        {
          $set: {
            title: 'Introduction to Space Systems — Open Community Seminar',
            code: 'EGSA-FREE-01',
            slug: 'intro-space-systems-free',
            level: 'Awareness / Fundamentals',
            levelTier: 1,
            price: 0,
            currency: 'EGP',
            status: 'Open',
            published: true,
            isActive: true,
            active: true,
            directEnrollmentPermitted: true,
            category: 'General Space Studies',
          },
        },
        { upsert: true }
      );
      freeCourse = await CourseModel.findOne({ slug: 'intro-space-systems-free' });

      const sara = await UserModel.findOne({ email: 'sara.demo@egsa-academy.example' });
      if (sara) {
        const studentOid = new mongoose.Types.ObjectId(sara._id);
        const courseOid = new mongoose.Types.ObjectId(freeCourse._id);
        await AppModel.deleteMany({ student: studentOid, course: courseOid });
        await EnrModel.deleteMany({ student: studentOid, course: courseOid });
      }
    } finally {
      await conn.close();
    }

    assert.ok(freeCourse, 'Free course ready for test');
    assert.equal(freeCourse.price, 0, 'Course price is 0');

    // Student submits application for the free course
    const appRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: freeCourse._id,
        directEnroll: false,
        notes: 'Applying for community free space seminar.',
      },
    });
    assert.ok([200, 201].includes(appRes.status), 'Free course application submitted');
    freeAppId = (appRes.body.data || appRes.body)._id;
    assert.ok(freeAppId, 'Free application ID created');

    // Admin accepts the free course application
    const acceptRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/applications/${freeAppId}/accept`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
      body: { note: 'Approved under Open Education free seat policy.' },
    });
    assert.equal(acceptRes.status, 200, 'Free course application accepted by admin');
    assert.equal(acceptRes.body.data?.application?.status, 'Confirmed', 'Application status transitions directly to Confirmed');
    assert.equal(acceptRes.body.data?.invoice, null, 'No invoice is created for free course');
    const freeEnrollmentId = acceptRes.body.data?.enrollment?._id || acceptRes.body.data?.application?.enrollment;
    assert.ok(freeEnrollmentId, 'Free course application has enrollment ID');

    // Verify student sees confirmed status and enrollment
    const studentAppRes = await jsonRequest({
      method: 'GET',
      path: `/api/applications/${freeAppId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentAppRes.status, 200);
    assert.equal(studentAppRes.body.data?.status, 'Confirmed');
    assert.ok(studentAppRes.body.data?.enrollment, 'Student application references active enrollment');

    // Verify student enrollments list contains free course with 0 paidAmount
    const myEnrolls = await jsonRequest({
      method: 'GET',
      path: '/api/enrollments/my',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(myEnrolls.status, 200);
    const foundFree = (myEnrolls.body.data || []).find((e) => (e.course?._id || e.course).toString() === freeCourse._id.toString());
    assert.ok(foundFree, 'Free course enrollment found in student enrollments');
    assert.equal(foundFree.paidAmount, 0, 'Free course enrollment paidAmount is 0');
    assert.ok(['Confirmed', 'Active', 'Enrolled'].includes(foundFree.status));
  });

  // 11. Student readiness assessment lifecycle & course recommendations
  let attemptId = null;
  await t.test('Scenario 11: Student readiness diagnostic lifecycle & course recommendations', async () => {
    // 11a. Start readiness assessment for testCourse
    const startRes = await jsonRequest({
      method: 'POST',
      path: '/api/readiness/start',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { courseId: testCourse._id, retake: true },
    });
    assert.ok([200, 201].includes(startRes.status), `Readiness started: status ${startRes.status}`);
    assert.ok(startRes.body.data?.attemptId, 'Attempt ID returned');
    assert.ok(Array.isArray(startRes.body.data?.questions), 'Questions array returned');
    assert.ok(startRes.body.data.questions.length > 0, 'Questions available');
    attemptId = startRes.body.data.attemptId;

    // Verify answers do not contain correctAnswerIndex (security)
    assert.equal(startRes.body.data.questions[0].correctAnswerIndex, undefined, 'Answers hidden from student');

    // 11b. Fetch attempt status
    const getAttemptRes = await jsonRequest({
      method: 'GET',
      path: `/api/readiness/${attemptId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(getAttemptRes.status, 200, 'Attempt fetched successfully');
    assert.equal(getAttemptRes.body.data?.status, 'InProgress');

    // 11c. Submit assessment answers
    const answers = startRes.body.data.questions.map((q) => ({
      questionId: q.id,
      selectedIndex: 0,
    }));
    const submitRes = await jsonRequest({
      method: 'POST',
      path: `/api/readiness/${attemptId}/submit`,
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { answers },
    });
    assert.equal(submitRes.status, 200, 'Assessment submitted successfully');
    assert.ok(typeof submitRes.body.data?.score === 'number', 'Score calculated');
    assert.ok(submitRes.body.data?.outcome, 'Outcome determined');

    // 11d. Fetch graded diagnostic result with recommendations
    const resultRes = await jsonRequest({
      method: 'GET',
      path: `/api/readiness/${attemptId}/result`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resultRes.status, 200, 'Result fetched successfully');
    assert.equal(resultRes.body.data?.status, 'Submitted');
    assert.ok(resultRes.body.data?.course, 'Target course populated');

    // If recommendedCourse is provided, verify it has _id and title (links work in UI)
    if (resultRes.body.data?.recommendedCourse) {
      assert.ok(resultRes.body.data.recommendedCourse._id, 'Recommended course has ID for details link');
      assert.ok(resultRes.body.data.recommendedCourse.title, 'Recommended course has title');
    }
  });

  // 12. Readiness does not prevent student from applying to other available courses
  await t.test('Scenario 12: Independent course application without readiness gating', async () => {
    // Locate a different available course
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/egsa_academy').asPromise();
    let courseB = null;
    try {
      const CourseModel = conn.model('Course', new mongoose.Schema({}, { strict: false }));
      const AppModel = conn.model('Application', new mongoose.Schema({}, { strict: false }));
      const UserModel = conn.model('User', new mongoose.Schema({}, { strict: false }));

      const allCourses = await CourseModel.find({
        _id: { $ne: new mongoose.Types.ObjectId(testCourse._id) },
        price: { $gt: 0 },
      }).limit(5);

      courseB = allCourses[0];
      const sara = await UserModel.findOne({ email: 'sara.demo@egsa-academy.example' });
      if (sara && courseB) {
        await AppModel.deleteMany({
          student: new mongoose.Types.ObjectId(sara._id),
          course: new mongoose.Types.ObjectId(courseB._id),
        });
      }
    } finally {
      await conn.close();
    }

    assert.ok(courseB, 'Alternative course found');

    // Student applies to course B without any readiness blockage
    const applyBRes = await jsonRequest({
      method: 'POST',
      path: '/api/applications',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseId: courseB._id,
        directEnroll: false,
        notes: 'Applying to alternative program.',
      },
    });
    assert.ok([200, 201].includes(applyBRes.status), `Applied to course B successfully: status ${applyBRes.status}`);
    const appB = applyBRes.body.data || applyBRes.body;
    assert.ok(appB._id, 'Application for course B created');
  });

  // 13. Repeated payment proof approval idempotency & seat integrity
  await t.test('Scenario 13: Repeated payment approval idempotency', async () => {
    // Calling approve on an already approved proof should be idempotent
    const repeatApproveRes = await jsonRequest({
      method: 'PATCH',
      path: `/api/admin/payment-proofs/${proofId}/approve`,
      headers: { Authorization: `Bearer ${studentAdminToken}` },
    });
    assert.equal(repeatApproveRes.status, 200, 'Repeated approval handled gracefully');
    const proofObj = repeatApproveRes.body.proof || repeatApproveRes.body.data;
    assert.equal(proofObj?.status, 'Approved', 'Status remains Approved');
  });
});
